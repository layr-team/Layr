const fileSystem = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const algorithm = 'aes-256-cbc';
const path = require('path');
const dotenv = require('dotenv');
const envVars = dotenv.config();


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
    if (!fileSystem.existsSync('./.env') || !envVars.parsed.PRIVATE_KEY){
      const privateKey = `PRIVATE_KEY=${generatePrivateKey()}`
      fileSystem.writeFileSync('./.env', privateKey)
    }
  }
  const encrypt = (filepath, callback) => {
    const privateKey = envVars.parsed.PRIVATE_KEY;
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
  const decrypt = (filepath) => {
    const tempPath = './personal/decrypted-' + path.parse(filepath).name
    const privateKey = envVars.parsed.PRIVATE_KEY;

    const encryptedFileData = fileSystem.createReadStream(filepath)
    const decrypt = crypto.createDecipher(algorithm, privateKey)
    const unzip = zlib.createGunzip()
    const writeStream = fileSystem.createWriteStream(tempPath)

    encryptedFileData.pipe(decrypt).pipe(unzip).pipe(writeStream)
  }
  const sha1Hash = (file) => {
    const fileData = fileSystem.readFileSync(file)
    return sha1HashData(fileData)
  }
  const sha1HashData = (fileData) => {
    return crypto.createHash('sha1').update(fileData).digest('hex')
  }
  const  generateManifest = (fileName, fileSize) => {
    return { fileName, fileSize, chunks: []}
  }
  const addShardsToManifest = (manifest, filePath, manifestName, dir) => {
    const fileSize = manifest.fileSize;
    const setChunkNum = 10; 
    const chunkNumber = fileSize % setChunkNum === 0 ? setChunkNum : setChunkNum - 1;
    const chunkSize = Math.floor(fileSize/chunkNumber);
   
    const readable = fileSystem.createReadStream(filePath);
    readable.on('readable', () => {
      let chunk;
  
      while (null !== (chunk = readable.read(chunkSize))) {
        const chunkId = sha1HashData(chunk);
        manifest.chunks.push(chunkId);

        storeShards(chunk, chunkId)
      }
    });
    readable.on('end', () => {
      return fileSystem.writeFileSync(`${dir}/${manifestName}`, JSON.stringify(manifest))
    });
  }
  const addManifestToFile = (file, hashId, callback) => {
    const sizeInBytes = fileSystem.statSync(file).size
    const fileName = path.basename(file)
    const manifest = generateManifest(fileName, sizeInBytes)
    const manifestName = hashId + '.batchain'
    const dir = './manifest'

    if (!fileSystem.existsSync(dir)) {
      fileSystem.mkdirSync(dir)
    }

    addShardsToManifest(manifest, file, manifestName, dir);
    if (callback){
      callback();
    }
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

    assembleShards(manifest, chunkIds)
  }

  assembleShards = (manifest, chunkIds) => {
    const chunkDir = './shards'
    const filePaths = chunkIds.map(chunkId => chunkDir + '/' + chunkId)

    const destinationDir = './personal'

    const fileDestination = destinationDir + '/' + manifest.fileName
    let writeStream = fileSystem.createWriteStream(fileDestination)
    
    filePaths.forEach(path => {
      writeStream.write(fileSystem.readFileSync(path))
    })
    writeStream.end(() => {
      decrypt(fileDestination)
    })
  }
  processUpload = (filePath, callback) => {
    encrypt(filePath, (encryptedFilePath) => {
      const hash = sha1Hash(encryptedFilePath)
      addManifestToFile(encryptedFilePath, hash, callback)
    })
  }
  return {
    getFile,
    writeFile,
    processUpload,
    generateEnvFile,
    decrypt,
    encrypt,
    composeShards

  }
})();
