const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const BatNode = require('../../batnode').BatNode;
const kad_bat = require('../../kadence_plugin').kad_bat;
const seed = require('../../constants').LOCALSEED_NODE
const fileUtils = require('../../utils/file').fileSystem;
const fs = require('fs');
const JSONStream = require('JSONStream');

// Create second batnode kadnode pair
const kadnode2 = new kad.KademliaNode({
  transport: new kad.HTTPTransport(),
  storage: levelup(encoding(leveldown('./dbb'))),
  contact: { hostname: 'localhost', port: 9000 }
})

// Set up
kadnode2.plugin(kad_bat)
kadnode2.listen(9000)
const batnode2 = new BatNode(kadnode2)
kadnode2.batNode = batnode2

const nodeConnectionCallback = (serverConnection) => {
  serverConnection.on('end', () => {
    console.log('end')
  })

  const stream = JSONStream.parse();
  serverConnection.pipe(stream);

  stream.on('data', (receivedData, error) => {
    if (error) { throw error; }
   console.log("received data: ", receivedData)

    if (receivedData.messageType === "RETRIEVE_FILE") {
      batNode.readFile(`./hosted/${receivedData.fileName}`, (err, data) => {
       serverConnection.write(data)
      })
    } else if (receivedData.messageType === "STORE_FILE"){
      let fileName = receivedData.fileName
      let nonce = Buffer.from(receivedData.nonce);
      let fileContent = Buffer.from(receivedData.fileContent)
      let preimage = fileUtils.sha1HashData(fileContent, nonce)
      let escrowAccountId = receivedData.escrow;
      batNode.acceptPayment(preimage, escrowAccountId)

      batNode.kadenceNode.iterativeStore(fileName, [batNode.kadenceNode.identity.toString(), batNode.kadenceNode.contact], (err, stored) => {
        console.log('nodes who stored this value: ', stored)
        batNode.writeFile(`./hosted/${fileName}`, fileContent, (writeErr) => {
          if (writeErr) {
            throw writeErr;
          }
          serverConnection.write(JSON.stringify({messageType: "SUCCESS"}))
        })
      })
    } else if (receivedData.messageType === "AUDIT_FILE") {
      fs.exists(`./hosted/${receivedData.fileName}`, (doesExist) => {
        if (doesExist) {
          fs.readFile(`./hosted/${receivedData.fileName}`, (err, data) => {
            const shardSha1 = fileUtils.sha1HashData(data);
            serverConnection.write(shardSha1);
          });
        } else {
          serverConnection.write("Shard not found")
        }
      })
    }
  })
}

batnode2.createServer(1900, '127.0.0.1', nodeConnectionCallback)


// Join:
kadnode2.join(seed)

console.log('BatNode address: ',kadnode2.batNode.address)
console.log('KadNode contact: ',kadnode2.contact)
