const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const BatNode = require('../batnode.js').BatNode;
const kad_bat = require('../kadence_plugin').kad_bat;
const seed = require('../../constants').SEED_NODE

// Create a third batnode kadnode pair

kadnode3 = new kad.KademliaNode({
  transport: new kad.HTTPTransport(),
  storage: levelup(encoding(leveldown('./dbbb'))),
  contact: {hostname: 'localhost', port: 1252}
})

// Set up
kadnode3.listen(1252)
const batnode3 = new BatNode(kadnode3)
kadnode3.batNode = batnode3
batnode3.createServer(1985, '127.0.0.1')

// Join


kadnode3.join(seed, () => {
  console.log('you have joined the network! Ready to accept commands from the CLI!')
  batnode3.getClosestBatNodeToShard('1ad1bf74da546db2888ade3f75a9d6af2c7f1849')
})
