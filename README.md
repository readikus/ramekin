# ramekin

An open source, real time trend detection framework. This project uses machine learning to detect trends in text over time.

Trends are identified by detecting phrases that start occurring much more frequently than those that don't typically occur. Various natural language processing and data science techniques are used to ensure similar words are modelled together (i.e. "cycle", "cycling" and "cyclist" all reduce down to a common word form, such as "cycle").

Documents can be grouped by a subject, so it is possible to detect "localised" trends - for example, 7 articles talking about a new bike from Santa Cruz might. Similar phrases tend to relate to a particular trend, so hierachical clustering is used to make sure documents related to the same trend are grouped, rather than creating two "trends" about the same thing. For example, "doping scandal" and "Tour de France" are likely to be about the same thing...allegedly.

Keywords: trending, trends, news, natural language processing, NLP, machine learning, artificial intelligence, data science, hierarchical clustering.

# Quick Start

## Document format

Documents need to be ingested into a ramekin using the following format:
```
{
  id: <Unique ID - can be any format>,
  body: "Text",
  date: <ISO Date format string, or JavaScript date object>,
  subject: <Any object>
}
```

## "Hello World" example

This is the simplest example. A very crude data file has been created with random text, and two "constructed" trends - one based on a trend in the "Tech" subject for "Ramekin trending" and another in cycling for "Chris Froome Tour de France".

First, install the NPM package for ramekin:

```
   npm i ramekin
```

Create a simple script that ingests the data from this file, and detects the trends:

```
   const Ramekin = require('ramekin');
   const ramekin = new Ramekin();

   // load all the example stories

   // load some stories
   ramekin.ingestAll({..});

   // process the trends
   ramekin.trending(...); 
```

In a practical example, you will want to look at the last few days. The following code snippet lets you do this:

```
  get the last 2 days and pass as options...
```  

# Configurable

History Window - how far back you want to look for your history to determine typical usage of a particular phrase. During the build, we have found 90 days gives a good balance of coverage and computation.

Balance - ability to configure what consitutes a spike for a trend. It's important that this is kept relative to the particular term used. For example, if the word "cycle" typically occurs in 100 posts per day in the cycling category, if it then occurs an extra 10 times that's not massively significant. However if the phrase "Santa Cruz Hightower" typically occurs once or twice per month (which seems reasonable, given that it's an established product), if Santa Cruz release a new iteration of the bike, and 10 articles appear about the bike within a small time period, then that would be more statistically significant.

# Roadmap

* Eslint code to an ES8 standard
* Modularise clustering
* Remove lodash dependancy.
* Implement/reimplment unit tests in Jasmine.
* Extract clustering algorithm to a separate module/reuse an existing module.
* Blog article talking about how it works.
* Improve error handling
* Implement the @todos.
* Tidy up data when it's loaded (i.e. prune documents that have fallen outside the window.
* Fix filtering with subject-based trending works.
* Backgroud recalculate trends when a new document is added (configurable).
* Persistence/redis.
* Run at scale.

# Automated tests:

Unit tests:

* ensure similar phrases are modelled as one. i.e. "cycle", "cycling", "cyclist".
* provide 100% coverage for each function within the Ramekin class.

# Microservice

There will be an (initially insecure) API available for creating ramekins, adding news stories and getting the current trends from them.

* Able to take a load of docs and give trends (by category).
* Supply with example data across a range of subjects.
* DONE Rank documents for each cluster. The more phrases covered, the higher they rank, if these are equal, rank by the length of the sentence.

# Thanks & Credits

Thanks to montemishkin for handing over the ramekin NPM package.
Thanks to everyone involved with the natural NPM package.