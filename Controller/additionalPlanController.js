const querystring = require('querystring');
const db = require('../Config/config'); // Your Database class
const definePLRDBPLREL = require('../Models/RDB/PLRDBPLREL'); // Model factory
const Encryptor = require('../Services/encryptor');
const sequelizeRDB = db.getConnection('RDB');
const PLRDBPLREL = definePLRDBPLREL(sequelizeRDB);
const encryptor = new Encryptor();

class CustomModules {

    // Unified method to handle all CRUD operations
    static async handlePLRDBPLREL(req, res) {
        let response = { data: null, message: '', status: 'Success' };
        let encryptedResponse;
        try {
            const parameterString = encryptor.decrypt(req.query.pa);
            let decodedParam = decodeURIComponent(parameterString);
            let pa = querystring.parse(decodedParam);
            const { action, RELF01, RELF02, RELF00 } = pa;

            switch (action) {
                case 'A': // Add (Create)
                    if ( !RELF01 || !RELF02) {
                        throw new Error('Data for Add operation is incomplete');
                    }
                    const newRecord = await PLRDBPLREL.create({
                        RELF01: RELF01,
                        RELF02: RELF02
                    });
                    response.data = newRecord;
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(200).json({ encryptedResponse });

                case 'E': // Edit (Update)
                    if (!RELF00) {
                        throw new Error('Data or ID is missing for Edit operation');
                    }
                    const recordToEdit = await PLRDBPLREL.findOne({ where: { RELF00: RELF00 } });
                    if (!recordToEdit) {
                        throw new Error('Record not found');
                    }
                    recordToEdit.RELF01 = RELF01 || recordToEdit.RELF01;
                    recordToEdit.RELF02 = RELF02 || recordToEdit.RELF02;
                    await recordToEdit.save();  // Save the updated record
                    response.data = recordToEdit;
                    response.message = 'Record edited successfully'
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(200).json({ encryptedResponse });

                case 'D': // Delete
                    if (!RELF00) {
                        throw new Error('ID is missing for Delete operation');
                    }
                    const deleteResult = await PLRDBPLREL.destroy({ where: { RELF00: RELF00 } });
                    if (deleteResult === 0) {
                        throw new Error('Record not found or already deleted');
                    }
                    response.message = 'Record deleted successfully'
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(200).json({ encryptedResponse });

                case 'G': // Get All
                    const allRecords = await PLRDBPLREL.findAll();
                    response.data = allRecords;
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(200).json({ encryptedResponse });

                default:
                    throw new Error('Invalid action');
            }
        } catch (error) {
            console.error(error);
            response.message = error
            encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            res.status(500).json({ encryptedResponse })
            console.error('Error in handleCustomModule:', error);
            throw error;  // Rethrow the error to be handled elsewhere
        }
    }
}

module.exports = CustomModules;
