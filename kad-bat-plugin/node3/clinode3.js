const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const BatNode = require('../batnode.js').BatNode;
const kad_bat = require('../kadence_plugin').kad_bat;
const seed = require('../../constants').SEED_NODE

// Create a third batnode kadnode pair

const kadnode3 = new kad.KademliaNode({
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
  // batnode3.uploadFile('./personal/example.txt')
  //batnode3.retrieveFile('./manifest/a8fe349f81906570773853d82b52a8b6bedf2a36.batchain')
})

const nodeCLIConnectionCallback = (serverConnection) => {

  serverConnection.on('data', (data) => {
    let receivedData = JSON.parse(data);

    if (receivedData.messageType === "CLI_UPLOAD_FILE") {
      let filePath = receivedData.filePath;

      batnode3.uploadFile(filePath);
      batnode3.kadenceNode;
    } else if (receivedData.messageType === "CLI_DOWNLOAD_FILE") {
      let filePath = receivedData.filePath;

      batnode3.retrieveFile(filePath);
      batnode3.kadenceNode;
    }
  });
}

batnode3.createCLIServer(1800, 'localhost', nodeCLIConnectionCallback);
