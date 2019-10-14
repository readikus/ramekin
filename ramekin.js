/**
 * Features:
 *
 * * Added stop word removal.
 * * Cluster related trends.
 * * Ingest dates in string format.
 * * Normalise text, so similar words are clustered (i.e. "cycle", "Cycle",
 *     "CycLING" etc.)
 */

const DAY_IN_MS = 86400000

// import * as cluster from './lib/simple-cluster'
// import * as TextHelpers from './lib/text-helpers'
// const TextHelpers = require('./lib/text-helpers')
const moment = require('moment')
// import * as natural from 'natural'
const natural = require('natural')

const { NGrams } = natural
// @todo: refactor as much of the _ functions into ES6+ code.
const _ = require('lodash')
const util = require('./lib/util')
const SimpleCluster = require('./lib/simple-cluster')


// helper function...
const setDocPhrases = (docPhrases, docs, phrases) => {
  docs.forEach(doc => {
    if (!docPhrases.doc) {
      // eslint-disable-next-line no-param-reassign
      docPhrases[doc] = []
    }
    // eslint-disable-next-line no-param-reassign
    docPhrases[doc] = docPhrases[doc].concat(phrases)
  })
}

module.exports = class Ramekin {
  constructor (options) {

    this.setOptions(options)
    // initialise the multi-dimensional ngram array storage
    this.ngrams = Array.from({ length: this.options.maxN + 1 }, () => [])
    // track the usage of the ngrams
    this.ngramHistory = {}
    // the documents
    this.docs = {}
    // setup stemming
    natural.PorterStemmer.attach()
  }

  setOptions (options) {

    this.options = {

      // a threshold for the minimum number of times a phrase has to occur
      // in a single day before it can even be considered a trend for a given subject.
      // @todo: work out a logical way of calculating this per category.
      minTrendFreq: 3,
      // the context of the number of days to consider for the history
      historyDays: 90,

      // the number of days over which to check for trends
      trendDays: 1,

      // the maximum size of the n-gram window
      maxN: 6,
      // remove stop words - why wouldn't you?!
      keepStops: false,
      // really not sure why I added this...assume it is to handle words that just didn't get mentioned in the history period.
      historyFrequencyTolerance: 1.6,
      // @todo: This is no longer used...(but I really think it should be)
      similarityThreshold: 0.4,
      // the maximum number of results to return.
      trendsTopN: 8,
      ...options
    }

    // @todo: make this slightly less horrific!
    // only set defaults if no start date is set.
    if (!this.options.start) {
      this.options.start = new Date()
      this.options.end = new Date()
      this.options.start.setDate(this.options.end.getDate() - this.options.trendDays)
    }

    // get the history window dates
    if (!this.options.historyStart) {
      this.options.historyEnd = new Date(this.options.start)
      this.options.historyStart = moment(this.options.historyEnd).subtract(
        this.options.historyDays, 'day').toDate()
    }

    // @todo: resize ngram array if N changes

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
   *     id: <Unique ID - can be any format>,
   *     body: "Text",
   *     date: <ISO Date format string, or JavaScript date object>,
   *     subject: <Any object>
   *   }
   */
  ingest (rawDoc) {
    // preprocess the date to check it's in the right format.
    if (!rawDoc.date) {
      throw new Error('No \'date\' field set for document')
    }

    const date = (!(rawDoc.date instanceof Date)) ? new Date(rawDoc.date) : rawDoc.date

    // ensure there is an id set
    if (!rawDoc.id) {
      throw new Error('No \'id\' field set for document')
    }

    // throw error if the document already exists in the ramekin
    if (this.docs[rawDoc.id]) {
      throw new Error(`Document ${rawDoc.id} has already been added to the ramekin`)
    }

    const doc = { ...rawDoc, date }
    // we may need to revisit what doc data we store
    this.docs[doc.id] = doc

    // generate all the [1...n]-grams for the document
    for (let n = 1; n <= this.options.maxN; n++) {
      // create ngrams from the normalised text
      // filter added
      const ngrams = NGrams.ngrams(this.normalise(doc.body), n).filter(ngram => ngram.length === n);

      // ingest all the ngrams
      ngrams.forEach(ngram => { this.ingestNGram(ngram, doc, n) })
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
  ingestNGram (ngram, doc, n) {
    // construct the storable ngram object
    this.ngrams[n].push({
      date: doc.date, // why do we store this?
      ngram,
      subject: doc.subject
    })
    // initialised hash element
    if (!this.ngramHistory[ngram]) {
      this.ngramHistory[ngram] = { occurances: [] }
    }
    this.ngramHistory[ngram].occurances.push({ date: doc.date, docid: doc.id });

    // add this to a queue to look for trends...this.isNGramTrending(ngram, doc);
  }

  //  change start and end time to be part of options early on...
  getNGramTrend (ngram, docPhrases, trendRangeDays) {

    // score if the phrase has trended in the last 24 hours
    const trendDocs = this.findDocs(ngram, { start: this.options.start, end: this.options.end })
    const trendRangeCount = trendDocs.length
    const historyRangeCount = this.count(ngram, { start: this.options.historyStart, end: this.options.historyEnd })
    const historyDayAverage = this.options.historyFrequencyTolerance * historyRangeCount / this.options.historyDays
    const trendDayAverage = trendRangeCount / trendRangeDays
    const historyTrendRangeRatio = (trendDayAverage / (historyRangeCount === 0 ? 0.000001 : historyDayAverage))

    // add in the tolerance

    // if it's above the average
    if ((trendRangeCount > this.options.minTrendFreq) && (trendRangeCount > historyDayAverage)) {
      const phrase = {
        phrase: ngram,
        score: historyTrendRangeRatio * ngram.length,
        historyRangeCount,
        trendRangeCount,
        historyDayAverage,
        historyTrendRangeRatio,
        docs: trendDocs
      }
      setDocPhrases(docPhrases, trendDocs, [ngram]);
      return phrase
    }
    return undefined
  }

  /**
   * Validate the trending options, setting defaults where necessary.
   * @todo: this whole block is manky and needs a refactor - setup, search and cluster
   */
  trending (options = {}) {
    // This is the really manky bit of code, that needs separating into a helper
    // class just for the trending, and ES6ing.

    // maybe make it take customer commands for timings - but in reality, it's going to be real time...

    // setup
    /*
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
    } */

    // end of setup

    // start of trending:search
    const { start, end } = { ...this.options, ...options }

    // find all the common phrases used in respective subject, over the past day
    const usedPhrases = this.usedPhrases({ start, end })
    // duplicated data used later for sorting
    const docPhrases = {}

    const trendRangeDays = (end - start) / DAY_IN_MS

    // score each phrase from the trend period compared to it's historic use
    // this is a reduce
    let trendPhrases = usedPhrases.reduce((acc, phrase) => {
      const trend = this.getNGramTrend(phrase, docPhrases, trendRangeDays);
      if (trend) {
        acc.push(trend)
      }
      return acc
    }, [])

    if (trendPhrases.length === 0) return []

    // remove sub phrases (i.e. "Tour de", compared to "Tour de France")
    trendPhrases = this.constructor.removeSubPhrases(trendPhrases)

    // rank results - @todo: needs making nicer
    trendPhrases.sort((a, b) => ((b.score === a.score) ? b.phrase.length - a.phrase.length : b.score - a.score)
    )

    // end of trending:search

    // start of trending:cluster

    // this bit works to here!!!

    // run the clustering - find the phrase that is most similar to so many
    // others (i.e. i, where sum(i) = max( sum() )
    const sc = new SimpleCluster(trendPhrases)
    const trends = sc.cluster()

    // rank the documents in each cluster, based on the docs etc.
    for (let i = 0; i < trends.length; i++) {
      const trend = trends[i]
      const docs = []

      // for each document in that trend, count the number of phrases that match
      for (let j = 0; j < trend.docs.length; j++) {
        const doc = trend.docs[j]

        /*
          let a = new Set([1,2,3]);
          let b = new Set([4,3,2]);

          let intersection = new Set(
            [...a].filter(x => b.has(x)));

        */
        // count the number of phrases from the cluster that are in that doc
        const matches = _.intersection(docPhrases[doc], trend.phrases).length
        docs.push({ doc, matches })
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

  static expandTrendData (trends, docs) {
    return trends.map(trend => {
      // load all the related docs
      const fullDocs = docs.filter(doc => trend.docs.includes(doc.id)).sort((event1, event2) => event1.date - event2.date)
      return { ...trend, fullDocs };
    });
  }

  /**
   * Finds the phrases used between a particular date range.
   * @todo: error handling.
   * @todo: this may be the main bottle neck - if a hashmap is created,
   * it reduces the searches and just sets the value each time.
   * returning just the values (or keys) would be quick??
   */
  usedPhrases ({ start, end }) {
    return Object.keys(this.ngrams.reduce((phrases, ngrams) => ngrams
      .filter(({ date }) => date >= start && date < end)
      .reduce((innerPhrases, { ngram }) => {
        // eslint-disable-next-line no-param-reassign
        innerPhrases[ngram] = true
        return innerPhrases
      }, phrases), {}))
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
    const matchingDocs = this.findDocs(ngram, options)
    return matchingDocs.length
  }

  /**
   * Preprocess the results to only retain the longest phrases. For example,
   * if we have "Tour de France", we don't really

   remove noise. Fo
   * Improvement: potentially sort results by length before processing.
   * @todo: move to trending component.
   */
  static removeSubPhrases (trendPhrases) {
    for (let i = 0; i < trendPhrases.length; i++) {
      for (let j = i + 1; j < trendPhrases.length; j++) {
        if (util.isSubPhrase(trendPhrases[i].phrase, trendPhrases[j].phrase)) {
          // keep the biggest one
          const spliceI = trendPhrases[i].length > trendPhrases[j].length ? j : i
          // remove the element from the array
          trendPhrases.splice(spliceI, 1)
          // start processing again from the element that was cut out
          i = spliceI
          j = spliceI
        }
      }
    }
    return trendPhrases
  }

  /**
   * Find all the doc ids for a given ngram, matching the options.
   */
  findDocs (ngram, options) {
    const history = this.ngramHistory[ngram]
    // I'm sure this can be written in a single line,
    // but it will probably be a proper pain to read/debug
    const historyInRange = history && history.occurances.filter(doc => {
      return (doc.date >= options.start && doc.date < options.end)
        && (!options.subject || options.subject === this.docs[doc.docid].subject)
    }) || []

    // pull out just the ids
    return historyInRange.map(ng => ng.docid)
  }
}
