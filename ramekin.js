/**
 * Features:
 *
 * Added stop word removal.
 */
var cluster        = require('./cluster');
var extend         = require('extend');
var moment         = require('moment');
var natural        = require('natural');
var NGrams         = natural.NGrams;
var _              = require('lodash');

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

    // really not sure why I added this...assume it is to handle words that just didn't get mentioned in the history period.
    historyFrequencyTolerance: 1.6,

    similarityThreshold: 0.3,

    trendsTopN: 8

  }, options);

  // initialise the multi-dimensional ngram array storage
  this.ngrams = _.fill( Array( this.options.maxN + 1 ), [] );

  // track the usage of the ngrams
  this.ngramHistory = {};

  this.docs = {};

  // setup stemming
  natural.PorterStemmer.attach();

};







/**
 * ingestAll() ingests a set of documents into the current Ramekin.
 * @param {docs} a set of documents in the format expected format 
 *   (described above).
 {_id
 body
 subject}


 [{"date": JSON date
@todo: ingest dates in string format.
@todo: ingest doc.id,doc._id,doc.doc_id all as ID
@todo: 
 "body": The text of the document that is to be indexed by the Ramekin.
 _id": (string) Unique identifier for a document.
 "subject": (optional) (string) Free-text representation of a specific subject.

 */
Ramekin.prototype.ingestAll = function(docs) {

//  console.log("Ingesting",docs);
  for( let i = 0; i < docs.length; i++ ){
    this.ingest(docs[i]);
  }
};

/**
 * Added option for remove stop words.
 */
Ramekin.prototype.ingest = function( doc ) {

  // preprocess the date to check it's in the right format.
  if( !(doc.date instanceof Date) ){
    doc.date = new Date(doc.date);
  }

  console.log( "Ingesting", doc );

  // we may need to revisit what doc data we store
  this.docs[ doc._id ] = doc;

  // generate all the [1...n]-grams for the document
  for( let n = 1; n <= this.options.maxN; n++ ){

    // create ngrams from the normalised text
    let ngrams = NGrams.ngrams( this.normalise(doc.body), n );

    // ingest all the ngrams
    for( let i = 0; i < ngrams.length; i++ ){
      this.ingestNGram( ngrams[i], doc );
    }
    
  }

};


Ramekin.prototype.ingestNGram = function( ngram, doc ) {

  let ng = {
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
 * @todo: create a function to map the original text
 * with the normalised version.
 */
Ramekin.prototype.normalise = function( s ) {

  // normalise the body text (handling stop words)
  return s.tokenizeAndStem(this.options.keepStops).join(" ");

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

  console.log("There are ", usedPhrases.length, " used phrases");

  var trendPhrases = [];
  //var phraseDocs = {}; // duplicated data used later for sorting
  var docPhrases = {}; // duplicated data used later for sorting

  var setDocPhrases = function(docPhrases, docs, phrases){
    for(var i =0; i < docs.length; i++){
      var doc = docs[i];
      if( !docPhrases.hasOwnProperty(doc) ){
        docPhrases[ doc ] = [];
      }
      docPhrases[ doc ] = docPhrases[ doc ].concat( phrases );
    }
  };

  // score each phrase from the trend period compared to it's historic use
  for( var i = 0; i < usedPhrases.length; i++ ){

    // score if the phrase has trended in the last 24 hours
    var trendDocs = this.findDocs( usedPhrases[i], {start: options.start, end: options.end} );
    var trendRangeCount = trendDocs.length;
    var historyRangeCount = this.count( usedPhrases[i], {start: options.historyStart, end: options.historyEnd});
    var historyDayAverage = historyRangeCount / (this.options.historyDays);

    // add in the tolerance
    historyDayAverage *= this.options.historyFrequencyTolerance;

    // if it's above the average
    if( (trendRangeCount > this.options.minTrendFreq) &&
        (trendRangeCount > historyDayAverage ) ){

      var score = trendRangeCount / ( historyDayAverage + 1 );
      phrase = {phrase: usedPhrases[i], score: score, 
        historyRangeCount: historyRangeCount,
        trendRangeCount: trendRangeCount,
        docs: trendDocs
        };
      //phraseDocs[ usedPhrases[i] ] = trendDocs;
      trendPhrases.push( phrase );
      setDocPhrases( docPhrases, trendDocs, [phrase.phrase]);

    }

  }

  // remove sub phrases (i.e. "Tour de", compared to "Tour de France")
  trendPhrases = this.removeSubPhrases( trendPhrases );

  // rank results
  //@todo: needs making nicer
  trendPhrases.sort(function(a,b){
    return ( b.score == a.score ) ?
      b.phrase.length - a.phrase.length :
      b.score - a.score;
  });

  // trim to just options.trendsTopN
  /*if( trendPhrases.length > this.options.trendsTopN ){
    trendPhrases.splice( this.options.trendsTopN, 
      trendPhrases.length - this.options.trendsTopN );
  }*/

  // run the clustering - find the phrase that is most similar to so many others 
  //  (i.e. i, where sum(i) = max( sum() )
  var trends = cluster(trendPhrases);

  // rank the documents in each cluster, based on the docs etc.
  for(var i = 0; i < trends.length; i++){
    var trend = trends[i];
    var docs = [];
    // for each document in that trend, count the number of phrases that match
    for( var j = 0; j < trend.docs.length; j++){
      var doc = trend.docs[j];
      // count the number of phrases from the cluster that are in that doc
      var matches = _.intersection( docPhrases[ doc ], trend.phrases );
      docs.push({doc: doc, matches: matches.length});
    }
    // sort...
    docs.sort(function(a,b){
      return b.matches - a.matches;
    });

    // remove unnecessary sort data now it is sorted
    trend.docs = _.map(docs, 'doc');
  }

  // display a nicely formatted summary...
  for( var i = 0; i < trends.length; i++ ){

    console.log( "Trend " + (i+1) + " : ", this.docs[ trends[i].docs[0] ].body );

  }

  return trends;

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

  var phrases = [];
  // load all the unique phrases
  for( var n = 1; n <= this.options.maxN; n++ ){
    // for each phrase
    for( var i = 0; i < this.ngrams[n].length; i++ ){
      var row = this.ngrams[n][i];
      // ensure uniqueness and within the date range 
      if( ( _.findWhere(phrases, row.ngram) == null ) &&
       (row.date >= options.start && row.date < options.end) ){
        phrases.push(row.ngram);
      }
    }
  }
  return phrases;

};

Ramekin.prototype.count = function(ngram, options) {

  var matchingDocs = this.findDocs( ngram, options );
  return matchingDocs.length;

};

module.exports = Ramekin;