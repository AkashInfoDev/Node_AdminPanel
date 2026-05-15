const Encryptor = require("../Services/encryptor");
const TokenService = require("../Services/tokenServices");
const db = require('../Config/config');
const defineEP_LOGIN = require('../Models/RDB/EP_LOGIN');
const jwt = require('jsonwebtoken'); // Make sure you have the jwt package installed.
const M83Controller = require("./M83Controller");
const sequelizeRDB = db.getConnection('RDB');

const EP_LOGIN = defineEP_LOGIN(sequelizeRDB);

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
                let corpId = decoded.corpId.toUpperCase();
                let sdbSeq = corpId.split('-');
                let sdbdbname = sdbSeq.length == 3 ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB' : sdbSeq[0] + sdbSeq[1] + 'SDB';
                let m83 = new M83Controller(sdbdbname);
                let uID = encryptor.decrypt(decoded.userId)
                await m83.update(
                    { M83F07: newToken },
                    { M83F01: uID }
                );
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
    static async userTokenHandler(req, res) {

        const token =
            req.headers['authorization']?.split(' ')[1];

        if (!token) {

            let response = {
                message: 'No token provided.',
                status: 'FAIL'
            };

            const encryptedResponse =
                encryptor.encrypt(JSON.stringify(response));

            return res.status(401).json({
                encryptedResponse
            });
        }

        try {

            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET_KEY
            );

            const currentTime =
                Math.floor(Date.now() / 1000);

            const expTime = decoded?.exp;

            if (!expTime) {

                let response = {
                    message: 'Invalid token.',
                    status: 'FAIL'
                };

                const encryptedResponse =
                    encryptor.encrypt(JSON.stringify(response));

                return res.status(400).json({
                    encryptedResponse
                });
            }

            /* ============================================
               🔄 EXPIRES IN <= 1 HOUR
            ============================================ */

            if (expTime - currentTime <= 3600) {

                delete decoded.exp;
                delete decoded.iat;

                const newToken = jwt.sign(
                    decoded,
                    process.env.JWT_SECRET_KEY,
                    {
                        expiresIn:
                            process.env.JWT_EXPIRATION
                    }
                );
                const dbUserId = decoded.Id;

                /* ============================================
                   🔄 UPDATE LOGIN TOKEN
                ============================================ */

                const now = new Date();

                const formattedDate =
                    now.getFullYear() + '-' +
                    String(now.getMonth() + 1).padStart(2, '0') + '-' +
                    String(now.getDate()).padStart(2, '0') + ' ' +
                    String(now.getHours()).padStart(2, '0') + ':' +
                    String(now.getMinutes()).padStart(2, '0') + ':' +
                    String(now.getSeconds()).padStart(2, '0') + '.' +
                    String(now.getMilliseconds()).padStart(3, '0');

                console.log(formattedDate);

                await EP_LOGIN.update(
                    {
                        LOG04: newToken,
                        // LOG03: formattedDate
                    },
                    {
                        where: {
                            LOG02: dbUserId
                        }
                    }
                );

                let response = {
                    message: 'New token generated.',
                    status: 'SUCCESS',
                    newToken
                };

                const encryptedResponse =
                    encryptor.encrypt(JSON.stringify(response));

                return res.status(200).json({
                    encryptedResponse
                });
            }

            /* ============================================
               ✅ TOKEN STILL VALID
            ============================================ */

            let response = {
                message: 'Token is still valid.',
                status: 'SUCCESS'
            };

            const encryptedResponse =
                encryptor.encrypt(JSON.stringify(response));

            return res.status(200).json({
                encryptedResponse
            });

        } catch (error) {

            let response = {
                message: 'Error processing token.',
                status: 'FAIL',
                error: error.message
            };

            const encryptedResponse =
                encryptor.encrypt(JSON.stringify(response));

            return res.status(500).json({
                encryptedResponse
            });
        }
    }
}
module.exports = reGenToken;