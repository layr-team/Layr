const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const BatNode = require('../batnode.js').BatNode;
const kad_bat = require('../../kadence_plugin').kad_bat;
const seed = require('../../constants').LOCALSEED_NODE;
const fs = require('fs');
const fileUtils = require('../../utils/file').fileSystem;
const JSONStream = require('JSONStream');
const stellar_account = require('../kadence_plugin').stellar_account;
const crypto = require('crypto');
const base32 = require('base32');

//console.log(seed)

// Create second batnode kadnode pair

const kadnode2 = new kad.KademliaNode({
  transport: new kad.HTTPTransport(),
  storage: levelup(encoding(leveldown('./dbb'))),
  contact: { hostname: 'localhost', port: 9000 }
})

// Set up
kadnode2.plugin(kad_bat)
kadnode2.plugin(stellar_account);
kadnode2.listen(9000)
const batnode2 = new BatNode(kadnode2)
kadnode2.batNode = batnode2

const nodeConnectionCallback = (serverConnection) => {

  const stream = JSONStream.parse();
  serverConnection.pipe(stream);

  stream.on('data', (receivedData, error) => {

    if (receivedData.messageType === "RETRIEVE_FILE") {
      console.log("node 2 receivedData: ", receivedData); 
      const filePath = './hosted/' + receivedData.fileName;
      const readable = fs.createReadStream(filePath);
      readable.on('data', (chunk) => {
        serverConnection.write(chunk);
      });
  
      readable.on('end', () => {
        // enable to send as an separate individual chunk so client can receive message correctly
        setTimeout(function() {
          serverConnection.write("finish");
        }, 500);
        console.log(`finish sending ${receivedData.fileName}`)
      });
    } else if (receivedData.messageType === "STORE_FILE"){
      let fileName = receivedData.fileName
      batnode2.kadenceNode.iterativeStore(fileName, [batnode2.kadenceNode.identity.toString(), batnode2.kadenceNode.contact], (err, stored) => {
        console.log('nodes who stored this value: ', stored)
        let fileContent = new Buffer(receivedData.fileContent)
        let storeStream = fs.createWriteStream("./hosted/" + fileName);
        storeStream.write(fileContent, function (err) {
          if(err){
            throw err;
          }
          serverConnection.write(JSON.stringify({messageType: "SUCCESS"}));
        });
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
