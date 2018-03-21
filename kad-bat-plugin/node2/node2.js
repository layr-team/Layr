const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const BatNode = require('../batnode.js').BatNode;
const kad_bat = require('../kadence_plugin').kad_bat;
const seed = require('../../constants').SEED_NODE
//console.log(seed)

// Create second batnode kadnode pair

kadnode2 = new kad.KademliaNode({
  transport: new kad.HTTPTransport(),
  storage: levelup(encoding(leveldown('./dbb'))),
  contact: { hostname: 'localhost', port: 9000 }
})

// Set up
kadnode2.listen(9000)
const batnode2 = new BatNode(kadnode2)
kadnode2.batNode = batnode2

batnode2.createServer(1900, '0.0.0.0')


// Join:

kadnode2.join(seed)