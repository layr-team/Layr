const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const BatNode = require('../../batnode').BatNode;
const kad_bat = require('../../kadence_plugin').kad_bat;
const seed = require('../../constants').LOCALSEED_NODE;
const fileUtils = require('../../utils/file').fileSystem;
const fs = require('fs');
const JSONStream = require('JSONStream');

// Create first node... Will act as a seed node
const kadnode1 = new kad.KademliaNode({
  transport: new kad.HTTPTransport(),
  storage: levelup(encoding(leveldown('./db'))),
  contact: seed[1]
});

kadnode1.identity = seed[0]
kadnode1.listen(seed[1].port)
kadnode1.plugin(kad_bat)

const batnode1 = new BatNode(kadnode1) // create batnode
kadnode1.batNode = batnode1 // tell kadnode who its batnode is

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

batnode1.createServer(1756, '127.0.0.1', nodeConnectionCallback)
console.log('BatNode address: ',kadnode1.batNode.address)
console.log('KadNode contact: ',kadnode1.contact)
