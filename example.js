const { WASI } = require('wasi')
const assert = require('assert')
const fs = require('fs')

const wasi = new WASI(process) // argv, env
const buffer = new Uint8Array(fs.readFileSync('./target/release/lib/libwhw.so'))
const imports = {  wasi_snapshot_preview1: wasi.wasiImport }

WebAssembly.instantiate(buffer, imports).then(onwasm, onerror)

function onerror(err) {
  console.error(err)
}

function onwasm(wasm) {
  const { instance } = wasm
  const heap = new Uint8Array(wasm.instance.exports.memory.buffer)
  const ram = instance.exports.__heap_base

  const sizeofRandomAccess = instance.exports.sizeof_whw_RandomAccess()
  const string = "hello"
  const offset = 8
  const L = 32 // tail size

  // required, even if a `_start()` function is omitted
  wasi.start(instance)

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
