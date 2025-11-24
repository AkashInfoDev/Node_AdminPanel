// encryptor.js
const crypto = require('crypto');
require('dotenv').config();

class Encryptor {
  constructor() {
    const keyHex = process.env.ENC_KEY_HEX;

    this.algorithm = 'aes-256-cbc';
    this.key = Buffer.from(keyHex, 'hex');

    if (this.key.length !== 32) {
      throw new Error('Encryption key must be 32 bytes (256 bits)');
    }
  }

  encrypt(text) {
    const iv = crypto.randomBytes(16); // 16 bytes IV for AES-256-CBC
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  decrypt(encryptedText) {
    const [ivHex, encryptedHex] = encryptedText.split(':');

    if (!ivHex || !encryptedHex) {
      throw new Error('Invalid encrypted format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const encryptedBuffer = Buffer.from(encryptedHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);

    return decrypted.toString('utf8');
  }
}

module.exports = Encryptor;
