const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const BatNode = require('../../batnode').BatNode;
const kad_bat = require('../../kadence_plugin').kad_bat;
const seed = require('../../constants').SEED_NODE
const backoff = require('backoff');

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
      let fibonacciBackoff = backoff.exponential({
          randomisationFactor: 0,
          initialDelay: 20,
          maxDelay: 2000
      });
      console.log("received path: ", filePath);
      batnode3.auditFile(filePath);

      // post audit cleanup
      serverConnection.on('close', () => {
        batnode3._audit.ready = false;
        batnode3._audit.data = null;
        batnode3._audit.passed = false;
      });

      fibonacciBackoff.failAfter(10);

      fibonacciBackoff.on('backoff', function(number, delay) {
          console.log(number + ' ' + delay + 'ms');
      });

      fibonacciBackoff.on('ready', function() {
        if (!batnode3._audit.ready) {
          fibonacciBackoff.backoff();
        } else {
          console.log('batnode3._audit.data', batnode3._audit.data);
          serverConnection.write(JSON.stringify(batnode3._audit.data));
          return;
        }
      });

      fibonacciBackoff.on('fail', function() {
        console.log('Timeout: failed to complete audit');
      });

      fibonacciBackoff.backoff();
    }
  });
}

batnode3.createCLIServer(1800, 'localhost', nodeCLIConnectionCallback);
