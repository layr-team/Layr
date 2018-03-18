#!/usr/bin/env node

'use strict';

const batchain = require('commander');

console.log("Hello, welcome to batchain!");

batchain 
  .command('sample', 'see the sample nodes running')
  .parse(process.argv);


