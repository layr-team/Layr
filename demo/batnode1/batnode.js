const BatNode = require('../../batnode').BatNode;
const PERSONAL_DIR = require('../../utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('../../utils/file').HOSTED_DIR;

// Step 1: Create a node

const node1 = new BatNode()

// Step 2: Define callbacks for the node's server

// Define callback for server to execute when the "listening" event emits
// This will set the BatNode's address property
const node1ListenCallback = (server) => {
  node1.server = server
}

// Define callback for server to execute when a new connection has been made.
// The connection object can have callbacks defined on it
// Below, if a request of type "REQUEST_FILE" is received, the file is retrieved and returned
// To the client who requested it
const node1ConnectionCallback = (serverConnection) => {
  serverConnection.on('data', (receivedData, error) => {
    receivedData = JSON.parse(receivedData)
    if (receivedData.messageType === "REQUEST_FILE") {
      let file = node1.readFile(`./${HOSTED_DIR}/${receivedData.fileName}`, (error, data) => {
        returnData = {
          data,
          fileName: receivedData.fileName
        }
        serverConnection.write(JSON.stringify(returnData))
      })
    }
  })
}

// Step 3: Create Node's server

node1.createServer(1237, '127.0.0.1', node1ConnectionCallback, node1ListenCallback)

// Another example of BatNode usage...

// Below is the code that a node requires in order to enable it to store files sent to it

/*
const node2 = new BatNode()

node2.createServer(1238, '127.0.0.1', (serverSocket) => {
  serverSocket.on('data', node2.receiveFile.bind(node2)) // needs to be bound because this callback is called by a socket
})
*/
