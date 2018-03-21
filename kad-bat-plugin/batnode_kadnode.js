const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const BatNode = require('./batnode.js').BatNode;
const kad_bat = require('./kadence_plugin').kad_bat;


// Create first batnode kadnode pair
const kadnode1 = new kad.KademliaNode({
  transport: new kad.HTTPTransport(),
  storage: levelup(encoding(leveldown('./db'))),
  contact: { hostname: 'localhost', port: 1338 }
});

console.log(kadnode1.identity.toString('base64'))

kadnode1.listen(1338)
//kadnode1.plugin(kad_bat)

const batnode1 = new BatNode(kadnode1) // create batnode
kadnode1.batNode = batnode1 // tell kadnode who its batnode is

 // ask and tell other kad nodes who its batnode is

batnode1.createServer(1237, '127.0.0.1')


// Create second batnode kadnode pair

kadnode2 = new kad.KademliaNode({
  transport: new kad.HTTPTransport(),
  storage: levelup(encoding(leveldown('./dbb'))),
  contact: { hostname: 'localhost', port: 9000 }
})

kadnode2.listen(9000)
//kadnode2.plugin(kad_bat)
const batnode2 = new BatNode(kadnode2)
kadnode2.batNode = batnode2



batnode2.createServer(1900, '127.0.0.1')


// Create a third batnode kadnode pair

kadnode3 = new kad.KademliaNode({
  transport: new kad.HTTPTransport(),
  storage: levelup(encoding(leveldown('./dbbb'))),
  contact: {hostname: 'localhost', port: 1252}
})


kadnode3.listen(1252)
const batnode3 = new BatNode(kadnode3)
kadnode3.batNode = batnode3

batnode3.createServer(1985, '127.0.0.1')


// Nodes join the network, treating kadnode1 as seed node:

kadnode2.join([kadnode1.identity, kadnode1.contact])
kadnode3.join([kadnode1.identity, kadnode1.contact], () => {
 kadnode1.iterativeFindNode('1ad1bf74da546db2888ade3f75a9d6af2c7f1849', (err, res) => { // finds a node closest to shard id
  console.log(kadnode1.identity.toString())
  let target = res[0];
  let targetBatNode = kadnode1.getOtherBatNodeContact(target, (err, res) => { // gets that node's batnode contact
    console.log(res) // should be {host: '127.0.0.1', port: 1900}
  })
  })
})

