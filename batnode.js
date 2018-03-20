const tcpUtils = require('./utils/tcp').tcp;
const fileUtils = require('./utils/file').fileSystem;
const path = require('path');
const PERSONAL_DIR = require('./utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('./utils/file').HOSTED_DIR;
const publicIp = require('public-ip');
const fs = require('fs');

class BatNode {
  constructor(kadenceNode = {}) {
    this._kadenceNode = kadenceNode;
    fileUtils.generateEnvFile()
  }

  // TCP server
  createServer(port, ip, connectionCallback, listenCallback){
    tcpUtils.createServer(port, ip, connectionCallback, listenCallback)
  }

  get address() {
    return this._address
  }

  set address(address) {
    this._address = address
  }

  get kadenceNode() {
    return this._kadenceNode
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

  sendFile(port, host, filepath, fileName) {
    this.readFile(filepath, (error, data) => {
      let payload = {
        messageType: "STORE_FILE",
        fileName,
        fileContent: data,
      }

      payload = JSON.stringify(payload)
    
      this.sendDataToNode(port, host, null, payload, null)
    })
  }
  // Send shards one at a time to only one node
  sendShards(port, host, shards){
    let shardIdx = 0
    let client = this.connect(port, host)

    client.on('data', (data) => {
      let serverResponse = JSON.parse(data).messageType
      console.log("Processing shard number: " + (shardIdx+1));
      if (shardIdx >= shards.length - 1){
        client.end();
      } else if (serverResponse === "SUCCESS" && shardIdx < shards.length - 1) {
        shardIdx += 1
        let message = {
          messageType: "STORE_FILE",
          fileName: shards[shardIdx],
          fileContent: fs.readFileSync(`./shards/${shards[shardIdx]}`)
        }
        client.write(JSON.stringify(message))
      }
    })

    let message = {
      messageType: "STORE_FILE",
      fileName: shards[shardIdx],
      fileContent: fs.readFileSync(`./shards/${shards[shardIdx]}`)
    }
    
    client.write(JSON.stringify(message))
    
    client.on('end', () => {
      console.log('upload end')
    })
  }
  
  // sendShardToNode(nodeInfo, shard, shardIdx) {
  //   let { port, host } = nodeInfo;
  //   let client = this.connect(port, host);

  //   nodeInfo.readyToWrite = 0;
  //   client.on('data', (data) => {
  //     let serverResponse = JSON.parse(data).messageType;
  //     if (serverResponse === "SUCCESS") {
  //       console.log('data event');
  //       nodeInfo.readyToWrite = 1;
  //     }
  //   });

  //   let message = {
  //     messageType: "STORE_FILE",
  //     fileName: shard,
  //     fileContent: fs.readFileSync(`./shards/${shard}`)
  //   };

  //   client.write(JSON.stringify(message));
  // }
  // sendShards(nodes, shards) {
  //   let shardIdx = 0;
  //   let nodeIdx = 0;
  
  //   while (shards.length > shardIdx) {
  //     let currentNodeInfo = nodes[nodeIdx];
  //     console.log(currentNodeInfo);
  //     // check if node is ready, if not try the next node
  //     while (!currentNodeInfo.readyToWrite) {
  //       console.log(!currentNodeInfo.readyToWrite);   // return true infinitely
  //       nodeIdx = this.nextNodeIdx(nodeIdx, shardIdx, nodes.length, shards.length);
  //       currentNodeInfo = nodes[nodeIdx];
  //     }

  //     this.sendShardToNode(currentNodeInfo, shards[shardIdx], shardIdx);

  //     shardIdx += 1;
  //     nodeIdx = this.nextNodeIdx(nodeIdx, shardIdx, nodes.length, shards.length);
  //   }
  // }
  // nextNodeIdx(nodeIdx, shardIdx, nodesCount, shardsCount) {
  //   let atTailNode = (nodeIdx + 1 === nodesCount);
  //   let remainingShards = (shardIdx + 1 < shardsCount);

  //   // nodeIdx = (atTailNode && remainingShards) ? 0 : nodeIdx + 1;
  //   if (atTailNode && remainingShards) {
  //     nodeIdx = 0;
  //   } else {
  //     nodeIdx += 1;
  //   }

  //   return nodeIdx;
  // }
  // Upload file will process the file then send it to the target node
  uploadFile(port, host, filePath){
    // Encrypt file and generate manifest
    const fileName = path.parse(filePath).base
    
    // change from hardcoded values to a method uploadDestinationNodes later
    const destinationNodes = [
      { host: '127.0.0.1' , port: 1237, readyToWrite: 1 },
      { host: '127.0.0.1' , port: 1238, readyToWrite: 1 }
    ];

    fileUtils.processUpload(filePath, (manifestPath) => {
      const shardsOfManifest = fileUtils.getArrayOfShards(manifestPath)

      this.sendShards(port, host, shardsOfManifest) 
      // this.sendShards(destinationNodes, shardsOfManifest);
    })
  }

  // Write data to a file in the filesystem. In the future, we will check the
  // file manifest to determine which directory should hold the file.
  receiveFile(payload) {
    let fileName = payload.fileName
    let fileContent = new Buffer(payload.fileContent)
    this.writeFile(`./${HOSTED_DIR}/${fileName}`, fileContent, (err) => {
      if (err) {
        console.log("Error!");
        throw err;
      }
    });
  }

  retrieveFile(manifestFilePath, port, host, retrievalCallback){
    let client = this.connect(port, host)
    let manifest = fileUtils.loadManifest(manifestFilePath)

    const shards = manifest.chunks
    const fileName = manifest.fileName
    let size = manifest.fileSize
    let retrievedFileStream = fs.createWriteStream(`./personal/${fileName}`)
    let currentShard = 0

    let request = {
      messageType: "RETRIEVE_FILE",
      fileName: shards[currentShard],
    }

    client.on('data', (data) => {
      size -= data.byteLength
      console.log(data.byteLength)
      retrievedFileStream.write(data)
      if (size <= 0){
        client.end()
      } else {
        currentShard += 1
        let request = {
          messageType: "RETRIEVE_FILE",
          fileName: shards[currentShard]
        }
        client.write(JSON.stringify(request))
      }
    })

    client.write(JSON.stringify(request))

    client.on('end', () => {
      console.log('end')
      fileUtils.decrypt(`./personal/${fileName}`)
    })
  }
}

exports.BatNode = BatNode;