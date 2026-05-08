const db = require('../Config/config')
const defineDBSER_INFO = require('../Models/RDB/DBSER_INFO')
const Encryptor = require('../Services/encryptor');
const querystring = require('querystring');
const TokenService = require('../Services/tokenServices');
const { Op } = require('sequelize');

const sequelizeRDB = db.getConnection('RDB');
const DBSER_INFO = defineDBSER_INFO(sequelizeRDB);
const encryptor = new Encryptor();

async function handleActionGet(req, res) {
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

        let encrypted_04;
        let encrypted_07;
        if (INFO_04 && !isEncrypted(INFO_04) && (action == 'A' || action == 'E')) {
            encrypted_04 = encryptor.encrypt(INFO_04);
        } else {
            encrypted_04 = INFO_04; // decrypted String
        }

        if (INFO_07 && !isEncrypted(INFO_07) && (action == 'A' || action == 'E')) {
            encrypted_07 = encryptor.encrypt(INFO_07);
        } else {
            encrypted_07 = INFO_07; // decrypted String
        }

        switch (action) {

            // 🔹 Get All Records
            case 'G': {
                const records = await DBSER_INFO.findAll();
                response.data = records;
                encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                return res.json({ encryptedResponse });
            }

            // 🔹 Add New Record
            case 'A': {
                const newRecord = await DBSER_INFO.create({
                    INFO_02, INFO_03, encrypted_04, INFO_05,
                    INFO_06, encrypted_07, INFO_08, INFO_09, INFO_10, INFO_11
                });
                response.data = newRecord;
                encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                return res.status(201).json({ encryptedResponse });
            }

            // 🔹 Edit Record
            case 'E': {
                if (!INFO_01) {
                    response.message = 'INFO_01 (ID) is required for update';
                    response.status = 'FAIL';
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(400).json({ encryptedResponse });
                }
                let id = parseInt(INFO_01)
                const [updated] = await DBSER_INFO.update({
                    INFO_02, INFO_03, INFO_04: encrypted_04, INFO_05,
                    INFO_06, INFO_07: encrypted_07, INFO_08, INFO_09
                }, { where: { INFO_01: id } });

                if (!updated) {
                    response.message = 'Record not found';
                    response.status = 'FAIL';
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(404).json({ encryptedResponse });
                }

                const updatedRecord = await DBSER_INFO.findByPk(INFO_01);
                response.data = updatedRecord;
                encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                return res.json({ encryptedResponse });
            }

            // 🔹 Delete Record
            case 'D': {
                if (!INFO_01) {
                    response.message = 'INFO_01 (ID) is required for deletion';
                    response.status = 'FAIL';
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(400).json({ encryptedResponse });
                }

                const deleted = await DBSER_INFO.destroy({ where: { INFO_01 } });
                if (!deleted) {
                    response.message = 'Record not found';
                    response.status = 'FAIL';
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(404).json({ encryptedResponse });
                }

                response.message = 'Record deleted successfully';
                encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                return res.json({ encryptedResponse });
            }

            case 'F': {
                if (!INFO_01) {
                    response.message = 'INFO_01 (ID) is required to set active record';
                    response.status = 'FAIL';
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(400).json({ encryptedResponse });
                }

                // Start a transaction to ensure atomic update
                const transaction = await DBSER_INFO.sequelize.transaction();
                try {
                    // Set all other records to inactive
                    await DBSER_INFO.update(
                        { INFO_11: 'N' },
                        { where: { INFO_01: { [Op.ne]: INFO_01 } }, transaction }
                    );

                    // Set the requested record to active
                    const [updated] = await DBSER_INFO.update(
                        { INFO_11: 'Y' },
                        { where: { INFO_01 }, transaction }
                    );

                    if (!updated) {
                        await transaction.rollback();
                        response.message = 'Record not found';
                        response.status = 'FAIL';
                        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(404).json({ encryptedResponse });
                    }

                    // Commit transaction
                    await transaction.commit();

                    // Fetch the newly active record
                    const updatedRecord = await DBSER_INFO.findByPk(INFO_01);
                    response.data = updatedRecord;
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.json({ encryptedResponse });

                } catch (error) {
                    console.log(error);
                    await transaction.rollback();
                    response.message = 'Error updating active status';
                    response.status = 'FAIL';
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(500).json({ encryptedResponse });
                }
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

module.exports = { handleActionGet }