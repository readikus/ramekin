/**
 * Simple clustering algorithm.
 */
var _              = require('lodash');

module.exports = exports = function( trendPhrases ){

  if( trendPhrases.length === 0 ){
    console.error("No phrases to cluster");
    return;
  }

  var d = [], c = [], minDistance = 0.81;
  // create initial clusters & populate the distance matrix
  for( var i = 0; i < trendPhrases.length; i++ ){
    c[i] = {phrases: [trendPhrases[i].phrase], docs: trendPhrases[i].docs};
    d[i] = [];
  }

  // find most match row, then match all those elements within
  // a certain similarity
  var closetMatch = function(d, threshold){
    // nothing left to cluster -> everything has already clustered
    if( d.length == 1 ){
      return null;
    }
    // @todo: add validation.
    var min = {i: 0, j: 1}; // point to the first non symetrical match
    // find the closest matches
    for( var i = 0; i < d.length; i++ ){
      for( var j = i+1;j<d.length; j++ ){
        if( (i != j) && (d[i][j] < d[min.i][min.j]) ){
          min.i = i, min.j = j;
        }
      }
    }
    console.log("d.length",d.length);
    if( d[min.i][min.j] > threshold ){
      console.log(d[min.i][min.j]+ " is above the threshold, so we won't be merging");
      return null;
    }
    //console.log( "closetMatch: ", min.i, min.j, d[min.i][min.j] );
    //console.log( d );
    return min;
  };

  var distance = function( a, b ){
    var matches = _.intersection( a.docs, b.docs );
    if( matches.length == 0 ){
      return 1;
    }
    return 1 - (matches.length / Math.min( a.docs.length, b.docs.length ));
  };

  var merge = function(i,j){
    // merge phrases
    i.phrases = i.phrases.concat( j.phrases );
    // merge docs & remove duplicates
    i.docs = _.uniq( i.docs.concat( j.docs ) );
    return i;
  };

  var hcluster = function( distance, merge, closetMatch, c, d, minDistance ){

    var formatD = function(d){
      var s = "";
      for( var i = 0; i < d.length; i++ ){
        for( var j = 0; j < d.length; j++ ){
          s+=d[i][j]+"\t";
        }
        s+="\r\n";
      }
      return s;
    };

    // calculate the initial distance matrix
    for (var i = 0; i < c.length; i++) {
      for (var j = 0; j <= i; j++) {
        d[i][j] = d[j][i] = (i == j) ? Infinity : 
          distance( c[i], c[j]);
      }
    }
    //console.log("initial matrix:"+formatD(d));
    var match = null;
    while( match = closetMatch(d,minDistance) ){

      //console.log("closetMatch: " + JSON.stringify(c[match.i].phrases) + ":" + JSON.stringify(c[match.j].phrases));
      //console.log("d BEFORE: "+formatD(d));

      c[ match.i ] = merge( c[match.i], c[match.j] );//  = function( i, j ){
      // remove the jth cluster
      c.splice( match.j, 1 );
      // remove the jth column
      for( var i = 0; i < d.length; i++ ){
        d[i].splice(match.j,1)
      }
      // remove the jth row
      d.splice( match.j,1);

      // recompute the distance matrix
      for( var i = 0; i < d.length; i++ ){
        d[match.i][i] = d[i][match.i] = i == match.i ? Infinity : distance( c[match.i], c[i] );
      }
    }
    return c;
  }

  hcluster( distance, merge, closetMatch, c, d, minDistance );
  //console.log(JSON.stringify(c));
  return c;
};