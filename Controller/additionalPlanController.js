const querystring = require('querystring');
const db = require('../Config/config'); // Your Database class
const definePLRDBPLREL = require('../Models/RDB/PLRDBPLREL'); // Model factory
const definePLRDBA01 = require('../Models/RDB/PLRDBA01');
const definePLRDBA02 = require('../Models/RDB/PLRDBA02');
const Encryptor = require('../Services/encryptor');
const { Op } = require('sequelize');
const M81Controller = require('./M81Controller');
const TokenService = require('../Services/tokenServices');
const BRCController = require('./BRCController');
const ADMIController = require('./ADMIController');
const sequelizeRDB = db.getConnection('RDB');
const PLRDBPLREL = definePLRDBPLREL(sequelizeRDB);
const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const PLRDBA02 = definePLRDBA02(sequelizeRDB);
const encryptor = new Encryptor();

class CustomModules {

    // Unified method to handle all CRUD operations
    static async handlePLRDBPLREL(req, res) {
        let response = { data: null, message: '', status: 'Success' };
        let encryptedResponse;
        const token = req.headers['authorization']?.split(' ')[1]; // 'Bearer <token>'
        let decoded;

        if (!token) {
            response.message = 'No token provided, authorization denied.'
            response.status = 'FAIL'
            const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(401).json({ encryptedResponse });
        }
        decoded = await TokenService.validateToken(token);
        let corpId = decoded.corpId;
        // let userId = decoded.userId;
        let sdbSeq = corpId.split('-');
        let sdbdbname = sdbSeq.length == 3 ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB' : sdbSeq[0] + sdbSeq[1] + 'SDB';
        // let admi = new ADMIController(sdbdbname);
        let m81 = new M81Controller(sdbdbname);
        let brc = new BRCController(sdbdbname);
        try {
            const parameterString = encryptor.decrypt(req.query.pa);
            let decodedParam = decodeURIComponent(parameterString);
            let pa = querystring.parse(decodedParam);
            const { action, RELF01, RELF02, RELF00 } = pa;

            switch (action) {
                case 'A': // Add (Create)
                    if (!RELF01 || !RELF02) {
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
                    let sdbSeq = (decoded.corpId).split('-');
                    let sdbdbname = sdbSeq.length == 3 ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB' : sdbSeq[0] + sdbSeq[1] + 'SDB';
                    let admi = new ADMIController(sdbdbname);
                    let m81 = new M81Controller(sdbdbname);
                    const allRecords = await PLRDBPLREL.findAll({
                        where: {
                            RELF00: {
                                [Op.ne]: 12
                            }
                        }
                    });
                    let allSetUpIds = await m81.findOne({
                        M81F01: 'U0000000'
                    });
                    let brcDetails = await brc.findAll({
                        BRGST: {
                            [Op.not]: ['']
                        }
                    });
                    let currentPlanDetails;
                    let a01Row = await PLRDBA01.findOne({
                        where: {
                            A01F03: decoded.corpId
                        }
                    });

                    let cmpDetail
                    let brcDetail;
                    let usrDetail;
                    let a02Rows = await PLRDBA02.findAll();
                    for (const arow of a02Rows) {
                        if (arow.A02F01 == a01Row.A02F01) {
                            currentPlanDetails = {
                                currenPlan: arow.A02F02,
                                currenPlanPrice: arow.A02F05
                            };
                        }
                        if (arow.A02F01 == 5) {
                            cmpDetail = {
                                totalCmp: a01Row.A01CMP,
                                totalPrice: parseInt(a01Row.A01CMP) * arow.A02F05
                            }
                        }
                        if (arow.A02F01 == 4) {
                            brcDetail = {
                                totalBrc: a01Row.A01BRC,
                                totalPrice: parseInt(a01Row.A01BRC) * arow.A02F05
                            }
                        }
                        if (arow.A02F01 == 3) {
                            usrDetail = {
                                totalUsr: a01Row.A01F10,
                                totalPrice: parseInt(a01Row.A01F10) * arow.A02F05
                            }
                        }
                    }
                    let admiRow = await admi.findOne({
                        ADMIF06: 2,
                        ADMICORP: a01Row.A01F01.trim()
                    });
                    let m81Row = await m81.findOne({
                        M81UNQ: admiRow.ADMIF00.toString()
                    });
                    let modList = admiRow.ADMIMOD;
                    let custModSetUp = await PLRDBPLREL.findAll();
                    let totalModule = [];
                    let totalSetUps = [];
                    for (const cms of custModSetUp) {
                        if (cms.RELF03 == 'M') {
                            if (modList && modList?.includes(cms.RELF01)) {
                                let row = {
                                    modId: cms.RELF01,
                                    modPrice: cms.RELF02
                                }
                                totalModule.push(row);
                            }
                        }
                        if (cms.RELF03 == 'C') {
                            if (modList && modList?.includes(cms.RELF01)) {
                                let row = {
                                    modId: cms.RELF01,
                                    modPrice: cms.RELF02
                                }
                                totalModule.push(row);
                            }
                        }
                        if (cms.RELF03 == 'S') {
                            let setUpList = m81Row.M81SID
                            let setUpId = cms.RELF01.split('-')
                            if (setUpList) {
                                setUpList = setUpList.includes(',') ? setUpList.split(',') : [setUpList];
                                for (const sId of setUpList) {
                                    if (sId == setUpId[1].trim()) {
                                        let row = {
                                            setUPId: setUpId[1].trim(),
                                            setUPPrice: cms.RELF02
                                        }
                                        totalSetUps.push(row);
                                    }
                                }
                            }
                        }
                    }

                    let reNewalPlanDetails = {
                        currentPlanDetails,
                        cmpDetail,
                        brcDetail,
                        usrDetail,
                        totalModule,
                        totalSetUps
                    }

                    response.data = { allRecords, allSetUpIds: allSetUpIds.M81SID, brcDetails, reNewalPlanDetails };
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
