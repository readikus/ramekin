/**
 * Simple clustering algorithm.
 */
const _ = require('lodash')

class SimpleCluster {
  constructor (trendPhrases) {
    if (trendPhrases.length === 0) {
      console.error('No phrases to cluster')
      return
    }
    // let c = []
    this.minDistance = 0.81
    // create initial clusters & populate the distance matrix
    this.c = trendPhrases.map((phrase, i) => ({phrases: [trendPhrases.phrase], docs: trendPhrases.docs}))
    this.d = []
    this.d.fill([], 0, trendPhrases.length)
  }

  // find most match row, then match all those elements within
  // a certain similarity
  closetMatch (d, threshold) {
    // nothing left to cluster -> everything has already clustered
    if (d.length === 1) {
      return null
    }
    // @todo: add validation.
    var min = {i: 0, j: 1} // point to the first non symetrical match
    // find the closest matches
    for (let i = 0; i < d.length; i++) {
      for (let j = i + 1; j < d.length; j++) {
        if ((i !== j) && (d[i][j] < d[min.i][min.j])) {
          min.i = i
          min.j = j
        }
      }
    }
    console.log('d.length', d.length)
    if (d[min.i][min.j] > threshold) {
      console.log(d[min.i][min.j] + ' is above the threshold, so we won\'t be merging')
      return null
    }
    return min
  }

  distance (a, b) {
    // replace with Sets
    let matches = _.intersection(a.docs, b.docs)
    if (matches.length === 0) {
      return 1
    }
    return 1 - (matches.length / Math.min(a.docs.length, b.docs.length))
  }

  merge (i, j) {
    // merge phrases
    i.phrases = i.phrases.concat(j.phrases)
    // merge docs & remove duplicates
    i.docs = _.uniq(i.docs.concat(j.docs))
    return i
  }

  hcluster (distance, merge, closetMatch, c, d, minDistance) {
    /* const formatD = function (d) {
      let s = ''
      for (let i = 0; i < d.length; i++) {
        for (let j = 0; j < d.length; j++) {
          s += d[i][j] + '\t'
        }
        s += '\r\n'
      }
      return s
    } */

    // calculate the initial distance matrix
    for (let i = 0; i < c.length; i++) {
      for (let j = 0; j <= i; j++) {
        d[i][j] = d[j][i] = (i === j) ? Infinity : distance(c[i], c[j])
      }
    }
    // console.log("initial matrix:"+formatD(d));
    // the while condition could die???
    let match = null
    while ((match = closetMatch(d, minDistance)) !== undefined) {
      // console.log("closetMatch: " + JSON.stringify(c[match.i].phrases) + ":" + JSON.stringify(c[match.j].phrases));
      // console.log("d BEFORE: "+formatD(d));

      c[ match.i ] = merge(c[match.i], c[match.j])
      // remove the jth cluster
      c.splice(match.j, 1)
      // remove the jth column
      for (let i = 0; i < d.length; i++) {
        d[i].splice(match.j, 1)
      }
      // remove the jth row
      d.splice(match.j, 1)

      // recompute the distance matrix
      for (var i = 0; i < d.length; i++) {
        d[match.i][i] = d[i][match.i] = i === match.i ? Infinity : distance(c[match.i], c[i])
      }
    }
    return c
  }

  cluster () {
    this.hcluster(this.distance, this.merge, this.closetMatch, this.c, this.d, this.minDistance)
    // console.log(JSON.stringify(c));
    return this.c
  }
}

module.exports = SimpleCluster
