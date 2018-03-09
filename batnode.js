const net = require('net');
const tcpUtils = require('./utils/tcp').tcp;
const fileUtils = require('./utils/file').fileSystem;


class BatNode {
  constructor() {
    
  }

  // TCP server
  createServer(port, host = '127.0.0.1', connectionCallback, listenCallback){
    return tcpUtils.createServer(port, host, connectionCallback, listenCallback)
  }

  get address() {
    return this._address
  }

  set address(address) {
    this._address = address
  }

  // TCP client
  connect(port, host, callback) {
    return tcpUtils.connect(port, host, callback) // Returns a net.Socket object that can be used to read and write
  }                                               // from the TCP stream

  // Send data as tcp client
  sendDataToNode(port, host, connectCallback, payload, respondToServer){
    let client = this.connect(port, host, connectCallback) // connect to the target server with an optional callbacl
                                                           // that executes when the connection is established
    client.on('data', (data) => { // event handler that is called when the server responds
      respondToServer(data)
    })

    client.write(payload) // sends data to the server through the TCP stream
  }

  // Read data from a file
  readFile(filePath, callback) {
    return fileUtils.getFile(filePath, callback)
  }
  writeFile(path, data, callback) {
    fileUtils.writeFile(path, data, callback)
  }

  sendFile(port, host, filepath, filename) {
    this.readFile(filepath, (error, data) => {
      let payload = {
        name: filename,
        data: data
      }
      this.sendDataToNode(port, host, null, JSON.stringify(payload))
    })
  }

  receiveFile(data) {
    let payload = JSON.parse(data)
    let filename = payload.name
    let fileContents = JSON.stringify(payload.data)
    this.writeFile(`./stored/${filename}`, fileContents)
  }

  retrieveFile(fileName, port, host, retrievalCallback){
    let client = this.connect(port, host)
    let request = {
      messageType: "REQUEST_FILE",
      fileName
    }
    request = JSON.stringify(request)
    client.on('data', retrievalCallback)
    client.write(request)
  }


}




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
      let file = node1.readFile(`./stored/${receivedData.fileName}`, (error, data) => {
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



// Example of a second node retrieving a file from a node hosting the data
const node2 = new BatNode()

node2.retrieveFile('example.txt', 1237, '127.0.0.1', (data) => {
  data = JSON.parse(data)
  let contents = JSON.stringify(data.data)
  node2.writeFile(`./stored/${data.fileName}-1`, contents)
})






// Another example of BatNode usage...

// Below is the code that a node requires in order to enable it to store files sent to it

/*
const node2 = new BatNode()

node2.createServer(1238, '127.0.0.1', (serverSocket) => { 
  serverSocket.on('data', node2.receiveFile.bind(node2)) // needs to be bound because this callback is called by a socket
})
*/




