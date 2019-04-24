const SimpleCluster = require('./lib/simple-cluster')
const TextHelpers = require('./lib/text-helpers')
const util = require('./lib/util')

const moment = require('moment')
const natural = require('natural')
const NGrams = natural.NGrams

module.exports = class Ramekin {
  constructor (options) {
    this.options = {
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
        trendsTopN: 8,
        ...options}

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
    // preprocess the date to check it's in the right format.
    if (!doc.date) return

    if (!(doc.date instanceof Date)) {
      doc.date = new Date(doc.date)
    }

    // ensure there is an id set
    if (!doc.hasOwnProperty('_id')) {
      throw new Error('No \'_id\' field set for document')
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

  trendUsedPhrases (usedPhrases, { start, end, historyStart, historyEnd }) {
    // score each phrase from the trend period compared to it's historic use
    return usedPhrases.reduce((acc, phrase) => {
      // score if the phrase has trended in the last 24 hours
      const trendDocs = this.findDocs(phrase, { start, end })
      const historyRangeCount = this.count(phrase, { start: historyStart, end: historyEnd })
      const historyDayAverage = (historyRangeCount / this.options.historyDays) * this.options.historyFrequencyTolerance

      // if it's above the average
      if ((trendDocs.length > this.options.minTrendFreq) && (trendDocs.length > historyDayAverage)) {
        acc.push({ phrase,
          score: trendDocs.length / (historyDayAverage + 1),
          historyRangeCount,
          trendRangeCount: trendDocs.length,
          docs: trendDocs })
      }
      return acc
    }, [])
  }

  /**
   * Validate the trending options, setting defaults where necessary.
   * @todo: this whole block is manky and needs a refactor - setup, search and cluster
   */
  trending (initialOptions = {}) {

    const start = initialOptions.start || moment().subtract(1, 'day').toDate()
    const end = initialOptions.end || new Date()
    const historyEnd = initialOptions.historyEnd || initialOptions.start || moment().subtract(1, 'day').toDate()
    const historyStart = initialOptions.historyStart || moment(historyEnd).subtract(this.options.historyDays, 'day').toDate()
    console.log('trending on,', { start, end, historyEnd, historyStart })

    // start of trending:search

    // find all the common phrases used in respective subject, over the past day
    const usedPhrases = this.usedPhrases({ start, end, historyEnd, historyStart })
    console.log(`There are ${usedPhrases.length} used phrases and ${Object.keys(this.docs).length} docs`)
    // duplicated data used later for sorting
    let trendPhrases = this.trendUsedPhrases(usedPhrases, { start, end, historyStart, historyEnd })

    const docPhrases = trendPhrases.reduce((acc, {docs, phrase}) => {
      docs.forEach(doc => {
        acc[doc] = (acc[doc] || []).concat([ phrase ])
      })
      return acc
    }, {})

    if (trendPhrases.length === 0) return []

    // remove sub phrases (i.e. "Tour de", compared to "Tour de France")
    trendPhrases = this.removeSubPhrases(trendPhrases)

    // rank results - @todo: needs making nicer
    trendPhrases.sort((a, b) =>
      b.score === a.score ? b.phrase.length - a.phrase.length : b.score - a.score
    )

    // cluster similar trends - find the phrase that is most similar to so many
    // others (i.e. i, where sum(i) = max( sum() )
    const sc = new SimpleCluster(trendPhrases)
    const trends = sc.cluster()
    // rank the documents in each cluster, based on the docs etc.
    trends.forEach(trend => {
      const docs = trend.docs.map(doc => ({
        doc,
        matches: util.intersection(docPhrases[doc], trend.phrases).length
      }))
      docs.sort((a, b) => b.matches - a.matches)
      // remove unnecessary sort data now it is sorted
      trend.docs = docs.map(doc => doc.doc)
    })

    return trends
  }// currently line 280

  /**
   * Finds the phrases used in a particular date range.
   * @todo: error handling.
   * @todo: this may be the main bottle neck - if a hashmap is created,
   * it reduces the searches and just sets the value each time.
   * returning just the values (or keys) would be quick??
   */
  usedPhrases ({start, end}) {
    const filterRow = row => row.date >= start && row.date < end
    const phrases = new Set()
    // load all the unique phrases
    for (let n = 1; n <= this.options.maxN; n++) {
      this.ngrams[n].filter(filterRow).forEach(row => {
        phrases.add(row.ngram)
      })
    }
    return [...phrases]
  }// currently line 307

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

    if (history === undefined) return []

    return history.occurances.reduce((acc, doc) => {
      if ((doc.date >= options.start && doc.date < options.end) &&
        (!options.hasOwnProperty('subject') || options.subject === this.docs[ doc.doc_id ].subject)) {
          return acc.concat(doc.doc_id)
      }
      return acc
    }, [])
  }
}
