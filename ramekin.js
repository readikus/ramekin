/**
 * Features:
 *
 * * Added stop word removal.
 * * Cluster related trends.
 * * Ingest dates in string format.
 * * Normalise text, so similar words are clustered (i.e. "cycle", "Cycle",
 *     "CycLING" etc.)
 */
// import * as cluster from './lib/simple-cluster'
const SimpleCluster = require('./lib/simple-cluster')
// import * as TextHelpers from './lib/text-helpers'
const TextHelpers = require('./lib/text-helpers')
// import * as moment from 'moment'
const moment = require('moment')
// import * as natural from 'natural'
const natural = require('natural')
const NGrams = natural.NGrams
// @todo: refactor as much of the _ functions into ES6+ code.
let _ = require('lodash')

module.exports = class Ramekin {
  constructor (options) {
    this.options = {...options,
      ...{
        // a threshold for the minimum number of times a phrase has to occur
        // in a single day before it can even be considered a trend for a given subject.
        // @todo: work out a logical way of calculating this per category.
        minTrendFreq: 3,
        // the context of the number of days to consider for the history
        historyDays: 90,
        // the maximum size of the n-gram window
        maxN: 6,
        // remove stop words - why wouldn't you?!
        keepStops: false,
        // really not sure why I added this...assume it is to handle words that just didn't get mentioned in the history period.
        historyFrequencyTolerance: 1.6,
        // @todo: This is no longer used...(but I really think it should be)
        similarityThreshold: 0.3,
        // the maximum number of results to return.
        trendsTopN: 8
      }}

    // initialise the multi-dimensional ngram array storage
    this.ngrams = new Array(this.options.maxN + 1).fill([])

    // track the usage of the ngrams
    this.ngramHistory = {}

    // the documents
    this.docs = {}

    // setup stemming
    natural.PorterStemmer.attach()
  }

  /**
   * ingestAll() ingests a set of documents into the current Ramekin.
   * @param {docs} a set of documents in the format expected format
   */
  ingestAll (docs) {
    docs.forEach(doc => {
      this.ingest(doc)
    })
  }

  /**
   * Ingest a single document into the ramekin.
   *
   * @param doc document to ingest, in this format:
   *   {
   *     _id: <Unique ID - can be any format>,
   *     body: "Text",
   *     date: <ISO Date format string, or JavaScript date object>,
   *     subject: <Any object>
   *   }
   */
  ingest (doc) {
   // console.log('ingesting1', doc.date)

    // preprocess the date to check it's in the right format.
    if (!doc.date) {
     // console.log(doc)
      return
//      throw new Error(`Invalid date format`)
    }
    if (!(doc.date instanceof Date)) {
      doc.date = new Date(doc.date)
    }
    //console.log('ingesting2', doc.date)

    // ensure there is an id set
    if (!doc.hasOwnProperty('_id')) {
      throw new Error('No \'_id\' field set for document')
    }

    // throw error if the document already exists in the ramekin
    if (this.docs.hasOwnProperty(doc._id)) {
      throw new Error(`Document ${doc._id} has already been added to the ramekin`)
    }
    // throw error if the document already exists in the ramekin
    if (this.docs.hasOwnProperty(doc._id)) {
      throw new Error(`Document ${doc._id} has already been added to the ramekin`)
    }

    // we may need to revisit what doc data we store
    this.docs[doc._id] = doc

    // generate all the [1...n]-grams for the document
    for (let n = 1; n <= this.options.maxN; n++) {
      // create ngrams from the normalised text
      let ngrams = NGrams.ngrams(this.normalise(doc.body), n)

      // ingest all the ngrams
      ngrams.forEach(ngram => { this.ingestNGram(ngram, doc) })
    }
  }

  /**
   * Text analysis stage to take some raw text and convert
   * it into a format that we can ingest optimally.
   * @todo: create a function to map the original text
   * with the normalised version.
   */
  normalise (s) {
    // normalise the body text (handling stop words)
    return s.tokenizeAndStem(this.options.keepStops).join(' ')
  }

  /**
   * Add a new ngram into the ramekin.
   */
  ingestNGram (ngram, doc) {
    // construct the storable ngram object
    let ng = {
      date: doc.date,
      ngram: ngram,
      subject: doc.subject
    }
    this.ngrams[ ngram.length ].push(ng)

    // handle the ngram history creation

    // initialised hash element
    if (!this.ngramHistory.hasOwnProperty(ngram)) {
      this.ngramHistory[ ngram ] = { occurances: [] }
    }

    // only setting each word once - something fishy!!!!!
    this.ngramHistory[ ngram ].occurances.push({date: doc.date, doc_id: doc._id})
  }

  /**
   * Validate the trending options, setting defaults where necessary.
   * @todo: this whole block is manky and needs a refactor - setup, search and cluster
   */
  trending (options = {}) {
    // This is the really manky bit of code, that needs separating into a helper
    // class just for the trending, and ES6ing.

    // setup

    // only set defaults if no start date is set.
    if (!options.start) {
      options.start = new Date()
      options.end = new Date()
      options.start.setDate(options.end.getDate() - 1)
    }

    // get the history window dates
    if (!options.historyStart) {
      options.historyEnd = new Date(options.start)
      options.historyStart = moment(options.historyEnd).subtract(
        this.options.historyDays, 'day').toDate()
    }

    // end of setup

    // start of trending:search

    // find all the common phrases used in respective subject, over the past day
    let usedPhrases = this.usedPhrases(options)
    console.log(`There are ${usedPhrases.length} used phrases and ${Object.keys(this.docs).length} docs`)
    // duplicated data used later for sorting
    let trendPhrases = []
    let docPhrases = {}

    const setDocPhrases = function (docPhrases, docs, phrases) {
      docs.forEach(doc => {
        if (!docPhrases.hasOwnProperty(doc)) {
          docPhrases[doc] = []
        }
        docPhrases[doc] = docPhrases[doc].concat(phrases)
      })
    }

    // score each phrase from the trend period compared to it's historic use
    for (let i = 0; i < usedPhrases.length; i++) {
      // score if the phrase has trended in the last 24 hours
      const trendDocs = this.findDocs(usedPhrases[i], {start: options.start, end: options.end})
      const trendRangeCount = trendDocs.length
      const historyRangeCount = this.count(usedPhrases[i], {start: options.historyStart, end: options.historyEnd})
      let historyDayAverage = historyRangeCount / this.options.historyDays

      // add in the tolerance
      historyDayAverage *= this.options.historyFrequencyTolerance

      // if it's above the average
      if ((trendRangeCount > this.options.minTrendFreq) &&
          (trendRangeCount > historyDayAverage)) {
        let score = trendRangeCount / (historyDayAverage + 1)
        let phrase = {phrase: usedPhrases[i],
          score: score,
          historyRangeCount: historyRangeCount,
          trendRangeCount: trendRangeCount,
          docs: trendDocs}
        trendPhrases.push(phrase)
        setDocPhrases(docPhrases, trendDocs, [phrase.phrase])
      }
    }

    if (trendPhrases.length === 0) {
      return []
    }

    // remove sub phrases (i.e. "Tour de", compared to "Tour de France")
    trendPhrases = this.removeSubPhrases(trendPhrases)

    // rank results - @todo: needs making nicer
    trendPhrases.sort((a, b) =>
      (b.score === a.score) ? b.phrase.length - a.phrase.length : b.score - a.score
    )

    // end of trending:search

    // start of trending:cluster

    // this bit works to here!!!


    //console.log('trendPhrases', trendPhrases)
    // run the clustering - find the phrase that is most similar to so many
    // others (i.e. i, where sum(i) = max( sum() )
    const sc = new SimpleCluster(trendPhrases)
    let trends = sc.cluster()


    //console.log('trends', trends)
    //process.exit()
    //this bit is fucked!

    // rank the documents in each cluster, based on the docs etc.
    for (let i = 0; i < trends.length; i++) {
      let trend = trends[i]
      let docs = []



      //console.log('trend', trend)
      // for each document in that trend, count the number of phrases that match
      for (let j = 0; j < trend.docs.length; j++) {
        let doc = trend.docs[j]

        /*
          let a = new Set([1,2,3]);
          let b = new Set([4,3,2]);

          let intersection = new Set(
            [...a].filter(x => b.has(x)));

        */
        // count the number of phrases from the cluster that are in that doc
        let matches = _.intersection(docPhrases[ doc ], trend.phrases)
        docs.push({doc: doc, matches: matches.length})
      }

      // sort based on the number of matches
      docs.sort((a, b) => b.matches - a.matches)

      // remove unnecessary sort data now it is sorted
      trend.docs = docs.map(doc => doc.doc)
    }

    // end of trending:cluster

    // trim to just options.trendsTopN
    if (trendPhrases.length > this.options.trendsTopN) {
      trendPhrases.splice(this.options.trendsTopN, trendPhrases.length - this.options.trendsTopN)
    }

    return trends
  }

  /**
   * Finds the phrases used in a particular date range.
   * @todo: error handling.
   * @todo: this may be the main bottle neck - if a hashmap is created,
   * it reduces the searches and just sets the value each time.
   * returning just the values (or keys) would be quick??
   */
  usedPhrases ({start, end}) {
  //  console.log('usedPhrases between', start, end)

    const phrases = new Set()
    // load all the unique phrases
    for (let n = 1; n <= this.options.maxN; n++) {
      // add all the new phrases that are within the date range
      // change to a filter...
      this.ngrams[n].forEach(row => {
        //console.log('checking ', row.date, 'is between', start, end)
//        thatwill be the problem 0- do thisas a filter!!!
        if (row.date >= start && row.date < end) {
          phrases.add(row.ngram)
        }
      })
    }

    return [...phrases]
  }

  /**
   * Count the number of times that an ngrams has occurred within the
   * conditions of the options.
   *
   * @param ngram
   * @param options
   * @return int
   */
  count (ngram, options) {
    let matchingDocs = this.findDocs(ngram, options)
    return matchingDocs.length
  }

  /**
   * Preprocess the results to only retain the longest phrases. For example,
   * if we have "Tour de France", we don't really

   remove noise. Fo
   * Improvement: potentially sort results by length before processing.
   * @todo: move to trending component.
   */
  removeSubPhrases (trendPhrases) {
    for (let i = 0; i < trendPhrases.length; i++) {
      for (let j = i + 1; j < trendPhrases.length; j++) {
        if (TextHelpers.isSubPhrase(trendPhrases[i].phrase, trendPhrases[j].phrase)) {
          // keep the biggest one
          const spliceI = trendPhrases[i].length > trendPhrases[j].length ? j : i
          // remove the element from the array
          trendPhrases.splice(spliceI, 1)
          // start processing again from the element that was cut out
          i = j = spliceI
        }
      }
    }
    return trendPhrases
  }

  /**
   * Find all the doc ids for a given ngram, matching the options.
   */
  findDocs (ngram, options) {
    const history = this.ngramHistory[ ngram ]
    // I'm sure this can be written in a single line,
    // but it will probably be a proper pain to read/debug
    const historyInRange = history.occurances.filter(doc => {
      return (doc.date >= options.start && doc.date < options.end) && (!options.hasOwnProperty('subject') ||
        options.subject === this.docs[ doc.doc_id ].subject)
    })

    // pull out just the ids
    return historyInRange.map(ng => ng.doc_id)
  }
}
