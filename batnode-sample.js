const BatNode = require('batnode').BatNode;
const PERSONAL_DIR = require('./utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('./utils/file').HOSTED_DIR;

// Define callback for server to execute when a new connection has been made.
// The connection object can have callbacks defined on it
// Below is a node server that can respond to file retrieval requests or file storage requests
const node1ConnectionCallback = (serverConnection) => {
  serverConnection.on('data', (receivedData, error) => {
    receivedData = JSON.parse(receivedData)
    if (receivedData.messageType === "RETRIEVE_FILE") {
      let file = node1.readFile(`./stored/${receivedData.fileName}`, (error, data) => {
       returnData = {
         data,
         fileName: receivedData.fileName
       }
       serverConnection.write(JSON.stringify(returnData))
      })
    } else if (receivedData.messageType === "STORE_FILE"){
      node1.writeFile(`./stored/${receivedData.fileName}-1`, JSON.stringify(receivedData.fileContent))
    }
  })
}

node1.createServer(1237, '127.0.0.1', node1ConnectionCallback, node1ListenCallback)

// -------------------------------------
// Example of a second node retrieving a file from a node hosting the data

/*
const node2 = new BatNode()
node2.retrieveFile('example.txt', 1237, '127.0.0.1', (data) => {
  data = JSON.parse(data)
  let contents = JSON.stringify(data.data)
  node2.writeFile(`./stored/${data.fileName}-1`, contents)
})
*/


// ---------------------------------------
// Example of a node sending a file to the server

/*
const node2 = new BatNode()
node2.sendFile(1237, '127.0.0.1', './stored/example.txt', 'example.txt')
*/


// ---------------------------------------
// Another example of BatNode usage...

// Below is the code that a node requires in order to enable it to store files sent to it

/*
const node2 = new BatNode()

node2.createServer(1238, '127.0.0.1', (serverSocket) => {
  serverSocket.on('data', node2.receiveFile.bind(node2)) // needs to be bound because this callback is called by a socket
})
*/
