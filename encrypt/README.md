## Feature: 
* AES 256 bit Cipher-block-chaining(CBC) to generate a strong password for files
* `zlib` module allows compression for large files to speed up encryption process


1.`node encrypt.js` to create password and encrypt the file
  - generate a temporary file with fully encrypted content ending with `.crypt`
  - generate a file contains the original file name ending with secret.env
  
2.`node decrypt.js` to decrypt the file
  - generate a decrypted file that has exact same content as the original file
