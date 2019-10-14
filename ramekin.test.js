const moment = require('moment')
const Ramekin = require('./ramekin')
const util = require('./lib/util')

const testDoc = { id: '123', body: 'Random text string', date: new Date() }
const testDoc2 = { id: '456', body: 'Antoher random string', date: new Date() }
const noIdTestDoc = { body: 'Another random string', date: new Date() }
const noDateTestDoc = { id: '123', body: 'Another random string' }

const usedPhrases = [
  'antoh',
  'antoh,random',
  'antoh,random,string',
  'random',
  'random,string',
  'random,text',
  'random,text,string',
  'string',
  'text',
  'text,string']

const findDocOptions = {
  start: moment().subtract(1, 'months'),
  end: new Date()
}

const pastHistoryOptions = {
  start: moment().subtract(2, 'year'),
  end: moment().subtract(1, 'year')
}

test('normalise: normalise a string', () => {
  const r = new Ramekin()
  expect(r.normalise('My name is Ian')).toEqual('name ian')
})

test('Set intersection code snippet test - to be refactored into a function test', () => {
  const a = [1, 2, 3]
  const b = [4, 3, 2]
  expect(util.intersection(a, b)).toEqual([2, 3])
})

test('constructor: test default options are set', () => {
  const r = new Ramekin()
  expect(r.options.minTrendFreq).toEqual(3)
  expect(r.options.historyDays).toEqual(90)
})

// test combined defaults an standards
test('constructor: test default and specified options are set', () => {
  const r = new Ramekin({ minTrendFreq: 5 })
  expect(r.options.minTrendFreq).toEqual(5)
  expect(r.options.historyDays).toEqual(90)
})

// test date as a string

// test combined defaults an standards
test('ingest: test a document gets ingested', () => {
  const r = new Ramekin()

  expect(r.docs).toEqual({})
  r.ingest(testDoc)
  expect(r.docs).toEqual({ [testDoc.id]: testDoc })
})

test('ingest: ingest the same doc twice', () => {
  const r = new Ramekin()

  expect(r.docs).toEqual({})
  r.ingest(testDoc)
  expect(r.docs).toEqual({ [testDoc.id]: testDoc })
  expect(() => r.ingest(testDoc)).toThrow()
})

test('ingest: no id specified', () => {
  const r = new Ramekin()

  expect(r.docs).toEqual({})
  expect(() => r.ingest(noIdTestDoc)).toThrow()
})

test('ingest: no date specified', () => {
  const r = new Ramekin()

  expect(r.docs).toEqual({})
  expect(() => r.ingest(noDateTestDoc)).toThrow()
})

test('ingestAll: test a document gets ingested', () => {
  const r = new Ramekin()

  expect(r.docs).toEqual({})
  r.ingestAll([testDoc, testDoc2])
  expect(r.docs).toEqual({ [testDoc.id]: testDoc, [testDoc2.id]: testDoc2 })
})

test('count: test the count returns the correct number', () => {
  const r = new Ramekin()
  r.ingestAll([testDoc, testDoc2])

  expect(r.count('random', findDocOptions)).toEqual(2)
  expect(r.count('random,string', findDocOptions)).toEqual(1)
  expect(r.count('not,random,string', findDocOptions)).toEqual(0)
})

test('count: not in date range', () => {
  const r = new Ramekin()
  r.ingestAll([testDoc, testDoc2])
  expect(r.count('random', pastHistoryOptions)).toEqual(0)
})

test('usedPhrases: returns the correct phrases', () => {
  const r = new Ramekin()

  expect(r.usedPhrases(findDocOptions)).toEqual([])
  r.ingestAll([testDoc, testDoc2])

  const computedUsedPhrases = r.usedPhrases(findDocOptions)
  computedUsedPhrases.sort()
  usedPhrases.sort()
  expect(computedUsedPhrases).toEqual(usedPhrases)
  expect(r.usedPhrases(pastHistoryOptions)).toEqual([])
})

test('trending: no data', () => {
  const r = new Ramekin()
  const trends = r.trending()
  expect(trends).toEqual([])
})
