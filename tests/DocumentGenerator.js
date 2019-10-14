const moment = require('moment')

/**
 * Generates a date in the last n days
 */
function* generateDate (n) {
  while (true) {
    // generate a random number in the last n days
    const daysAgo = Math.floor(Math.random() * n) + 1
    const docDate = moment().subtract(daysAgo, 'days')
    yield docDate.toDate()
  }
}

/**
 * Generates a date in the last n days
 */
function* generateTextSequence (options) {
  while (true) {
    // generate number of words:
    const length = Math.floor((Math.random() * options.maxSentenceLength) + options.minSentenceLength)
    // generate a random number in the last n days
    yield Array.from({ length }, () => options.vocab[Math.floor(Math.random() * options.vocab.length)])
  }
}

const generateDocument = function* (options) {
  // setup generators for dates, subjects and text.
  const dateGen = generateDate(options.historyDays)
  const bodyGen = generateTextSequence(options)

  while (true) {
    const doc = {
      _id: Math.random().toString(),
      date: dateGen.next().value,
      subject: options.subjects[Math.floor(Math.random() * options.subjects.length)],
      body: bodyGen.next().value.join(' ')
    }
    yield doc
  }
}

module.exports = generateDocument
