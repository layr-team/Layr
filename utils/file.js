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
  sha1Hash = (file) => {
    const fileData = fileSystem.readFileSync(file)
    return crypto.createHash('sha1').update(fileData).digest('hex')
  }
  generateManifest = (fileName, fileSize) => {
    return { fileName, fileSize, chunks: []}
  }
  addManifestToFile = (file, hashId, callback) => {
    const sizeInBytes = fileSystem.statSync(file).size
    const fileName = path.basename(file)
    const manifest = generateManifest(fileName, sizeInBytes)
    const manifestName = hashId + '.batchain'
    const dir = './manifest'

    if (!fileSystem.existsSync(dir)) {
      fileSystem.mkdirSync(dir)
    }

    fileSystem.writeFileSync(`${dir}/${manifestName}`, JSON.stringify(manifest))

    if (callback){
      callback();
    }
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
    encrypt

  }
})();
