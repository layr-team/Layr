const net = require('net');
const tcpUtils = require('../../utils/tcp').tcp;
const fileUtils = require('../../utils/file').fileSystem;

class BatNode {
  constructor() {}

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
    let client = this.connect(port, host, connectCallback) // connect to the target server with an optional callback
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

// Example of a node2 (client) requesting, retrieving, and writing a file from
// node1 (server).

const node2 = new BatNode()

// node2 issues request GET /127.0.0.1:1237
node2.retrieveFile('example.txt', 1237, '127.0.0.1', (data) => {
  data = JSON.parse(data)
  let contents = JSON.stringify(data.data)
  const successMessage = () => { console.log(`${data.fileName}-1 saved to file system!`) }
  node2.writeFile(`./stored/${data.fileName}-1`, contents, successMessage)
})


// Another example of BatNode usage...

// Below is the code that a node requires in order to enable it to store files sent to it

/*
const node2 = new BatNode()

node2.createServer(1238, '127.0.0.1', (serverSocket) => {
  serverSocket.on('data', node2.receiveFile.bind(node2)) // needs to be bound because this callback is called by a socket
})
*/
