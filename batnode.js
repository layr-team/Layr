const net = require('net');
const tcpUtils = require('./utils/tcp').tcp;



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
}


const node1 = new BatNode()

node1.createServer(1237, '127.0.0.1', (serverSocket) => { // Gives node 1 a server; callback executes when server is listening
  serverSocket.on('data', (data) => {                      // this callback is where to define specific event handlers for the server
    serverSocket.write("Hello, this is the server responding to the client!")
  })
})

const node2 = new BatNode()
node2.createServer(1238,'127.0.0.1') // This server will not generate responses to client requests because no callbacks have been defined on it

node2.sendDataToNode(1237, '127.0.0.1', null, "I'm writing to node 1!", (serverResponse) => {
  console.log(serverResponse.toString()) // This callback executes when the server has responded
})


// Next steps: Improved flexibility
// Be able to define how bat node should respond to writes from a client based on what the client sent
// Be able to define how a client should react to server's response based on what the server sent back
// Serialize and deserialize data
