const net = require('net');
const tcpUtils = require('./utils/tcp').tcp;
const fileUtils = require('./utils/file').fileSystem;


class BatNode {
  constructor() {

  }

  // TCP server
  createServer(port, host = '127.0.0.1', defineEvents){
    return tcpUtils.createServer(port, host, defineEvents)
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

  sendFile(port, host, filepath) {
    this.readFile(filepath, (error, data) => {
      let payload = {
        name: filepath,
        data: data
      }
      this.sendDataToNode(port, host, null, JSON.stringify(payload))
    })
  }

  receiveFile(data) {
    let payload = JSON.parse(data)
    let filename = payload.name
    let fileContents = JSON.stringify(payload.data)
    this.writeFile(`${filename}`, fileContents)
  }


}






const node1 = new BatNode()

node1.createServer(1237, '127.0.0.1', (serverSocket) => { // Gives node 1 a server; callback executes when server is listening
  serverSocket.on('data', (data) => {                      // this callback is where to define specific event handlers for the server
    //serverSocket.write("Hello, this is the server responding to the client!")
    console.log("This is the data I received from the client!\n")
    console.log(data.toString())
  })
})

/*
// Example of sending a string to a node:
node2.sendDataToNode(1237, '127.0.0.1', null, "I'm writing to node 1!", (serverResponse) => {
  console.log(serverResponse.toString()) // This callback executes when the server has responded
})
*/

// Reading from a file and asynchronously sending the data from the file to a target node
node1.sendFile(1238, '127.0.0.1', './stored/example.txt')



// Example of another node in a different process receiving a file:


/*
const node2 = new BatNode()

node2.createServer(1238, '127.0.0.1', (serverSocket) => { 
  serverSocket.on('data', node2.receiveFile.bind(node2)) // needs to be bound because this callback is called by a socket
})
*/
// Next steps:
// Receiving node writes the file data to their store folder
// Different data formats can be transmitted (images, videos, text, gif) with their format preserved
// BatNode has a max amount of bytes it can store: does not store if data > max (sending bat node sends data size as an initial "check" message)





