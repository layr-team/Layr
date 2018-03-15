const BatNode = require('./batnode').BatNode;
const PERSONAL_DIR = require('./utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('./utils/file').HOSTED_DIR;
const fileSystem = require('./utils/file').fileSystem;




// Define callback for server to execute when a new connection has been made.
// The connection object can have callbacks defined on it
// Below is a node server that can respond to file retrieval requests or file storage requests

// When sending image data as part of JSON object, two JSON objects are sent, each sending an incomplete JSON object
// with only part of the image data
const node1ConnectionCallback = (serverConnection) => {
  serverConnection.on('data', (receivedData, error) => {
   // console.log("received data: ", receivedData)
    receivedData = JSON.parse(receivedData)
    //console.log(receivedData, "FROM SERVER")

    if (receivedData.messageType === "RETRIEVE_FILE") {
      node1.readFile(`./hosted/${receivedData.fileName}`, (error, data) => {
       serverConnection.write(data)
      })
    } else if (receivedData.messageType === "STORE_FILE"){
      //let content = new Buffer(receivedData.fileContent, 'base64')
      //node1.writeFile(`./hosted/${receivedData.fileName}`, content)
      node1.receiveFile(receivedData)
    }
  })
}




const node1 = new BatNode()
node1.createServer(1237, node1ConnectionCallback, null)




// -------------------------------------
// Example of a second node retrieving a file from a node hosting the data


/*
const node2 = new BatNode()
node2.retrieveFile('example.txt.crypt', 1237, '127.0.0.1')
*/




