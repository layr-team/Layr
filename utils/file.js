const fileSystem = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
const algorithm = 'aes-256-cbc';
const path = require('path');


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
  const encrypt = (filepath, callback) => {
    const privateKey = crypto.randomBytes(32).toString('hex')
    const tmpPath = './' + 'hosted/' + path.parse(filepath).name + '.crypt'
    const privatePath = tmpPath + '.secret.env'
    
    fileSystem.writeFile(privatePath, privateKey, (err) => {
      if (err) throw err;
    })

    const fileData = fileSystem.createReadStream(filepath)
    const zip = zlib.createGzip()
    const encrypt = crypto.createCipher(algorithm, privateKey)
    const encryptedFileStore = fileSystem.createWriteStream(tmpPath)
    // read the file, zip it, encrypt it, and write it
    fileData.pipe(zip).pipe(encrypt).pipe(encryptedFileStore).on('close', () => {
      callback(tmpPath)
    })
  }
  const decrypt = (filepath) => {
    const tempPath = 'decrypt-' + path.parse(filepath).name

    const secretPath = filepath + '.secret.env'
    const privateKey = fileSystem.readFileSync(secretPath)

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
  addManifestToFile = (file, hashId) => {
    const sizeInBytes = fileSystem.statSync(file).size
    const fileName = path.basename(file)
    const manifest = generateManifest(fileName, sizeInBytes)
    const manifestName = hashId + '.batchain'
    const dir = './manifest'

    if (!fileSystem.existsSync(dir)) {
      fileSystem.mkdirSync(dir)
    }
    return fileSystem.writeFile(`${dir}/${manifestName}`, JSON.stringify(manifest), err => {
      if (err) throw err;
    })
  }
  processUpload = (filePath) => {
    encrypt(filePath, (encryptedFilePath) => {
      const hash = sha1Hash(encryptedFilePath)
      addManifestToFile(encryptedFilePath, hash)
    })
  }
  return {
    getFile,
    writeFile,
    processUpload,

  }
})();
