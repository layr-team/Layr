const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const BatNode = require('../batnode.js').BatNode;
const kad_bat = require('../../kadence_plugin').kad_bat;
const seed = require('../../constants').LOCALSEED_NODE;
const fileUtils = require('../../utils/file').fileSystem;
const fs = require('fs');
const JSONStream = require('JSONStream');
const stellar_account = require('../kadence_plugin').stellar_account;
const crypto = require('crypto');
const base32 = require('base32');


// Create first node... Will act as a seed node

const kadnode1 = new kad.KademliaNode({
  transport: new kad.HTTPTransport(),
  storage: levelup(encoding(leveldown('./db'))),
  contact: seed[1]
});


kadnode1.identity = seed[0]
kadnode1.plugin(kad_bat)
kadnode1.plugin(stellar_account);
kadnode1.listen(1338)


const batnode1 = new BatNode(kadnode1) // create batnode
kadnode1.batNode = batnode1 // tell kadnode who its batnode is

 // ask and tell other kad nodes who its batnode is
 const nodeConnectionCallback = (serverConnection) => {

  const stream = JSONStream.parse();
  serverConnection.pipe(stream);

  stream.on('data', (receivedData, error) => {

    if (receivedData.messageType === "RETRIEVE_FILE") {
      console.log("node 1 receivedData: ", receivedData); 
      const filePath = './hosted/' + receivedData.fileName;
      const readable = fs.createReadStream(filePath);
      readable.on('data', (chunk) => {
        serverConnection.write(chunk);
      });
  
      readable.on('end', () => {
        console.log(`finish sending ${receivedData.fileName}`)
      });
    } else if (receivedData.messageType === "STORE_FILE"){
      let fileName = receivedData.fileName
      batnode1.kadenceNode.iterativeStore(fileName, [batnode1.kadenceNode.identity.toString(), batnode1.kadenceNode.contact], (err, stored) => {
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
    } else if (receivedData.messageType === "PATCH_FILE") {
      console.log("node 2 receivedData: ", receivedData); 
      const filePath = './hosted/' + receivedData.fileName;
      const readable = fs.createReadStream(filePath);
      readable.on('data', (chunk) => {
        serverConnection.write(chunk);
      });
  
      readable.on('end', () => {
        // enable to send as a separate individual chunk so client can receive message correctly
        setTimeout(function() {
          serverConnection.write("finish");
        }, 500);
        console.log(`finish sending ${receivedData.fileName}`)
      });
    }
  })
}


batnode1.createServer(1756, '127.0.0.1', nodeConnectionCallback)
console.log(kadnode1.batNode.address)
