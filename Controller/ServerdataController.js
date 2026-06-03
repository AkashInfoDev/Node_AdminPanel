const db = require('../Config/config')
const defineDBSER_INFO = require('../Models/RDB/DBSER_INFO')
const Encryptor = require('../Services/encryptor');
const querystring = require('querystring');
const TokenService = require('../Services/tokenServices');
const { Op } = require('sequelize');

const sequelizeRDB = db.getConnection('RDB');
const DBSER_INFO = defineDBSER_INFO(sequelizeRDB);
const encryptor = new Encryptor();

async function handleServer(req, res) {
    let response = { data: null, message: '', status: 'SUCCESS' };
    let encryptedResponse;

    // 1️⃣ Check Authorization
    const token = req.headers['authorization']?.split(' ')[1]; // 'Bearer <token>'
    if (!token) {
        response.message = 'No token provided, authorization denied.';
        response.status = 'FAIL';
        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        return res.status(401).json({ encryptedResponse });
    }

    let decoded;
    try {
        decoded = await TokenService.validateToken(token);
    } catch (err) {
        response.message = 'Invalid token.';
        response.status = 'FAIL';
        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        return res.status(401).json({ encryptedResponse });
    }

    try {
        // 2️⃣ Decrypt and parse parameters
        const parameterString = encryptor.decrypt(req.query.pa);
        const decodedParam = decodeURIComponent(parameterString);
        const pa = querystring.parse(decodedParam);

        const {
            action,
            INFO_01, INFO_02, INFO_03, INFO_04, INFO_05,
            INFO_06, INFO_07, INFO_08, INFO_09, INFO_10, INFO_11
        } = pa;

        switch (action) {

            // 🔹 Get All Records
            case 'G': {
                const records = await DBSER_INFO.findAll({
                    attributes: ['INFO_01', 'INFO_02', 'INFO_03']
                });

                response.data = records;
                encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                return res.json({ encryptedResponse });
            }

            default: {
                response.message = 'Invalid action';
                response.status = 'FAIL';
                encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                return res.status(400).json({ encryptedResponse });
            }
        }

    } catch (error) {
        console.error(error);
        response.message = 'Server error';
        response.status = 'FAIL';
        response.data = error.message;
        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        return res.status(500).json({ encryptedResponse });
    }
};

function isEncrypted(str) {
    const encryptedPattern = /^[0-9a-f]{32}:[0-9a-f]{128,}$/i;
    return typeof str === 'string' && encryptedPattern.test(str);
}

module.exports = { handleServer }