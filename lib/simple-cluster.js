/**
 * Simple clustering algorithm.
 */
const _ = require('lodash')

class SimpleCluster {
  constructor (trendPhrases) {
    if (trendPhrases.length === 0) {
      // eslint-disable-next-line no-console
      console.error('No phrases to cluster')
      return
    }
    // let c = []
    this.minDistance = 0.1973
    // create initial clusters & populate the distance matrix
    this.c = trendPhrases.map(phrase => ({
      phrases: [phrase.phrase],
      docs: phrase.docs,
      score: [phrase.score]
    }))
    this.d = []
    this.d.fill([], 0, trendPhrases.length)
  }

  static formatD (d) {
    let s = ''
    for (let i = 0; i < d.length; i++) {
      for (let j = 0; j < d.length; j++) {
        s += `${d[i][j]}\t`
      }
      s += '\r\n'
    }
    return s
  }

  // find most match row, then match all those elements within
  // a certain similarity
  static closetMatch (d, threshold) {
    // nothing left to cluster -> everything has already clustered
    if (d.length === 1) {
      return undefined
    }
    // @todo: add validation.
    const min = { i: 0, j: 1 } // point to the first non symetrical match
    // find the closest matches
    for (let i = 0; i < d.length; i++) {
      for (let j = i + 1; j < d.length; j++) {
        if ((i !== j) && (d[i][j] < d[min.i][min.j])) {
          min.i = i
          min.j = j
        }
      }
    }
    // console.log('d.length', d.length)
    if (d[min.i][min.j] > threshold) {
      // eslint-disable-next-line no-console
      console.log(`${d[min.i][min.j]} is above the threshold, so we won't be merging`)
      return undefined
    }
    return min
  }

  static distance (a, b) {
    // replace with Sets
    const matches = _.intersection(a.docs, b.docs)
    if (matches.length === 0) {
      return 1
    }
    return 1 - (matches.length / Math.min(a.docs.length, b.docs.length))
  }

  static merge (i, j) {
    return {
      ...i,
      phrases: i.phrases.concat(j.phrases),
      score: i.score.concat(j.score),
      // merge docs & remove duplicates
      docs: _.uniq(i.docs.concat(j.docs))
    }
  }

  static hierachicalCluster (distance, merge, closetMatch, c, d, minDistance) {

    // calculate the initial distance matrix
    for (let i = 0; i < c.length; i++) {
      // eslint-disable-next-line no-param-reassign
      d[i] = d[i] || []
      for (let j = 0; j <= i; j++) {
        // console.log(c[i], c[j], distance(c[i], c[j]))
        const newDistance = (i === j) ? Infinity : distance(c[i], c[j])
        // eslint-disable-next-line no-param-reassign
        d[i][j] = newDistance
        // eslint-disable-next-line no-param-reassign
        d[j][i] = newDistance
      }
    }

    // the while condition could die???
    let match = closetMatch(d, minDistance)
    while ((match) !== undefined) {
      // eslint-disable-next-line no-param-reassign
      c[match.i] = merge(c[match.i], c[match.j])
      // remove the jth cluster
      c.splice(match.j, 1)
      // remove the jth column
      for (let i = 0; i < d.length; i++) {
        d[i].splice(match.j, 1)
      }
      // remove the jth row
      d.splice(match.j, 1)

      // recompute the distance matrix
      for (let i = 0; i < d.length; i++) {
        const newDistance = i === match.i ? Infinity : distance(c[match.i], c[i])
        // eslint-disable-next-line no-param-reassign
        d[match.i][i] = newDistance
        // eslint-disable-next-line no-param-reassign
        d[i][match.i] = newDistance
      }

      // compute the next match
      match = closetMatch(d, minDistance)
    }
    return c
  }

  cluster () {
    this.constructor.hierachicalCluster(
      this.constructor.distance,
      this.constructor.merge,
      this.constructor.closetMatch,
      this.c,
      this.d,
      this.minDistance)
    return this.c
  }
}

module.exports = SimpleCluster
