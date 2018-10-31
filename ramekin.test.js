const Ramekin = require('./ramekin')

test('normalise a string', () => {
  const r = new Ramekin()
  expect(r.normalise('My name is Ian')).toEqual('name ian')
})

test('Set intersection code snippet test - to be refactored into a function test', () => {
  let a = new Set([1,2,3])
  let b = new Set([4,3,2]);
  let intersection = new Set(
    [...a].filter(x => b.has(x)))
  console.log(intersection.values())
  })
 
