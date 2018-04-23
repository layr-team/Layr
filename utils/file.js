const fileSystem = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const algorithm = 'aes-256-cbc';
const path = require('path');
const dotenv = require('dotenv');
const constants = require('../constants');
const fs = require('fs');

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
  const generateEnvFile = (optionalVars) => {
    let envVarsToWrite = '';
    if (!dotenv.config().parsed.PRIVATE_KEY){
      const privateKey = `PRIVATE_KEY=${generatePrivateKey()}\n`
      envVarsToWrite = envVarsToWrite.concat(privateKey)
    }

    if (optionalVars){
      Object.keys(optionalVars).forEach(key => {
        envVarsToWrite = envVarsToWrite.concat(`${key}=${optionalVars[key]}\n`)
      })
    }

    if (envVarsToWrite !== ''){
      fileSystem.appendFileSync('./.env', envVarsToWrite)
    }
  }
  const getStellarAccountId = () => {
    return dotenv.config().parsed.STELLAR_ACCOUNT_ID;
  }
  const getStellarSecretSeed = () => {
    return dotenv.config().parsed.STELLAR_SECRET;
  }
  const encrypt = (filepath, callback) => {
    const privateKey = dotenv.config().parsed.PRIVATE_KEY;
    const tmpPath = './personal/' + path.parse(filepath).base + '.crypt'

    const fileData = fileSystem.createReadStream(filepath)
    const zip = zlib.createGzip()
    const encryptStream = crypto.createCipher(algorithm, privateKey)
    const encryptedFileStore = fileSystem.createWriteStream(tmpPath)

    // read the file, zip it, encrypt it, and write it
    fileData.pipe(zip).pipe(encryptStream).pipe(encryptedFileStore).on('close', () => {
      if(callback) {
        callback(tmpPath)
      }
    })
  }
  const decrypt = (filepath) => {
    const tempPath = './personal/decrypted-' + path.parse(filepath).name
    const privateKey = dotenv.config().parsed.PRIVATE_KEY;

    const encryptedFileData = fileSystem.createReadStream(filepath)
    const decryptStream = crypto.createDecipher(algorithm, privateKey)
    const unzip = zlib.createGunzip()
    const writeStream = fileSystem.createWriteStream(tempPath)

    encryptedFileData.pipe(decryptStream).pipe(unzip).pipe(writeStream).on('close', (error) => {
      if (error) { console.log(error) };
      console.log("Your file has been downloaded and decrypted.");
    })
  }
  const sha1Hash = (file) => {
    const fileData = fileSystem.readFileSync(file)
    return sha1HashData(fileData)
  }
  const sha1HashData = (fileData, optionalNonce) => {
    if (optionalNonce) {
      return crypto.createHash('sha1').update(fileData).update(optionalNonce).digest('hex')
    } else {
      return crypto.createHash('sha1').update(fileData).digest('hex')
    }
    
  }
  const generateManifest = (fileName, fileSize) => {
    return { fileName, fileSize, chunks: {}}
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
        manifest.chunks[chunkId] = [];
       

        createRedundantShardIds(chunk, chunkId, manifest)
        storeShards(chunk, chunkId)
        
      }
    });

    readable.on('end', () => {
      // '\t': tab character mimics standard pretty-print appearance
      fileSystem.writeFile(`${dir}/${manifestName}`, JSON.stringify(manifest, null, '\t'), () => {
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
  const createRandomShardId = (chunk) => {
    let appendBytes = crypto.randomBytes(2).toString('hex');
    let copyShardContent = chunk + appendBytes;

    return sha1HashData(copyShardContent);
  };

  const createRedundantShardIds = (chunk, chunkId, manifest) => {
    const shardsToCreate = constants.BASELINE_REDUNDANCY;
    let copyShardContent;
    let appendBytes;

    for (let i = 1; i <= shardsToCreate; i++) {
      // use createRedundantShardId here
      appendBytes = crypto.randomBytes(2).toString('hex');
      copyShardContent = chunk + appendBytes;

      const copyChunkId = sha1HashData(copyShardContent);
      manifest.chunks[chunkId].push(copyChunkId);
    }

  }

  const storeShards = (chunk, chunkId) => {
    if (!fileSystem.existsSync('./shards')){ fileSystem.mkdirSync('./shards'); }

    const filePath = './shards/' + chunkId;

    fileSystem.writeFileSync(filePath, chunk)
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
      writeStream.write(fileData, function() {
        console.log("filePath: " + path + " size " + fs.statSync(path).size);
      });
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
    return Object.keys(loadManifest(manifestFilePath).chunks)
  }
  return {
    createRandomShardId,
    getFile,
    writeFile,
    processUpload,
    generateEnvFile,
    decrypt,
    encrypt,
    loadManifest,
    getArrayOfShards,
    assembleShards,
    sha1HashData,
    sha1Hash,
    getStellarAccountId,
    getStellarSecretSeed
  }
})();
