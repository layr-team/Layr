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

  sendShardToNode(nodeInfo, shard, shards, shardIdx, storedShardName, distinctIdx, manifestPath) {
    let { port, host } = nodeInfo;
    let client = this.connect(port, host, () => {
      console.log('connected to target batnode')
    });

    let message = {
      messageType: "STORE_FILE",
      fileName: shard,
      fileContent: fs.readFileSync(`./shards/${storedShardName}`)
    };

    client.on('data', (data) => {
      console.log('received data from server')
      if (shardIdx < shards.length - 1){
        this.getClosestBatNodeToShard(shards[shardIdx + 1], (batNode) => {
          this.sendShardToNode(batNode, shards[shardIdx + 1], shards, shardIdx + 1, storedShardName, distinctIdx, manifestPath)
        })
      } else {
        this.distributeCopies(distinctIdx + 1, manifestPath)
      } 
    })

    client.write(JSON.stringify(message), () => {
      console.log('sent data to server!', port, host)
    });
  }

  // Upload file will process the file then send it to the target node
  uploadFile(filePath, distinctIdx = 0) {
    // Encrypt file and generate manifest
    const fileName = path.parse(filePath).base
    fileUtils.processUpload(filePath, (manifestPath) => {  
     this.distributeCopies(distinctIdx, manifestPath)
    });
  }

  distributeCopies(distinctIdx, manifestPath, copyIdx = 0){
    const shardsOfManifest = fileUtils.getArrayOfShards(manifestPath)
    if (distinctIdx < shardsOfManifest.length) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath))
      let copiesOfCurrentShard = manifest.chunks[shardsOfManifest[distinctIdx]]
  
      this.getClosestBatNodeToShard(copiesOfCurrentShard[copyIdx],  (batNode) => {
        this.sendShardToNode(batNode, copiesOfCurrentShard[copyIdx], copiesOfCurrentShard, copyIdx, shardsOfManifest[distinctIdx], distinctIdx, manifestPath)
      });
    }
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

  retrieveFile(manifestFilePath, retrievalCallback, copyIdx = 0, distinctIdx = 0) {
    let manifest = fileUtils.loadManifest(manifestFilePath);
    const distinctShards = fileUtils.getArrayOfShards(manifestFilePath)
    const fileName = manifest.fileName;
    this.getHostNode(distinctShards, manifest.chunks, fileName, distinctIdx, copyIdx)

  }

  getHostNode(distinctShards, manifestChunks, fileName, distinctIdx, copyIdx){
    console.log(copyIdx)
    if (copyIdx > 2){
      console.log('failed to find data on the network')
    } else {
      let currentDuplicate = manifestChunks[distinctShards[distinctIdx]][copyIdx]
      this.kadenceNode.iterativeFindValue(currentDuplicate, (err, value, responder) => {
        let kadNodeTarget = value.value;
        this.kadenceNode.getOtherBatNodeContact(kadNodeTarget, (err, batNode) => {
          if (batNode[0] === 'false' || batNode === 'false'){
            this.getHostNode(distinctShards, manifestChunks, fileName, distinctIdx, copyIdx + 1)
          } else {
            this.retrieveShard(batNode, distinctShards[distinctIdx], currentDuplicate, distinctShards, copyIdx, distinctIdx, fileName, manifestChunks)
          }
        })
      })
    }
  }

  retrieveShard(targetBatNode, saveShardAs, targetShardId,  distinctShards, copyIdx, distinctIdx, fileName, manifestChunks) {
    let client = this.connect(targetBatNode.port, targetBatNode.host, () => {
      let message = {
        messageType: "RETRIEVE_FILE",
        fileName: targetShardId
      }
      client.on('data', (data) => {
        fs.writeFileSync(`./shards/${saveShardAs}`, data, 'utf8')
        if (distinctIdx < distinctShards.length - 1){
          this.getHostNode(distinctShards, manifestChunks, fileName, distinctIdx + 1, copyIdx)
        } else {
          fileUtils.assembleShards(fileName, distinctShards)
        }
      })
      client.write(JSON.stringify(message))
    })
  };
}

exports.BatNode = BatNode;

// Upload w/ copy shards
// Input Data structure: object, keys are the stored filename, value is an array of IDS to associate
// with the content of this filename
// Given a file with the name of <key>, 
// For each <value id>, read that file's contents and distribute its contents to the
// appropriate node with the fileName property set to <value id>

// Retrieve w/ copy shards
// Input data structure: object, keys are the filename to write to, values are arrays of viable shard duplicate ids
// For each key,
// Make a request for the first value in the array


// Comparison

// Method 1:
// On data, write file, then make request call for idx + 1 or decrypt

// Method 2:
// On data, write file, then close client.
// On client end, increment idx and make next request call or do nothing


// retrieve file
  // first duplicate of first shard
  // gets host node
  // tries to retrieve shard
  // gets host node with next distinct shard, first duplicate
  // tries to retrieve shard

  // Edge cases
  // File has been modified - check for file integrity before saving
  // Bat node is not responsive - done
