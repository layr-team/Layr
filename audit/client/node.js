const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const BatNode = require('../../batnode').BatNode;
const kad_bat = require('../../kadence_plugin').kad_bat;
const seed = require('../../constants').SEED_NODE

// Create a third batnode kadnode pair
const kadnode3 = new kad.KademliaNode({
  transport: new kad.HTTPTransport(),
  storage: levelup(encoding(leveldown('./dbbb'))),
  contact: { hostname: 'localhost', port: 1252 }
});

// Set up
kadnode3.plugin(kad_bat)
kadnode3.listen(1252)
const batnode3 = new BatNode(kadnode3)
kadnode3.batNode = batnode3
batnode3.createServer(1985, '127.0.0.1')

// Join
kadnode3.join(seed, () => {
  console.log('you have joined the network! Ready to accept commands from the CLI!')
  batnode3.uploadFile('./personal/example.txt');
  // batnode3.retrieveFile('./manifest/85a2ea0f0d11634d334886d9fb073b0d64506199.batchain')
  // batnode3.auditFile('./manifest/85a2ea0f0d11634d334886d9fb073b0d64506199.batchain')
})

const nodeCLIConnectionCallback = (serverConnection) => {

  serverConnection.on('data', (data) => {
    let receivedData = JSON.parse(data);

    if (receivedData.messageType === "CLI_UPLOAD_FILE") {
      let filePath = receivedData.filePath;

      batnode3.uploadFile(filePath);
    } else if (receivedData.messageType === "CLI_DOWNLOAD_FILE") {
      let filePath = receivedData.filePath;

      batnode3.retrieveFile(filePath);
    } else if (receivedData.messageType === "CLI_AUDIT_FILE") {
      let filePath = receivedData.filePath;

      console.log("received path: ", filePath);
      const auditData = batnode3.auditFile(filePath);
      serverConnection.write(JSON.stringify({auditData}));
    }
  });
}

batnode3.createCLIServer(1800, 'localhost', nodeCLIConnectionCallback);
