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
  const heap = new Uint8Array(memory.buffer)
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
