const Encryptor = require("../Services/encryptor");
const TokenService = require("../Services/tokenServices");
const jwt = require('jsonwebtoken'); // Make sure you have the jwt package installed.

const encryptor = new Encryptor();

class reGenToken {
    static async tokenHandler(req, res) {
        const token = req.headers['authorization']?.split(' ')[1]; // 'Bearer <token>'

        if (!token) {
            let response = {
                message: 'No token provided, authorization denied.',
                status: 'FAIL'
            };
            const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(401).json({ encryptedResponse });
        }

        try {
            // Decode the token to extract the expiration time (exp)
            const decoded = jwt.decode(token);
            const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
            const expTime = decoded?.exp; // Expiration time in seconds from the token

            if (!expTime) {
                let response = {
                    message: 'Invalid token, no expiration time found.',
                    status: 'FAIL'
                };
                const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                return res.status(400).json({ encryptedResponse });
            }

            // Check if token will expire in 1 hour or less
            if (expTime - currentTime <= 3600) {  // 3600 seconds = 1 hour
                // Token is close to expiration, regenerate it
                delete decoded.exp
                delete decoded.iat
                const newToken = jwt.sign(decoded, process.env.JWT_SECRET_KEY, { expiresIn: process.env.JWT_EXPIRATION });
                let response = {
                    message: 'Token expired soon, new token generated.',
                    status: 'SUCCESS',
                    newToken: newToken
                };
                const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                return res.status(200).json({ encryptedResponse });
            }

            // Token is still valid, just return it
            let response = {
                message: 'Token is still valid.',
                status: 'SUCCESS'
            };
            const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(200).json({ encryptedResponse });

        } catch (error) {
            let response = {
                message: 'Error processing the token.',
                status: 'FAIL',
                error: error.message
            };
            const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(500).json({ encryptedResponse });
        }
    }
}
module.exports = reGenToken;