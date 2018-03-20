const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const BatNode = require('../batnode.js').BatNode;
const kad_bat_interface = require('./kadence_plugin').kad_bat;
const howdy = require('./kadence_plugin').howdy;


// Create first batnode kadnode pair
const kadnode1 = new kad.KademliaNode({
  transport: new kad.HTTPTransport(),
  storage: levelup(encoding(leveldown('./db'))),
  contact: { hostname: 'localhost', port: 1338 }
});



kadnode1.listen(1338)
kadnode1.plugin(howdy)

const batnode1 = new BatNode(kadnode1) // create batnode
kadnode1.batNode = batnode1 // tell kadnode who its batnode is

 // ask and tell other kad nodes who its batnode is

batnode1.createServer(1237, '127.0.0.1')


// Create second batnode kadnode pair

kadnode2 = new kad.KademliaNode({
  transport: new kad.HTTPTransport(),
  storage: levelup(encoding(leveldown('./dbb'))),
  contact: { hostname: 'localhost', port: 1339 }
})

kadnode2.listen(1339)
kadnode2.plugin(howdy)
const batnode2 = new BatNode(kadnode2)
kadnode2.batNode = batnode2



batnode2.createServer(1900, '127.0.0.1')

// kadnode2 joins kadnode1's routing table

kadnode2.join([kadnode1.identity.toString('hex'), kadnode1.contact], () => {
  
  kadnode2.getOtherBatNodeContact([kadnode1.identity.toString('hex'), kadnode1.contact], (err, res) => {console.log(err,res)})
  //kadnode2.ping([kadnode1.identity.toString('hex'), kadnode1.contact], (err, res) => { console.log(err, res)})
})

// kadnode2 asks kadnode1 for its batnode's contact: should log {1237, '127.0.0.1'} if successful

/*kadnode2.getOtherBatNodeContact([kadnode1.identity,kadnode1.contact], (error, res)=> {
  console.log(res, 'result')
})*/
//kadnode2.howdy([kadnode1.identity.toString('hex'), kadnode1.contact], (err, res) => {console.log(err,res)})

//kadnode2.ping([kadnode1.identity, kadnode1.contact], () => { console.log('from callback')})