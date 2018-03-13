// Import dependencies
const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');

const node = kad({
  transport: new kad.HTTPTransport(),
  storage: levelup(encoding(leveldown('./db'))),
  contact: { hostname: 'localhost', port: 1337 }
});

exports.node = node;
