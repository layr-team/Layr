#!/usr/bin/env node

'use strict';

const bat_sample = require('commander');

// const BatNode = require('./batnode').BatNode;
// const PERSONAL_DIR = require('./utils/file').PERSONAL_DIR;
// const HOSTED_DIR = require('./utils/file').HOSTED_DIR;
// const fileSystem = require('./utils/file').fileSystem;

bat_sample
  .description("Demo")
  .option('-r, --run', 'run sample nodes')
  .parse(process.argv);



// Define callback for server to execute when a new connection has been made.
// The connection object can have callbacks defined on it
// Below is a node server that can respond to file retrieval requests or file storage requests

// When sending image data as part of JSON object, two JSON objects are sent, each sending an incomplete JSON object
// with only part of the image data
// const node1ConnectionCallback = (serverConnection) => {
//   serverConnection.on('data', (receivedData, error) => {
//    // console.log("received data: ", receivedData)
//     receivedData = JSON.parse(receivedData)
//     //console.log(receivedData, "FROM SERVER")

//     if (receivedData.messageType === "RETRIEVE_FILE") {
//       node1.readFile(`./hosted/${receivedData.fileName}`, (error, data) => {
//        serverConnection.write(data)
//       })
//     } else if (receivedData.messageType === "STORE_FILE"){
//       //let content = new Buffer(receivedData.fileContent, 'base64')
//       //node1.writeFile(`./hosted/${receivedData.fileName}`, content)
//       node1.receiveFile(receivedData)
//     }
//   })
// }

function runSampleNode() {
  console.log("Created node1");
}

if (bat_sample.run) {
  runSampleNode();
}

// const node1 = new BatNode()
// node1.createServer(1237,'127.0.0.1', node1ConnectionCallback, null)
//fileSystem.processUpload('./personal/example.txt')
//fileSystem.composeShards('./manifest/4f112a6ec12a710bc3cc4fba8d334ab09f87e2c4.batchain') //results in a decrypted-example.txt saved to personal dir







