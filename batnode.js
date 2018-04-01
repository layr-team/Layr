const tcpUtils = require('./utils/tcp').tcp;
const fileUtils = require('./utils/file').fileSystem;
const path = require('path');
const PERSONAL_DIR = require('./utils/file').PERSONAL_DIR;
const HOSTED_DIR = require('./utils/file').HOSTED_DIR;
const fs = require('fs');
const stellar = require('./utils/stellar').stellar;
const constants = require('./constants');


class BatNode {
  constructor(kadenceNode = {}) {
    this._kadenceNode = kadenceNode;

    if (!fs.existsSync('./.env')) {
      let stellarKeyPair = stellar.generateKeys()
      fileUtils.generateEnvFile({
        'STELLAR_ACCOUNT_ID': stellarKeyPair.publicKey(), 
        'STELLAR_SECRET': stellarKeyPair.secret()
      })
    }
    this._stellarAccountId = fileUtils.getStellarAccountId();

    stellar.accountExists(this.stellarAccountId, (account) => {
      console.log('account does exist')
      account.balances.forEach((balance) =>{
        console.log('Type:', balance.asset_type, ', Balance:', balance.balance);
      });
    }, (publicKey) => {
      console.log('account does not exist, creating account...')
      stellar.createNewAccount(publicKey)
    })

    this._audit = { ready: false, data: null, passed: false };
    fileUtils.generateEnvFile()

  }

  // TCP server
  createServer(port, host, connectionCallback){
    const listenCallback = (server) => {
      this._server = server
    }
    tcpUtils.createServer(port, host, connectionCallback, listenCallback)
    this.address = {port, host}
  }

  sendPaymentFor(destinationAccountId, onSuccessfulPayment) {
    console.log(destinationAccountId, ' sending payment to that account')
    let stellarSeed = fileUtils.getStellarSecretSeed();
    let amount = "10";
    stellar.sendPayment(destinationAccountId, stellarSeed, amount, onSuccessfulPayment)
    // get stellar secret key
    // calculate cost of sending shard
    // stellar.sendPayment(destinationAccountId, secretKey, amount, onSuccessfulPayment)
  }

  createCLIServer(port, host, connectionCallback) {
    tcpUtils.createServer(port, host, connectionCallback);
  }

  get stellarAccountId(){
    return this._stellarAccountId
  }

  getStellarAccountInfo(){
    let accountId = this.stellarAccountId;
    stellar.getAccountInfo(accountId)
  }

  get server(){
    return this._server
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
  writeFile(filePath, data, callback) {
    fileUtils.writeFile(filePath, data, callback)
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
        this.getClosestBatNodeToShard(shards[shardIdx + 1], (batNode, kadNode) => {
          this.kadenceNode.getOtherNodeStellarAccount(kadNode, (error, accountId) => {
            console.log("The target node returned this stellard id: ", accountId)
            this.sendPaymentFor(accountId, (paymentResult) => {
              console.log(paymentResult, " result of payment")
              this.sendShardToNode(batNode, shards[shardIdx + 1], shards, shardIdx + 1, storedShardName, distinctIdx, manifestPath)
            })
          })
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

      this.getClosestBatNodeToShard(copiesOfCurrentShard[copyIdx],  (batNode, kadNode) => {
        this.kadenceNode.getOtherNodeStellarAccount(kadNode, (error, accountId) => {
          console.log("The target node returned this stellard id: ", accountId)
          this.sendPaymentFor(accountId, (paymentResult) => {
            console.log(paymentResult, " result of payment")
            this.sendShardToNode(batNode, copiesOfCurrentShard[copyIdx], copiesOfCurrentShard, copyIdx, shardsOfManifest[distinctIdx], distinctIdx, manifestPath)
          })
        })
      });
    }
  }

  getClosestBatNodeToShard(shardId, callback){
    this.kadenceNode.iterativeFindNode(shardId, (err, res) => {
      let i = 0
      let targetKadNode = res[0]; // res is an array of these tuples: [id, {hostname, port}]
      console.log(targetKadNode, "Target kad node")
      while ((targetKadNode[1].hostname === this.kadenceNode.contact.hostname &&
            targetKadNode[1].port === this.kadenceNode.contact.port) || targetKadNode[0] === constants.SEED_NODE[0]) { // change to identity and re-test
        i += 1
        targetKadNode = res[i]
      }

      this.kadenceNode.ping(targetKadNode, (error) => { // Checks whether target kad node is alive
        if (error) {
          this.getClosestBatNodeToShard(shardId, callback) // if it's offline, re-calls method. This works because sendign RPCs to disconnected nodes
        } else {                                          // will automatically remove the dead node's contact info from sending node's routing table
          this.kadenceNode.getOtherBatNodeContact(targetKadNode, (error2, result) => { // res is contact info of batnode {port, host}
            callback(result, targetKadNode)
          })
        }
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

  retrieveFile(manifestFilePath, copyIdx = 0, distinctIdx = 0) {
    let manifest = fileUtils.loadManifest(manifestFilePath);
    const distinctShards = fileUtils.getArrayOfShards(manifestFilePath)
    const fileName = manifest.fileName;
    this.retrieveSingleCopy(distinctShards, manifest.chunks, fileName, manifest, distinctIdx, copyIdx)
  }

  retrieveSingleCopy(distinctShards, allShards, fileName, manifest, distinctIdx, copyIdx){
    if (copyIdx && copyIdx > 2) {
      console.log('Host could not be found with the correct shard')
    } else {
      let currentCopies = allShards[distinctShards[distinctIdx]] // array of copy Ids for current shard
      let currentCopy = currentCopies[copyIdx]

      const afterHostNodeIsFound = (hostBatNode) => {
        if (hostBatNode[0] === 'false'){
          this.retrieveSingleCopy(distinctShards, allShards, fileName, manifest, distinctIdx, copyIdx + 1)
        } else {
          let retrieveOptions = {
            saveShardAs: distinctShards[distinctIdx],
            distinctShards,
            fileName,
            distinctIdx,
          }
          this.issueRetrieveShardRequest(currentCopy, hostBatNode, manifest, retrieveOptions, () => {
            this.retrieveSingleCopy(distinctShards, allShards, fileName, manifest, distinctIdx + 1, copyIdx)
          })
        }
      }

      this.getHostNode(currentCopy, afterHostNodeIsFound)
    }
  }
  issueRetrieveShardRequest(shardId, hostBatNode, manifest, options, finishCallback){
   let { saveShardAs, distinctIdx, distinctShards, fileName } = options

   let client = this.connect(hostBatNode.port, hostBatNode.host, () => {
    let message = {
      messageType: 'RETRIEVE_FILE',
      fileName: shardId
    }

    const fileDestination = './shards/' + saveShardAs;
    let writeStream = fs.createWriteStream(fileDestination);

    const completeFileSize = manifest.fileSize;
    const waitTime = Math.floor(completeFileSize/16000);  // set the divided amount slightly below 16kb ~ 16384 (the default high watermark for read/write streams)
    console.log("waiting time in ms: ", waitTime);

    client.once('data', (data) => {
      writeStream.write(data);
      client.pipe(writeStream);

      if (distinctIdx < distinctShards.length - 1){
        finishCallback()
      } else {
        setTimeout( function() {
          fileUtils.assembleShards(fileName, distinctShards)
        }, waitTime);
      }
    })

    client.write(JSON.stringify(message), () => {
      console.log("Accessing distinctIdx: ", distinctIdx);
    })
   })
  }

  getHostNode(shardId, callback){
    this.kadenceNode.iterativeFindValue(shardId, (err, value, responder) => {
      let kadNodeTarget = value.value;
      this.kadenceNode.getOtherBatNodeContact(kadNodeTarget, (err, batNode) => {
        console.log('getHostNode batnode: ', batNode);
        callback(batNode)
      })
    })
  }

  auditFile(manifestFilePath) {
    const manifest = fileUtils.loadManifest(manifestFilePath);
    const shards = manifest.chunks;
    const shaIds = Object.keys(shards);
    const shardAuditData = this.prepareAuditData(shards, shaIds);
    let shaIdx = 0;

    while (shaIds.length > shaIdx) {
      this.auditShardsGroup(shards, shaIds, shaIdx, shardAuditData);
      shaIdx += 1;
    }
  }

  prepareAuditData(shards, shaIds) {
    return shaIds.reduce((acc, shaId) => {
      acc[shaId] = {};

      shards[shaId].forEach((shardId) => {
        acc[shaId][shardId] = false;
      });

      return acc;
    }, {});
  }
  /**
   * Tests the redudant copies of the original shard for data integrity.
   * @param {shards} Object - Shard content SHA keys with
   * array of redundant shard ids
   * @param {shaIdx} Number - Index of the current
   * @param {shardAuditData} Object - same as shards param except instead of an
   * array of shard ids it's an object of shard ids and their audit status
  */
  auditShardsGroup(shards, shaIds, shaIdx, shardAuditData, done) {
    let shardDupIdx = 0;
    const shaId = shaIds[shaIdx];

    while (shards[shaId].length > shardDupIdx) {
      this.auditShard(shards, shardDupIdx, shaId, shaIdx, shardAuditData, done);
      shardDupIdx += 1;
    }
  }

  auditShard(shards, shardDupIdx, shaId, shaIdx, shardAuditData, done) {
    const shardId = shards[shaId][shardDupIdx];

    this.kadenceNode.iterativeFindValue(shardId, (error, value, responder) => {
      if (error) { throw error; }
      let kadNodeTarget = value.value;
      this.kadenceNode.getOtherBatNodeContact(kadNodeTarget, (err, batNode) => {
        if (err) { throw err; }
        this.auditShardData(batNode, shards, shaIdx, shardDupIdx, shardAuditData)
      })
    })
  }

  auditShardData(targetBatNode, shards, shaIdx, shardDupIdx, shardAuditData) {
    let client = this.connect(targetBatNode.port, targetBatNode.host);

    const shaKeys = Object.keys(shards);
    const shaId = shaKeys[shaIdx];
    const shardId = shards[shaId][shardDupIdx]; // id of a redundant shard for shaId

    const finalShaGroup = shaKeys.length - 1 === shaIdx;
    const finalShard = shards[shaId].length - 1 === shardDupIdx;

    let message = {
      messageType: "AUDIT_FILE",
      fileName: shardId
    };

    client.write(JSON.stringify(message), (err) => {
      if (err) { throw err; }
    })

    client.on('data', (data) => {
      const hostShardSha1 = data.toString('utf8');
      // Check that shard content matches original content SHA
      if (hostShardSha1 === shaId) {
        shardAuditData[shaId][shardId] = true;
      }

      if (finalShaGroup && finalShard) {
        const hasBaselineRedundancy = this.auditResults(shardAuditData, shaKeys);
        this._audit.ready = true;
        this._audit.data = shardAuditData;
        this._audit.passed = hasBaselineRedundancy;

        console.log(shardAuditData);
        if (hasBaselineRedundancy) {
          console.log('Passed audit!');
        } else {
          console.log('Failed Audit');
        }
      }
    })
  }

  auditResults(auditData, shaKeys) {
    const isRedundant = (shaId) => {
      let validShards = 0;
      // For each key (shardId) under the shard content's shaId key
      Object.keys(auditData[shaId]).forEach((shardId) => {
        if (auditData[shaId][shardId] === true) { validShards += 1; }
      });

      return validShards >= constants.BASELINE_REDUNDANCY ? true : false;
    }

    return shaKeys.every(isRedundant);
  }

}

exports.BatNode = BatNode;
