// crypto is the library in node.js we deal with encryption
const crypto = require('crypto');
const algorithm = 'aes-256-cbc';  

const fs = require('fs');
// zip the large file
const zlib = require('zlib');

const file = 'orgexp.txt';

const EncryptHelper = (function(filepath, mode) {
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
  console.log("The file is fully encrypted");
  r.pipe(zip).pipe(encrypt).pipe(w);
});

EncryptHelper(file, algorithm);