const bunyan = require('bunyan');
const levelup = require('levelup');
const leveldown = require('leveldown');
const encoding = require('encoding-down');
const kad = require('@kadenceproject/kadence');
const BatNode = require('./batnode.js').BatNode;
const kad_bat = require('./kadence_plugin').kad_bat;
const seed = require('./constants').SEED_NODE
const publicIp = require('public-ip');

publicIp.v4().then(ip => {
  kadnode3 = new kad.KademliaNode({
    transport: new kad.HTTPTransport(),
    storage: levelup(encoding(leveldown('./dbbb'))),
    contact: {hostname: ip, port: 80}
  })
  
  // Set up
  kadnode3.plugin(kad_bat)
  kadnode3.listen(80)
  const batnode3 = new BatNode(kadnode3)
  kadnode3.batNode = batnode3

  const nodeConnectionCallback = (serverConnection) => {
    serverConnection.on('end', () => {
      console.log('end')
    })
    serverConnection.on('data', (receivedData, error) => {
     receivedData = JSON.parse(receivedData)
     console.log("received data: ", receivedData)
  
      if (receivedData.messageType === "RETRIEVE_FILE") {
        batnode1.readFile(`./hosted/${receivedData.fileName}`, (error, data) => {
         serverConnection.write(data)
        })
      } else if (receivedData.messageType === "STORE_FILE"){
        let fileName = receivedData.fileName
        batnode1.kadenceNode.iterativeStore(fileName, [batnode1.kadenceNode.identity.toString(), batnode1.kadenceNode.contact], (err, stored) => {
          console.log('nodes who stored this value: ', stored)
          let fileContent = new Buffer(receivedData.fileContent)
          batnode1.writeFile(`./hosted/${fileName}`, fileContent, (err) => {
            if (err) {
              throw err;
            }
            serverConnection.write(JSON.stringify({messageType: "SUCCESS"}))
          })
        })
      }
    })
  }

  batnode3.createServer(1900, ip, nodeConnectionCallback)
  
  // Join
  
  
  kadnode3.join(seed, () => {
    console.log('you have joined the network! Ready to accept commands from the CLI!')
    //batnode3.uploadFile('./personal/example.txt')
    //batnode3.retrieveFile('./manifest/a8fe349f81906570773853d82b52a8b6bedf2a36.batchain')
  })
  

})


// Paradigm for publicly accessible nodes

// capture public ip (which is the same as private ip if not behind NAT)
// start kad node and pass it public-ip, port 80
// start batnode server on public-ip, port 1900
// start cli server on localhost, port 1800
// kad node updates its contact info by connecting to tunneling server
// kad node joins a well known seed node

// Program is now ready to accept commands from CLI