const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const kad_bat = require('../kadence_plugin').kad_bat;
const stellar_account = require('../kadence_plugin').stellar_account;
const seed = require('../constants').LOCALSEED_NODE
const publicIp = require('public-ip');


publicIp.v4().then(ip => {
  console.log(ip, ' is my publicly accessible ip')
  const kademliaNode = new kad.KademliaNode({
    transport: new kad.HTTPTransport(),
    storage: levelup(encoding(leveldown('./db'))),
    contact: seed[1]
  });


  kademliaNode.identity = seed[0]
  kademliaNode.plugin(kad_bat)
  kademliaNode.plugin(stellar_account)
  kademliaNode.listen(seed[1].port)
})
