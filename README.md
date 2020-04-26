wasm-lib-hello-world
====================

> A _hello world_ for **unofficially** building a WASM/WASI module with [ZZ][zz]

## Prerequisites

* [wasi-sdk](https://github.com/WebAssembly/wasi-sdk)
* [wasi-libc](https://github.com/WebAssembly/wasi-libc)

## `zz.toml`

Before you can compile a ZZ project library in WASM format, you must set
the following compiler and linker flags in your `zz.toml` project file:

```toml
[project]
version = "0.1.0"
name = "whw" # wasm hello world
cincludes = []
cobjects = []
pkgconfig = []

lflags = [
  "-Wl,--export-dynamic", ## export all dynamic symbols, like functions
  "-Wl,--export-all", ## export all symbols so we get access to __heap_base, etc
  "-Wl,--no-entry", ## don't look for a _start function
  "-nostartfiles", ## no startup files
]

cflags = [
  "--target=wasm32-unknown-wasi", ## WASM/WASI clang target
  "--sysroot=/opt/wasi-libc", ## path to installed wasi-libc directory
  "-nostdlib", ## disable stdlib
]
```

## `src/lib.zz`

Below demonstrates a simple random access API for a tail bound
`RandomAccess` struct, which is allocated on the heap by the caller.
This is usual ZZ code.

```c++
export struct RandomAccess+ {
  u8 size;
  u8 mem[];
}

export fn read(RandomAccess+L *self, u8 mut *out, usize offset, usize size) -> usize
  where offset + size < L
  where len(out) >= size
  where offset < len(out)
{
  usize mut bytes_read = 0;
  for (usize mut i = 0; i < size; ++i) {
    static_attest(len(self->mem) > offset + i);
    out[i] = self->mem[offset + i];
    bytes_read++;
  }
  return bytes_read;
}

export fn write(RandomAccess+L mut *self, u8 *in, usize offset, usize size) -> usize
  where offset + size < L
  where len(in) >= size
{
  usize mut bytes_written = 0;
  for (usize mut i = 0; i < size; ++i) {
    static_attest(len(self->mem) > offset + i);
    self->mem[offset + i] = in[i];
    bytes_written++;
  }
  return bytes_written;
}
```

## Compiling

To compile the project, you must set the `CC` environment variable to
`clang` exported by the WASI SDK (`CC=/opt/wasi-sdk/bin/clang`) and
build the project in release (`--release`) or debug (`--debug`) mode.

```sh
$ CC=/opt/wasi-sdk/bin/clang zz build --release
```

The release target library `./target/release/lib/libwhw.so` will be
built in WASM format, **NOT** as a shared object file. At the time of
writing there is no way to control the output extension as `.so` is
hard coded when building a library.


## `example.js`

Below is an example of the compiled WASM module used in Node.js. The example
implements both `read()` and `write()` methods with tail bound instances of
the `RandomAccess` struct.

To run the example, run the following:

```sh
$ node example.js
hello
```

```js
const assert = require('assert')
const fs = require('fs')

const buffer = new Uint8Array(fs.readFileSync('./target/release/lib/libwhw.so'))
const memory = new WebAssembly.Memory({ initial: 256, maximum: 256 })
const imports = {
  env: { memory }
}

WebAssembly.instantiate(buffer, imports).then(onwasm, onerror)

function onerror(err) {
  console.error(err)
}

function onwasm(wasm) {
  const { instance } = wasm
  const heap = Buffer.from(memory.buffer)
  const ram = instance.exports.__heap_base

  const sizeofRandomAccess = instance.exports.sizeof_whw_RandomAccess()
  const string = "hello"
  const offset = 8
  const L = 32 // tail size

  // write "hello" to the heap
  assert(string.length === Buffer.from(string).copy(heap, ram + sizeofRandomAccess + L))

  // call write on `RandomAccess+L` passing in heap pointer to "hello" to write
  // at offset 8 with buffer size 5
  assert(string.length === instance.exports.whw_write(
    ram, L, // RandomAccess+L
    ram + sizeofRandomAccess + L, // input
    offset, // offset
    string.length // size
  ))

  assert(string.length === instance.exports.whw_read(
    ram, L, // RandomAccess+L
    ram + sizeofRandomAccess + L, // output
    offset, // offset
    string.length // size
  ))

  const output = Buffer.from(heap.slice(
    ram + sizeofRandomAccess + L,
    ram + sizeofRandomAccess + L + string.length
  ))

  assert("hello" == output.toString())

  console.log(output.toString())
}
```

## License

Public Domain

[zz]: https://github.com/zetzit/zz
