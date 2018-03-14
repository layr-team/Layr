const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const algorithm = 'aes-256-cbc';
// zip the large file
const zlib = require('zlib');
// const encryptor = require('../encrypt/encrypt.js');

function sha1Hash(file) {
  // doesn't work with `readFile`, get `undefined` for fileData
  // const fileData = fs.readFile(file, (err, data) => {
  //   if (err) throw err;
  //   console.log(data);
  // });
  const fileData = fs.readFileSync(file);
  return crypto.createHash('sha1').update(fileData).digest('hex');
}

function generateManifest(filename, filesize) {
  return { fileName: filename, fileSize: filesize, chunks: [] };
}

function addManifestToFile(file, hashId) {
  const sizeInByte = fs.statSync(file).size;
  const filename = path.basename(file);
  const manifest = generateManifest(filename, sizeInByte);

  const manifestName = hashId + '.bat';
  const dir = './manifest';

  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
  }

  return fs.writeFile(`${dir}/${manifestName}`, JSON.stringify(manifest), (err) => {
    if (err) throw err;
    console.log('The manifest file has been saved!');
  });
}

const EncryptUploadHelper = (function(filepath) {
  // Path to temporarily store encrypted version of file to be uploaded
  const tmppath = './' + filepath + '.crypt';

  // create a password for the encrypt file
  const password = crypto.randomBytes(32).toString('hex');
  console.log(
    `Please save: ${password.length} bytes of random password: ${password}`);

  // save the password to a secret file
  const secretpath = tmppath +'secret.env';
  // write the password in the secret file
  fs.writeFile(secretpath, password, (err) => {
    if (err) throw err;
    console.log('The secret file has been saved!');
  });

  // input file, turn it into a new ReadStream object then we can use readable.pipe
  const r = fs.createReadStream(filepath);
  // zip content
  const zip = zlib.createGzip();
  // encrypt content
  const encrypt = crypto.createCipher(algorithm, password);

  // write encrypted file
  const w = fs.createWriteStream(tmppath);

  // start pipe, stream to write encrypted
  
  r.pipe(zip).pipe(encrypt).pipe(w).on('close', function() {
    console.log("The file is fully encrypted, generating manifest");
    const file = tmppath;
    const hash = sha1Hash(file);
    addManifestToFile(file, hash);
  });

});

const filename = '../stored/railstutorial.mp4'
EncryptUploadHelper(filename);

// function uploadProccesor(filename) {
//   const encryptedFile = filename + '.crypt';
  
//   const hash = sha1Hash(encryptedFile);
  
//   addManifestToFile(encryptedFile, hash);
// }

// setTimeout(uploadProccesor, 500);

