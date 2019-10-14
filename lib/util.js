const intersection = (a, b) => {
  const setB = new Set(b);
  return Array.from(new Set(a.filter(x => setB.has(x))))
}

/**
   * Returns true if one phrase is a sub phrase of the other.
   *
   * @params a (Array) an array of words
   * @params b (Array) another array of words
   * @return boolean - whether a or b is a sub-phrase of the other.
   */
const isSubPhrase = (phraseA, phraseB) => {

  // if either are empty, return false
  if (phraseA.length === 0 || phraseB.length === 0) {
    return false
  }

  // swap phrases if a is less than b
  const [a, b] = phraseB.length > phraseA.length ? [phraseB, phraseA] : [phraseA, phraseB]

  // Given that b is either the same or shorter than a, b will be a sub set
  // a, so start matching  similar shorter  find where the first match.
  const start = a.indexOf(b[0])

  // it was found, and check there is space
  // Rewrite just subtract a from start .. (start + )
  if ((start >= 0) && ((start + b.length) <= a.length)) {
    // check the rest matches
    for (let j = 1; j < b.length; j++) {
      if (b[j] !== a[start + j]) {
        return false
      }
    }
    return true
  }
  return false
}

module.exports = {
  intersection,
  isSubPhrase
}
