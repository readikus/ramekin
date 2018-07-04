# ramekin

An open source, real time trend detection library. This project uses machine learning to detect trends in text (i.e. news stories) over time.

Trends are identified by detecting phrases that start occurring much more frequently than those that don't typically occur. Various natural language processing and data science techniques are used to ensure similar words are modelled together (i.e. "cycle", "cycling", "cyclist") and .

Documents can be grouped by a subject, so it is possible to detect "localised" trends - for example, 7 articles talking about a new bike from Santa Cruz might.


## "Hello World" example

This is the simplest example. A very crude data file has been created with random text, and two "constructed" trends - one based on a trend in the "Tech" subject for "Ramekin trending" and another in cycling for "Chris Froome Tour de France".

First, install the NPM package for ramekin:

```
   npm i ramekinjs
```

Create a simple script:

```
   const Ramekin = require('ramekinjs');
   const ramekin = new Ramekin();

   // load all the example stories

   // load some stories
   ramekin.ingestAll({..});

   // process the trends
   ramekin.trending q(...); 
```


## Quick Start

There is a (currently insecure) API available for creating ramekins, adding news stories and getting the current trends from them.





## Configurable:

History Window - how far back you want to look for your history to determine typical usage of a particular phrase. During the build, we have found 90 days gives a good balance of coverage and computation.

Balance - ability to configure what consitutes a spike for a trend. It's important that this is kept relative to the particular term used. For example, if the word "cycle" typically occurs in 100 posts per day in the cycling category, if it then occurs an extra 10 times that's not massively significant. However if the phrase "Santa Cruz Hightower" typically occurs once or twice per month (which seems reasonable, given that it's an established product), if Santa Cruz release a new iteration of the bike, and 10 articles appear about the bike within a small time period, then that would be more statistically significant.


- ensure similar phrases are modelled as one. i.e. "cycle", "cycling", "cyclist".





## Document format:

Documents need to be loaded in the following format:

## Roadmap

* Tidy up data when it's loaded (i.e. prune documents that have fallen outside the window.
* Fix filtering with subject-based trending works.




## Automated tests:


## Microservice

Automated tests:








as documents 

detected 


By looking at the usage of phrases over a 

particular


## How does it work?

...blog post.






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
 * DONE Rank documents for each cluster. The more phrases covered, the higher they rank, if these are equal, rank by the length of the sentence. 
 *
 * Blog article talking about how it works.
 * Road map in the readme
 * Readme
 * Road map - scaleable, presistence, increased configurability.
 *   API app. API security.
 *
 * * Medium blog
 * * 



