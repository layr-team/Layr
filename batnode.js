const net = require('net');
const tcpUtils = require('./utils/tcp').tcp;


function BatNode(){
  const createServer = (TCPPort, host = '127.0.0.1') => {
    tcpUtils.createServer(TCPPort, host, (socket) => {
      socket.on('data', (data) => {
        console.log(data.toString())
      })
    })
  }
  const connect = tcpUtils.connect


  return {
    createServer,
    connect
  }
}

const node1 = BatNode()
node1.createServer(1237)

const node2 = BatNode()
node2.createServer(1238)

node2_client = node2.connect(1237, '127.0.0.1')
node2_client.write("I'm writing to node 1!")


// Next steps: Improved flexibility
// Be able to define how server should respond
// Be able to define how a client should react to server's response