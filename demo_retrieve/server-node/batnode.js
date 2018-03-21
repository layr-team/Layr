const BatNode = require('../../batnode').BatNode;
const PERSONAL_DIR = require('../../utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('../../utils/file').HOSTED_DIR;
const fileSystem = require('../../utils/file').fileSystem;

// Define callback for server to execute when a new connection has been made.
// The connection object can have callbacks defined on it
// Below is a node server that can respond to file retrieval requests or file storage requests

// When sending image data as part of JSON object, two JSON objects are sent, each sending an incomplete JSON object
// with only part of the image data
const node1ConnectionCallback = (serverConnection) => {
  serverConnection.on('end', () => {
    console.log('end')
  })
  serverConnection.on('data', (receivedData, error) => {

    receivedData = JSON.parse(receivedData);
    console.log("received data: ", receivedData);

    if (receivedData.messageType === "RETRIEVE_FILE") {
      node1.readFile(`./hosted/${receivedData.fileName}`, (error, data) => {
        serverConnection.write(data);
      });
    } else if (receivedData.messageType === "STORE_FILE"){
      node1.receiveFile(receivedData);
      serverConnection.write(JSON.stringify({messageType: "SUCCESS"}))
    }
  })
}




const node1 = new BatNode()
node1.createServer(1237,'127.0.0.1', node1ConnectionCallback, null)
//fileSystem.processUpload('./personal/example.txt')
//fileSystem.composeShards('./manifest/4f112a6ec12a710bc3cc4fba8d334ab09f87e2c4.batchain') //results in a decrypted-example.txt saved to personal dir
