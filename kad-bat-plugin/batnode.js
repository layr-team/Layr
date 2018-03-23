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
      let targetKadNode = res[0]; // res is an array of these tuples: [id, {hostname, port}]
      while (targetKadNode[1].port === this.kadenceNode.contact.port) { // change to identity and re-test
        i += 1
        targetKadNode = res[i]
      }

      this.kadenceNode.getOtherBatNodeContact(targetKadNode, (err, res) => { // res is contact info of batnode {port, host}
        callback(res)
      })
    })
  }

  // Write data to a file in the filesystem. In the future, we will check the
  // file manifest to determine which directory should hold the file.
  receiveFile(payload) {
    let fileName = payload.fileName
    this.kadenceNode.iterativeStore(fileName, this.kadenceNode.contact, () => {
      console.log('store completed')
      let fileContent = new Buffer(payload.fileContent)
      this.writeFile(`./${HOSTED_DIR}/${fileName}`, fileContent, (err) => {
        if (err) {
          throw err;
        }
      })
    })
  }

  retrieveFile(manifestFilePath, retrievalCallback) {
    let manifest = fileUtils.loadManifest(manifestFilePath);
    const shards = manifest.chunks;
    const fileName = manifest.fileName;
    // hardcoded 8 fileId + node contact info retrieved via find value RPC process.
    this.getHostNode(shards, 0, fileName)
 
  }

  getHostNode(shards, shardIdx, fileName){
    this.kadenceNode.iterativeFindValue(shards[shardIdx], (err, value, responder) => {
      let kadNodeTarget = value.value;
      this.kadenceNode.getOtherBatNodeContact(kadNodeTarget, (err, batNode) => {
        this.retrieveShard(batNode, shards[shardIdx], shards, shardIdx, fileName)
      })
    })
  }

  retrieveShard(targetBatNode, shardId, shards, shardIdx, fileName) {
    let client = this.connect(targetBatNode.port, targetBatNode.host, () => {
      let message = {
        messageType: "RETRIEVE_FILE",
        fileName: shardId
      }
      client.on('data', (data) => {
        fs.writeFileSync(`./shards/${shardId}`, data, 'utf8')
        if (shardIdx < shards.length - 1){
          this.getHostNode(shards, shardIdx + 1, fileName)
        } else {
          fileUtils.assembleShards(fileName, shards)
        }
      })
      client.write(JSON.stringify(message))
    })
  };
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


// When a server receives a file it shoud:
// 1. write the file to disk
// 2. When file is finished writing to disk, send out an iterativeStoreRpc AND send success message to client


// Retrieving a file
// Requirements: Content of shards are appended in the order they are listed in manifest
// All shards are retrieved before decompression or decryption
// 1. Given an array of chunks in the manifest:
// 2. Execute iterativeFindValue for each chunk in parallel
// 3. Once all addresses are retrieved, send getOtherBatNodeContact to each
// 4. Once all those are retrieved, send request files for each, and write them to disk (appending to a file
//    won't work since they are not guaranteed to be returned in the exact order)
// 5. Iterate through shards in manifest, writing them to a file in correct order
// 6. Decrypt then unzip data


// Comparison

// Method 1:
// On data, write file, then make request call for idx + 1 or decrypt

// Method 2:
// On data, write file, then close client.
// On client end, increment idx and make next request call or do nothing