const crypto = require('crypto');
const algorithm = 'aes-256-ctr';

const fs = require('fs');
const zlib = require('zlib');

// get the file password from the previously designated secret file
const secretpath = 'secret.env';
const password = fs.readFileSync(secretpath);

// file to decrpt
const filepath = 'orgexp.txt.crypt';
// Path to temporarily store decrypted version of file to be uploaded
const tmppath = 'decrptexp.txt';

// input file
const r = fs.createReadStream(filepath);

// decrypt content
const decrypt = crypto.createDecipher(algorithm, password);
// unzip content
const unzip = zlib.createGunzip();
// write file
const w = fs.createWriteStream(tmppath);

// start pipe
console.log("The file is fully decrypted");
r.pipe(decrypt).pipe(unzip).pipe(w);