const fileSystem = require('fs');



exports.fileSystem = (function(){
  const getFile = (filePath, callback) => {
    let fileData = null;
    fileSystem.readFile(filePath, callback)
  }
  return {
    getFile
  }
})();