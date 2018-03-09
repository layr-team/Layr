const net = require('net');
const tcpUtils = require('./utils/tcp').tcp;



class BatNode {
  constructor() {

  }

  createServer(port, host = '127.0.0.1', defineEvents){
    tcpUtils.createServer(port, host, defineEvents)
  }

  connect(port, host, callback) {
    return tcpUtils.connect(port, host, callback)
  }
}


const node1 = new BatNode()

node1.createServer(1237, '127.0.0.1', (serverSocket) => {
  serverSocket.on('data', (data) => {
    console.log(data.toString())
  })
})

const node2 = new BatNode()
node2.createServer(1238,'127.0.0.1')

node2_client = node2.connect(1237, '127.0.0.1')
node2_client.write("I'm writing to node 1!")


// Next steps: Improved flexibility
// Be able to define how bat node should respond to writes from a client based on what the client sent
// Be able to define how a client should react to server's response based on what the server sent back
// Serialize and deserialize data
