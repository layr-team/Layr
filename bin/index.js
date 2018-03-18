#!/usr/bin/env node

'use strict';

const batstart = require('commander');

console.log("Hello, welcome to batstart!");

batstart 
  .command('sample', 'start to see the sample nodes running')
  .parse(process.argv);
