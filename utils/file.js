const fileSystem = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const algorithm = 'aes-256-cbc';
const path = require('path');
const dotenv = require('dotenv');


exports.PERSONAL_DIR = 'personal'
exports.HOSTED_DIR = 'hosted'

exports.fileSystem = (function(){
  const getFile = (filePath, callback) => {
    let fileData = null;
    fileSystem.readFile(filePath, callback)
  }
  const writeFile = (filePath, data, callback) => {
    fileSystem.writeFile(filePath, data, callback)
  }
  const generatePrivateKey = () => {
    return crypto.randomBytes(32).toString('hex')
  }
  const generateEnvFile = () => {
    if (!fileSystem.existsSync('./.env') || !dotenv.config().parsed.PRIVATE_KEY){
      const privateKey = `PRIVATE_KEY=${generatePrivateKey()}`
      fileSystem.writeFileSync('./.env', privateKey)
    }
  }
  const encrypt = (filepath, callback) => {
    const privateKey = dotenv.config().parsed.PRIVATE_KEY;
    const tmpPath = './personal/' + path.parse(filepath).base + '.crypt'

    const fileData = fileSystem.createReadStream(filepath)
    const zip = zlib.createGzip()
    const encrypt = crypto.createCipher(algorithm, privateKey)
    const encryptedFileStore = fileSystem.createWriteStream(tmpPath)

    // read the file, zip it, encrypt it, and write it
    fileData.pipe(zip).pipe(encrypt).pipe(encryptedFileStore).on('close', () => {
      if(callback) {
        callback(tmpPath)
      }
    })
  }
  // const decryptUtil = (filePath) => {
  //   const privateKey = dotenv.config().parsed.PRIVATE_KEY;
  //   const decipher = crypto.createDecipher(algorithm, privateKey)
  //   const unzip = zlib.createGunzip()

    // Streams approach
    // const encryptedData = fileSystem.createReadStream(filePath);
    // const decrypted = encryptedData.pipe(decipher).pipe(unzip);
    // > decrypted
    // { _readableState: ReadableState,
    //   readable: true,
    //   domain: null,
    //   _events: Object,
    //   _eventsCount: 7,
    //   ... }


    // Streams + handlers approach
    // const encryptedDataStream = fileSystem.createReadStream(filePath);
    // let string = ''
    // encryptedDataStream.on('readable', (buffer) => {
    //   const part = buffer.read().toString();
    //   string += part;
    //   console.log('stream data ', part); // undefined
    // });
    //
    // encryptedDataStream.on('end', () => {
    //   console.log('Final output: ', string);
    // })
    // crypto.js:99

    // this._handle.update(data, encoding);
    //            ^
    // TypeError: Data must be a string or a buffer
    //     at Hash.update (crypto.js:99:16)
    //     at Object.sha1HashData (/Users/Dylan/Code/projects/batnode_proto/utils/file.js:118:38)
    //     at Socket.serverConnection.on (/Users/Dylan/Code/projects/batnode_proto/audit/server/node.js:51:35)
    //     at emitOne (events.js:116:13)
    //     at Socket.emit (events.js:211:7)
    //     at addChunk (_stream_readable.js:263:12)
    //     at readableAddChunk (_stream_readable.js:250:11)
    //     at Socket.Readable.push (_stream_readable.js:208:10)
    //     at TCP.onread (net.js:594:20)


    // Handlers approach
    // const encryptedData = fileSystem.readFileSync(filePath);
    // let zippedEncryptedData;

    // let decrypted = '';
    // decipher.on('readable', () => {
    //   console.log('Never reaches readable either');
    //   const data = decipher.read();
    //   if (data) { decrypted += data.toString('utf8'); }
    // });
    //
    // decipher.on('end', () => {
    //   console.log('DECRYPT - end', decrypted);
    //   zlib.unzip(decrypted, (err, buffer) => {
    //     if (!err) {
    //       unzippedEncryptedData = decrypted.toString('utf8');
    //     }
    //   });
    // })
    //
    // decipher.write(encryptedData, 'hex', (err) => {
    //   console.log('Never reaches inside write');
    //   if (err) { throw err; }
    // });
    //
    // decipher.end();
  // }
  const decrypt = (filepath) => {
    const tempPath = './personal/decrypted-' + path.parse(filepath).name
    const privateKey = dotenv.config().parsed.PRIVATE_KEY;

    const encryptedFileData = fileSystem.createReadStream(filepath)
    const decrypt = crypto.createDecipher(algorithm, privateKey)
    const unzip = zlib.createGunzip()
    const writeStream = fileSystem.createWriteStream(tempPath)
    //
    encryptedFileData.pipe(decrypt).pipe(unzip).pipe(writeStream)
  }
  const sha1Hash = (file) => {
    const fileData = fileSystem.readFileSync(file)
    return sha1HashData(fileData)
  }
  const sha1HashData = (fileData) => {
    return crypto.createHash('sha1').update(fileData).digest('hex')
  }
  const generateManifest = (fileName, fileSize) => {
    return { fileName, fileSize, chunks: []}
    // return { fileName, fileSize, chunks: {}}
  }
  const addShardsToManifest = (manifest, filePath, manifestName, dir, callback) => {
    const fileSize = manifest.fileSize;
    const setChunkNum = 8;
    // const setChunkNum = 10;
    // TODO: Make chunk size vary by file size ~10kb

    const chunkNumber = fileSize % setChunkNum === 0 ? setChunkNum : setChunkNum - 1;
    const chunkSize = Math.floor(fileSize/chunkNumber);

    const readable = fileSystem.createReadStream(filePath);
    readable.on('readable', () => {
      let chunk;

      while (null !== (chunk = readable.read(chunkSize))) {
        const chunkId = sha1HashData(chunk);
        manifest.chunks.push(chunkId);
        // manifest.chunks[chunkId] = [];

        // copyShards(chunk, chunkId, manifest)
        storeShards(chunk, chunkId)
      }
    });

    readable.on('end', () => {
      fileSystem.writeFile(`${dir}/${manifestName}`, JSON.stringify(manifest), () => {
      // fileSystem.writeFile(`${dir}/${manifestName}`, JSON.stringify(manifest, null, '\t'), () => {
        callback(`${dir}/${manifestName}`)
      })

    });
  }
  // TODO: Rename method
  const addManifestToFile = (file, hashId, callback) => {
    const sizeInBytes = fileSystem.statSync(file).size
    const fileName = path.basename(file)
    const manifest = generateManifest(fileName, sizeInBytes)
    const manifestName = hashId + '.batchain'
    const dir = './manifest'

    if (!fileSystem.existsSync(dir)) {
      fileSystem.mkdirSync(dir)
    }

    addShardsToManifest(manifest, file, manifestName, dir, callback);
  }
  const copyShards = (chunk, chunkId, manifest) => {
    const copyNum = 3;
    let copyShardContent;
    let appendBytes;

    for (let i = 1; i <= copyNum; i++) {
      appendBytes = crypto.randomBytes(2).toString('hex');
      copyShardContent = chunk + appendBytes;
      // console.log(`Copy chunk has ${copyShardContent.length} bytes of data.`);

      const copyChunkId = sha1HashData(copyShardContent);
      manifest.chunks[chunkId].push(copyChunkId);
    }

    // console.log(chunkId + ": " + manifest[chunkId]);

    // next step?
    //    filePath = './shards' + '/' + chunkId
    //    iterativeStore(copyId, filePath);
  }

  const storeShards = (chunk, chunkId) => {
    if (!fileSystem.existsSync('./shards')){ fileSystem.mkdirSync('./shards'); }

    const filePath = './shards/' + chunkId;

    fileSystem.writeFileSync(filePath, chunk)
    // TODO: store iteratively
  }
  const composeShards = (manifestFile) => {
    const manifest = JSON.parse(fileSystem.readFileSync(manifestFile))

    const chunkIds = manifest.chunks
    // TODO: get the shards via iterativeFindValue and store the shards in local disk
    // - iterate through the chunkIds array
    //  - find the shard file based on chunkId(might need to use JS `startsWith`)
    //   - if the file hasn't existed yet (by comparing file id)
    //      - store the file
    //      - shardSaved += 1

    assembleShards(manifest.fileName, chunkIds)
  }
  // TODO Just pass in fileName instead of whole manifest object
  const assembleShards = (fileName, chunkIds) => {
    const chunkDir = './shards'
    const filePaths = chunkIds.map(chunkId => chunkDir + '/' + chunkId)

    const destinationDir = './personal'

    const fileDestination = destinationDir + '/' + fileName
    let writeStream = fileSystem.createWriteStream(fileDestination)

    filePaths.forEach(path => {
      let fileData = fileSystem.readFileSync(path)
      console.log(fileData, path)
      writeStream.write( fileData)
    })
    writeStream.end(() => {
      decrypt(fileDestination)
    })
  }
  const processUpload = (filePath, callback) => {
    encrypt(filePath, (encryptedFilePath) => {
      const hash = sha1Hash(encryptedFilePath)
      addManifestToFile(encryptedFilePath, hash, callback)
    })
  }
  const loadManifest = (manifestFilePath) => {
    const manifest = JSON.parse(fileSystem.readFileSync(manifestFilePath))
    return manifest
  }
  const getArrayOfShards = (manifestFilePath) => {
    return loadManifest(manifestFilePath).chunks
    // return Object.keys(loadManifest(manifestFilePath).chunks)
  }
  return {
    getFile,
    writeFile,
    processUpload,
    generateEnvFile,
    decrypt,
    encrypt,
    composeShards,
    loadManifest,
    getArrayOfShards,
    assembleShards,
    sha1HashData,
    sha1Hash,
  }
})();
