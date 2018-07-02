# ramekin
An open source, real time trend detection library.

This project uses machine learning to detect trends in news stories.

## Quick Start

There is a (currently insecure) API available for creating ramekins, adding news stories and getting the current trends from them.

   npm i ramekinjs

Create a simple script:

   const Ramekin = require('ramekinjs');
   const ramekin = new Ramekin();

   // load some stories
   ramekin.ingestAll({..});

   ramekin.trends(...); 

## How does it work?

...blog post.