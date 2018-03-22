const tcpUtils = require('../utils/tcp').tcp;
const fileUtils = require('../utils/file').fileSystem;
const path = require('path');
const PERSONAL_DIR = require('../utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('../utils/file').HOSTED_DIR;
const publicIp = require('public-ip');
const fs = require('fs');

class BatNode {
  constructor(kadenceNode = {}) {
    this._kadenceNode = kadenceNode;
    fileUtils.generateEnvFile()
  }

  // TCP server
  createServer(port, host, connectionCallback, listenCallback){
    tcpUtils.createServer(port, host, connectionCallback, listenCallback)
    console.log('my port: ',port)
    this.address = {port, host}
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

  // Read data from a file
  readFile(filePath, callback) {
    return fileUtils.getFile(filePath, callback)
  }
  writeFile(path, data, callback) {
    fileUtils.writeFile(path, data, callback)
  }

  sendShardToNode(nodeInfo, shard, shards, shardIdx) {
   
    let { port, host } = nodeInfo;
    let client = this.connect(port, host, () => {
      console.log('connected to target batnode')
    });

    let message = {
      messageType: "STORE_FILE",
      fileName: shard,
      fileContent: fs.readFileSync(`./shards/${shard}`)
    };

    client.on('data', (data) => {
      console.log('received data from server')
      if (shardIdx < shards.length - 1){
        this.getClosestBatNodeToShard(shards[shardIdx + 1], (batNode) => {
          this.sendShardToNode(batNode, shards[shardIdx + 1], shards, shardIdx + 1)
        })
      }
      
    })
    client.write(JSON.stringify(message), () => {
      console.log('sent data to server!', port, host)
    });
  }

  // Upload file will process the file then send it to the target node
  uploadFile(filePath, idx = 0) {
    // Encrypt file and generate manifest
    const fileName = path.parse(filePath).base
    fileUtils.processUpload(filePath, (manifestPath) => {
      const shardsOfManifest = fileUtils.getArrayOfShards(manifestPath)
      this.getClosestBatNodeToShard(shardsOfManifest[idx], (batNode) => {
        this.sendShardToNode(batNode, shardsOfManifest[idx], shardsOfManifest, idx)
      });
    });
  }

  getClosestBatNodeToShard(shardId, callback){
    this.kadenceNode.iterativeFindNode(shardId, (err, res) => {
      let i = 0
      let targetKadNode = res[0];
      while (targetKadNode[1].port === this.kadenceNode.contact.port) {
        i += 1
        targetKadNode = res[i]
      }
      console.log(targetKadNode, " <- target kad node, my kad node -> ", this.kadenceNode.contact)
      this.kadenceNode.getOtherBatNodeContact(targetKadNode, (err, res) => {
        callback(res)
      })
    })
  }

  // Write data to a file in the filesystem. In the future, we will check the
  // file manifest to determine which directory should hold the file.
  receiveFile(payload) {
   
    let fileName = payload.fileName
    let fileContent = new Buffer(payload.fileContent)
    this.writeFile(`./${HOSTED_DIR}/${fileName}`, fileContent, (err) => {
      if (err) {
        throw err;
      }
    })
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
    });

    client.write(JSON.stringify(request))

    client.on('end', () => {
      console.log('end')
      fileUtils.decrypt(`./personal/${fileName}`)
    })
  }
}

exports.BatNode = BatNode;

// Given a shard,
// find the batnode closest to it
// send it a shard
// log success when the server returns a response

// given an array of shards, for each shard
// find the batnode closest to it
// send it a shard
// wait for server to respond
// continue