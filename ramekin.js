/**
 * 0.1 requirements:
 *
 * Able to take a load of docs and give trends (by category).
 * Supply with example data across a range of subjects.
 * Mirror the data feeds that go into something like mashable.com
 *
 * Given some example feeds, with different subjects, find the trends 
 * on a given day for each subject. Able to present the subjects, and the
 * documents that are clustered into the trends.
 * Implement the @todos.
 * Make it work with bikefeast?
 * gc
 *  
 * Blog article talking about how it works.
 * Road map in the readme
 * Readme
 * Road map - scaleable, presistence, increased configurability.
 *   API app. API security.
 *
 * * Medium blog
 * * 
 * Added stop word removal.
 */
var extend         = require('extend');
var moment         = require('moment');
var natural        = require('natural');
var NGrams         = natural.NGrams;

// Load the full build. 
var _ = require('lodash');
// Load the core build. 
//var _ = require('lodash/core');

var Ramekin = function( options ) {

  this.options = extend({
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

    historyFrequencyTolerance: 1.6,

    similarityThreshold: 0.3

  }, options);

  // initialise the multi-dimensional ngram array storage
  this.ngrams = _.fill( Array( this.options.maxN + 1 ), [] );

  // track the usage of the ngrams
  this.ngramHistory = {};

  this.docs = {};

  // setup stemming
  natural.PorterStemmer.attach();

};


Ramekin.prototype.ingestNGram = function( ngram, doc ) {

  var ng = {
    date: doc.date,
    ngram: ngram,
    subject: doc.subject
  };

  this.ngrams[ ngram.length ].push( ng );

  // ngram history

  // initialised hash element
  if ( !this.ngramHistory.hasOwnProperty( ngram ) ){
    this.ngramHistory[ ngram ] = { occurances: [] };
  }
      
  // only setting each word once - something fishy!!!!!
  this.ngramHistory[ ngram ].occurances.push( {date: doc.date, doc_id: doc._id} );

}

/**
 * Text analysis stage to take some raw text and convert
 * it into a format that we can ingest optimally.
 * @todo: create a function to covert map the original text
 * with the normalised version.
 */
Ramekin.prototype.normalise = function( s ) {

  // normalise the body text (handling stop words)
  return s.tokenizeAndStem(this.options.keepStops).join(" ");

};

/**
 * Added option for remove stop words.
 */
Ramekin.prototype.ingest = function( doc ) {

  // we may need to revisit what doc data we store
  this.docs[ doc.doc_id ] = doc;

  // console.log("Ingesting:", doc);
  // generate all the [1...n]-grams for the document
  for( var n = 1; n <= this.options.maxN; n++ ){

    // create ngrams from the normalised text
    var ngrams = NGrams.ngrams( this.normalise(doc.body), n );

    // ingest all the ngrams
    for( var i = 0; i < ngrams.length; i++ ){
      this.ingestNGram( ngrams[i], doc );
    }

  }

};

Ramekin.prototype.ingestAll = function(docs) {

  for( var i = 0; i < docs.length; i++ ){
    this.ingest(docs[i]);
  }
  //console.log("ngramHistory", JSON.stringify(this.ngramHistory));
  //process.exit();
};

Ramekin.prototype.trending = function(options) {

  // only set defaults if no start date is set.
  if( !options.hasOwnProperty("start")){
    options.start = new Date(), options.end = new Date();
    options.start.setDate(options.end.getDate() - 1);
  }

  // get the history window dates
  if( !options.hasOwnProperty("historyStart") ){
    options.historyEnd = new Date(options.start);
    options.historyStart = moment(options.historyEnd).subtract(this.options.historyDays, 'day').toDate();
  }

  console.log("trending.options:",options);

  // find all the common phrases used in respective subject, over the past day
  var usedPhrases = this.usedPhrases( options );
  var trendPhrases = [];

  // score each phrase from the trend period compared to it's historic use
  for( var i = 0; i < usedPhrases.length; i++ ){

    //   score if the phrase has trended in the last 24 hours
    var trendRangeCount = this.count( usedPhrases[i], {start: options.start, end: options.end});
    var historyRangeCount = this.count( usedPhrases[i], {start: options.historyStart, end: options.historyEnd});
    var historyDayAverage = historyRangeCount / (this.options.historyDays);

    // add in the tolerance
    historyDayAverage *= this.options.historyFrequencyTolerance;

    // if it's above the average
    if( (trendRangeCount > this.options.minTrendFreq) &&
        (trendRangeCount > historyDayAverage ) ){

      var score = trendRangeCount / (historyDayAverage+1);
      phrase = {phrase: usedPhrases[i], score: score, 
        historyRangeCount: historyRangeCount,
        trendRangeCount: trendRangeCount
        };

      /*console.log( JSON.stringify( usedPhrases[i]) + "\t" +
        trendRangeCount + "\t" +
        historyRangeCount + "\t" +
        historyDayAverage );*/
      trendPhrases.push( phrase );
    }

  }

  console.log( "Trend phrases before removing duplicates:", trendPhrases );
  // remove sub phrases (i.e. "Tour de", compared to "Tour de France")
  trendPhrases = this.removeSubPhrases( trendPhrases );
  console.log( "Trend phrases after removing duplicates:", trendPhrases );




  // rank results
  //@todo: needs making nicer
  trendPhrases.sort(function(a,b){
/*    if ( a.phrase.historyRangeCount == b.phrase.historyRangeCount ){
      return b.phrase.length - a.phrase.length;
    }else{
      return a.historyRangeCount - b.historyRangeCount;
    }
*/
    return b.score - a.score;
  });

  console.log("sorted trendPhrases",trendPhrases);

   // remove/cluster overlapping phrases (i.e. "Tour de" and "Tour de France")
  //  if ( trendPhrases.length > 1 ){
  var trends = this.simpleCluster(trendPhrases, options);
  console.log("\r\n\r\n\r\n\r\nSimple Clusterd Phrases:",JSON.stringify(trends));
  process.exit();

//    console.log("trends:",trends);
//    console.log("after similarity");
  //  if(){
//
  //  }

    // if they are similar, cluster!!

    // maybe compute a similarity matrix at the start??

   // process.exit();

 // }

  // match normalised phrases to their


  return trends;

};



/**
 * Calculates the similarity between an array of phrases.
 * It's a bit basic, but similarity = # docs in all phrases / total docs
 */
/*Ramekin.prototype.similarity = function(phrases, options) {

  console.log("Ramekin.prototype.similarity:", phrases, options);

  var allDocIds = [];
  var that = this;

  // find *all* docs
  _.forEach(phrases, function(phrase, key) {
    console.log("phrase:",phrase);

    allDocIds = allDocIds.concat( that.findDocs( phrase, options ) );

  });

  // typically compares 2 phrases... 

  _.forEach( phrases, function(phrase, key) ) {


  }


  console.log("After phrases loop");

  process.exit();

  // calculate all the docs



};*/

/**
 * Calculates the similarity between an array of phrases.
 * It's a bit basic, but similarity = # docs in all phrases / total docs
 */
Ramekin.prototype.similarity = function(phraseA, phraseB, options) {

  console.log("Ramekin.prototype.similarity:", phraseA, phraseB, options);

  var allDocIds = [];
  var that = this;

  var docsA = this.findDocs(phraseA, options);
  var docsB = this.findDocs(phraseB, options);
  console.log("docsA:",docsA);
  console.log("docsB:",docsB);

  var matches = _.intersection( docsA, docsB );
//  var matches = _.intersectionWith(objects, others, _.isEqual);

  var disjunction = (docsA.length - matches.length) +
    (docsB.length - matches.length);

  var totalDocs = disjunction + (matches.length);

  var similarity = matches.length / Math.min( docsA.length, docsB.length );

  console.log("matches", matches);
  console.log("totalDocs", totalDocs);
  console.log("disjunction", disjunction);
  console.log("calculated similarity:", similarity);
  console.log("-------------");
/*
  Ramekin.prototype.similarity: [ 'chri' ] [ 'chri', 'froom' ] { start: Fri Jul 14 2017 01:00:00 GMT+0100 (BST),
  end: Sat Jul 15 2017 01:00:00 GMT+0100 (BST),
  historyEnd: Fri Jul 14 2017 01:00:00 GMT+0100 (BST),
  historyStart: Tue Jul 04 2017 01:00:00 GMT+0100 (BST) }
docsA: [ '59690cbdab74ac5a9b92a44f',
  '596904510718e9290b402af8',
  '5968edd1a5d36822f9e65e8c',
  '5968f19052ce36391dc6dcb0',
  '5968b3ae90de69469ffe0f0c',
  '596875945413265afa2cf38c',
  '596853d736823d45237fbb3d' ]
docsB: [ '59690cbdab74ac5a9b92a44f',
  '596904510718e9290b402af8',
  '5968edd1a5d36822f9e65e8c',
  '5968f19052ce36391dc6dcb0',
  '5968b3ae90de69469ffe0f0c',
  '596875945413265afa2cf38c',
  '596853d736823d45237fbb3d' ]
matches [ '59690cbdab74ac5a9b92a44f',
  '596904510718e9290b402af8',
  '5968edd1a5d36822f9e65e8c',
  '5968f19052ce36391dc6dcb0',
  '5968b3ae90de69469ffe0f0c',
  '596875945413265afa2cf38c',
  '596853d736823d45237fbb3d' ]

*/
  return similarity;

};

/**
 * Returns true if one phrase is a sub phrase of the other.
 */
Ramekin.prototype.isSubPhrase = function(a, b) {

  // if either are empty, return false
  if(a.length==0||b.length==0){
    return false;
  }
  // swap phrases if a is less than b
  if( b.length > a.length){
    var swap = a;
    a = b;
    b = swap;
  }

  // cheat - for now, assume B is the smaller element
  var matchStart = a.indexOf( b[ 0 ] );

  // it was found, and check there is space
  if( (matchStart >= 0) && 
    ((matchStart + b.length) <= a.length) ){

    // check the rest matches
    for (var j = 1; j < b.length; j++){
      if( b[ j ] != a[ matchStart + j ] ){
        return false;
      }
    }
    return true;
  }
  return false;

};


/**
 * Improvement: potentially sort results by length before processing.
 */
Ramekin.prototype.removeSubPhrases = function(trendPhrases) {

  for( var i = 0; i < trendPhrases.length; i++) {
    for( var j = i+1; j < trendPhrases.length; j++) {
      if( this.isSubPhrase( trendPhrases[i].phrase, trendPhrases[j].phrase ) ) {
        // keep the biggest one
        var spliceI = ( trendPhrases[i].length > trendPhrases[j] ) ? j : i;
        // remove the element from the array
        trendPhrases.splice( spliceI, 1 );
        // start processing again from the element that was cut out
        i = j = spliceI;
      }
    }
  }
  return trendPhrases;

};




Ramekin.prototype.simpleCluster = function( trendPhrases, options ){

  var trends = [];

  for( var i = 0; i < trendPhrases.length; i++ ){

    var trend = {phrases:[ trendPhrases[ i ] ] };
    trends.push( trend );

    for( var j = i + 1; j < trendPhrases.length; j++ ){

      var similarity = this.similarity( trendPhrases[i].phrase,
        trendPhrases[j].phrase, options);

      console.log( "measures:",similarity,this.options.similarityThreshold,
        (similarity >= this.options.similarityThreshold));

      // they appear similar
      if( similarity >= this.options.similarityThreshold ){
        console.log("Merging phrases ",trendPhrases[i],trendPhrases[j])         
        trend.phrases.push( trendPhrases[j] );
        // remove the element from the array, and update the iterator
        trendPhrases.splice(j,1);
        j--;
      }

    }
  }
  return trends;

};


Ramekin.prototype.cluster = function( trendPhrases, options ){

/*  var trends = [];

  for( var i = 0; i < trendPhrases.length; i++ ){

    var trend = {phrases:[ trendPhrases[ i ] ] };
    trends.push( trend );

    for( var j = i + 1; j < trendPhrases.length; j++ ){

      var similarity = this.similarity( trendPhrases[i].phrase,
        trendPhrases[j].phrase, options);

      console.log( "measures:",similarity,this.options.similarityThreshold,
        (similarity >= this.options.similarityThreshold));

      // they appear similar
      if( similarity >= this.options.similarityThreshold ){
        console.log("Merging phrases ",trendPhrases[i],trendPhrases[j])         
        trend.phrases.push( trendPhrases[j] );
        // remove the element from the array, and update the iterator
        trendPhrases.splice(j,1);
        j--;
      }

    }
  }
  return trends;*/

  var d = _.fill( Array( trendPhrases.length ), [] );

  // convert everything to a trend phrase
  //for( var i = 0; i < trendPhrases.length; i++ ){

  // populate the matrix
  for( var i = 0; i < trendPhrases.length; i++ ){
    d[i][i] = 0;
    for( var j = i + 1; j < trendPhrases.length; j++ ){
      d[i][j] = d[j][i] = this.similarity( trendPhrases[i].phrase,
        trendPhrases[j].phrase, options);
    }
  }

  // find closest match
  var closetMatch = function(d){   // Only visible inside Restaurant()
    var maxI = 0, maxJ = 0;
    // find the closest matches
    for( var i = 0; i < d.length; i++ ){
      for( var j = i+1;j<d.length;j++ ){
        if( d[i][j] > d[maxI][maxJ]){
          maxI = i, maxJ = j;
        }
      }
    }
    return {i: maxI, j: maxJ};
  }

  // perform the closest matches
  var merges = [];



  // find the closest matches
  for( var i = 0; i < trendPhrases.length; i++ ){

    var match = closetMatch(d)


  }

/*
*/

  //

 // console.log(d);
  //process.exit();
  // find the highest values
/*

    // cluster the most similar phrases...



  
  for( var i = 0; i < trendPhrases.length; i++ ){

    var trend = {phrases:[ trendPhrases[ 0 ] ] };
    trends.push( trend );

    for( var j = i + 1; j < trendPhrases.length; j++ ){

      var similarity = this.similarity( trendPhrases[i].phrase,
        trendPhrases[j].phrase, options);

      console.log( "measures:",similarity,this.options.similarityThreshold,
        (similarity >= this.options.similarityThreshold));

      // they appear similar
      if( similarity >= this.options.similarityThreshold ){
        console.log("Merging phrases ",trendPhrases[i],trendPhrases[j])         
        trend.phrases.push( trendPhrases[j] );
        // remove the element from the array, and update the iterator
        trendPhrases.splice(j,1);
        j--;
      }

    }
*/



};


/**
 * Find all the doc ids for a given ngram, matching the options.
 */
Ramekin.prototype.findDocs = function( ngram, options ){

  var history = this.ngramHistory[ ngram ];

  var that = this;

  // I'm sure this can be written in a single line, 
  // but it will probably be a proper pain to read/debug
  var historyInRange = _.filter(history.occurances, function(doc) { 
    return (doc.date >= options.start && doc.date < options.end)
      && (!options.hasOwnProperty("subject") ||
      options.subject == that.docs[ doc.doc_id ].subject );
  });

  // pull out just the ids
  return _.map(historyInRange, 'doc_id');

};

/**
 * Finds the phrases used in a particular date range
 * @todo: error handling.
 */
Ramekin.prototype.usedPhrases = function(options) {

//  var phrases = {};
  var phrases = [];//new Set();

  // load all the unique phrases
  for( var n = 1; n <= this.options.maxN; n++ ){

    // for each phrase
    for( var i = 0; i < this.ngrams[n].length; i++ ){

      var row = this.ngrams[n][i];
      /*console.log( "options.start: ", options.start );
      console.log( "ngram.date   : ", row.date );
      console.log( "ngram.ngram  : ", row.ngram );
      console.log( "options.end  : ", options.end );
      console.log( "after start  : ", (row.date >= options.start) );
      console.log( "befor end    : ", (row.date < options.end) );
      console.log( "-------------------------------------------------------");*/

      // ensure uniqueness and within the date range 
      if( ( _.findWhere(phrases, row.ngram) == null ) &&
       (row.date >= options.start && row.date < options.end) ){
        phrases.push(row.ngram);
      }
    }
  }

  return phrases;

};

/** @todo: update to use the hashmap */
Ramekin.prototype.count = function(ngram, options) {

  //var count = 0;
  //var n = ngram.length;
  var matchingDocs = this.findDocs( ngram, options );
  return matchingDocs.length;
/*)
  // @todo: refactor using the hash map
  // for each phrase
  for( var i = 0; i < this.ngrams[n].length; i++ ){
    var row = this.ngrams[n][i];
    if( _.isEqual(ngram, row.ngram) &&
      row.date >= options.start &&
      row.date < options.end ){
      count++;
    }
  }  
  return count;*/

};

module.exports = Ramekin;