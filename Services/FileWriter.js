// FileWriter.js
const fs = require('fs');
const path = require('path');

class FileWriter {
  constructor(filename) {
    this.filename = filename || 'output.txt'; // Default filename
  }

  writeToFile(content) {
    return new Promise((resolve, reject) => {
      fs.appendFile(path.join(__dirname, this.filename), content + '\n', 'utf8', (err) => {
        if (err) {
          return reject(`Failed to write to file: ${err}`);
        }
        resolve('Content written successfully!');
      });
    });
  }
}

module.exports = FileWriter;
