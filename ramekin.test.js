const Ramekin = require('./ramekin')
const util = require('./lib/util')
const moment = require('moment')
const fs = require('fs')

const testDoc = { _id: '123', body: 'Random text string', date: new Date() }
const testDoc2 = { _id: '456', body: 'Antoher random string', date: new Date() }
const noIdTestDoc = {  body: 'Another random string', date: new Date() }
const noDateTestDoc = { _id: '123', body: 'Another random string' }

const usedPhrases = [ [ 'random' ],
      [ 'text' ],
      [ 'string' ],
      [ 'random', 'text' ],
      [ 'text', 'string' ],
      [ 'random', 'text', 'string' ],
      [ 'antoh' ],
      [ 'random' ],
      [ 'string' ],
      [ 'antoh', 'random' ],
      [ 'random', 'string' ],
      [ 'antoh', 'random', 'string' ] ]

const findDocOptions = {
  start: moment().subtract(1, 'months'),
  end: new Date()
}

const pastHistoryOptions = {
  start: moment().subtract(2, 'year'),
  end: moment().subtract(1, 'year'),
}

const snapshotTestTimeOptions = {
  start: moment('2019-04-22T23:48:05+00:00').subtract(1, 'day').toDate(),
  end: moment('2019-04-22T23:48:05+00:00').toDate()
}

test('normalise: normalise a string', () => {
  const r = new Ramekin()
  expect(r.normalise('My name is Ian')).toEqual('name ian')
})

test('Set intersection code snippet test - to be refactored into a function test', () => {
  let a = [1,2,3]
  let b = [4,3,2]
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
  expect(r.docs).toEqual({ [testDoc._id]: testDoc })
})

test('ingest: ingest the same doc twice', () => {
  const r = new Ramekin()

  expect(r.docs).toEqual({})
  r.ingest(testDoc)
  expect(r.docs).toEqual({ [testDoc._id]: testDoc })
  expect(() => r.ingest(testDoc)).toThrow()
})

test('ingest: no _id specified', () => {
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
  r.ingestAll([ testDoc, testDoc2 ])
  expect(r.docs).toEqual({ [testDoc._id]: testDoc,  [testDoc2._id]: testDoc2,  })
})

test('count: test the count returns the correct number', () => {
  const r = new Ramekin()
  r.ingestAll([ testDoc, testDoc2 ])

  expect(r.count('random', findDocOptions)).toEqual(2)
  expect(r.count('random,string', findDocOptions)).toEqual(1)
  expect(r.count('not,random,string', findDocOptions)).toEqual(0)
})

test('count: not in date range', () => {
  const r = new Ramekin()
  r.ingestAll([ testDoc, testDoc2 ])
  expect(r.count('random', pastHistoryOptions)).toEqual(0)
})

test('usedPhrases: returns the correct phrases', () => {
  const r = new Ramekin()
     
  expect(r.usedPhrases(findDocOptions)).toEqual([])
  r.ingestAll([ testDoc, testDoc2 ])
  expect(r.usedPhrases(findDocOptions)).toEqual(usedPhrases)
  expect(r.usedPhrases(pastHistoryOptions)).toEqual([])
})
/*
ingestNGram (ngram, doc) {
*/
test('trending: returns the correct phrases', () => {

//test trending (options = {}) {
  const r = new Ramekin()
  const articles = JSON.parse(fs.readFileSync(`${__dirname}/tests/test-articles.json`, 'utf8'))
  r.ingestAll(articles)
 // expect(r.usedPhrases(findDocOptions)).toEqual([])
 // r.ingestAll([ testDoc, testDoc2 ])
  const trends = r.trending(snapshotTestTimeOptions)
 // console.log('trends', trends)

  expect(trends[0].phrases).toEqual([ [ 'game', 'throne', 'season', 'episod' ] ])
  expect(trends[0].score).toEqual([32.967032967032964])
  expect(trends[1].phrases).toEqual([ [ 'earth', 'dai' ] ])
  expect(trends[1].score).toEqual([19.565217391304348])
})

test('trending: no data', () => {
  const r = new Ramekin()
  const trends = r.trending()
  expect(trends).toEqual([])
})
  
/*
test ??  setDocPhrases = function (docPhrases, docs, phrases) {

removeSubPhrases (trendPhrases) {

findDocs (ngram, options) {
*/