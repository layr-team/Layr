const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const BatNode = require('../batnode.js').BatNode;
const kad_bat = require('../kadence_plugin').kad_bat;
const seed = require('../../constants').SEED_NODE

// Create first node... Will act as a seed node

const kadnode1 = new kad.KademliaNode({
  transport: new kad.HTTPTransport(),
  storage: levelup(encoding(leveldown('./db'))),
  contact: seed[1]
});


kadnode1.identity = seed[0]
kadnode1.listen(1338)
//kadnode1.plugin(kad_bat)

const batnode1 = new BatNode(kadnode1) // create batnode
kadnode1.batNode = batnode1 // tell kadnode who its batnode is

 // ask and tell other kad nodes who its batnode is

batnode1.createServer(1756, '127.0.0.1')

