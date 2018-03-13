const BatNode = require('../../batnode').BatNode;
const PERSONAL_DIR = require('../../utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('../../utils/file').HOSTED_DIR;
const kadenceNode = require('../kadence2/kadence').node;

// Example of a node2 (client) requesting, retrieving, and writing a file from
// node1 (server).

const node2 = new BatNode(kadenceNode)

// node2 issues request GET /127.0.0.1:1237
node2.retrieveFile('example.txt', 1237, '127.0.0.1', (data) => {
  debugger;
  file = JSON.parse(data)
  let contents = JSON.stringify(file.data)
  const successMessage = (err) => {
    if (err) throw err;
    console.log(`${file.fileName}-1 saved to file system!`)
  }
  node2.writeFile(`./${HOSTED_DIR}/${file.fileName}-1`, contents, successMessage)
})


// Another example of BatNode usage...

// Below is the code that a node requires in order to enable it to store files sent to it

/*
const node2 = new BatNode()

node2.createServer(1238, '127.0.0.1', (serverSocket) => {
  serverSocket.on('data', node2.receiveFile.bind(node2)) // needs to be bound because this callback is called by a socket
})
*/
