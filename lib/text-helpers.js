/**
 * Set of helper functions for processing text and trending.
 */
module.exports = class TextHelpers {

  /**
   * Returns true if one phrase is a sub phrase of the other.
   *
   * @params a (Array) an array of words
   * @params b (Array) another array of words
   * @return boolean - whether a or b is a sub-phrase of the other.
   */
  static isSubPhrase(a, b) {

    // if either are empty, return false
    if( a.length == 0 || b.length == 0 ){
      return false;
    }

    // swap phrases if a is less than b    
    if( b.length > a.length ){
      let swap = a;
      a = b;
      b = swap;
    }

    // Given that b is either the same or shorter than a, b will be a sub set
    // a, so start matching  similar shorter  find where the first match.
    let start = a.indexOf( b[ 0 ] );

    // it was found, and check there is space
    // Rewrite just subtract a from start .. (start + )
    if( ( start >= 0 ) && ( ( start + b.length ) <= a.length ) ) {

      // check the rest matches
      for ( let j = 1; j < b.length; j++ ){

        if( b[ j ] != a[ start + j ] ){

          return false;

        }

      }

      return true;

    }

    return false;

  }

}