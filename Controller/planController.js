const querystring = require('querystring');
require('dotenv').config();

const db = require('../Config/config'); // Your Database class
const definePLRDBA01 = require('../Models/RDB/PLRDBA01'); // Model factory
const definePLRDBGAO = require('../Models/RDB/PLRDBGAO'); // Model factory
const definePLRDBA02 = require('../Models/RDB/PLRDBA02'); // Model factory
const definePLRDBPYMT = require('../Models/RDB/PLRDBPYMT'); // Model factory
const definePLRDBRPAY = require('../Models/RDB/PLRDBRPAY');
const Encryptor = require('../Services/encryptor');
const { Op } = require('sequelize');
const TokenService = require('../Services/tokenServices');
const ADMIController = require('./ADMIController');
const M81Controller = require('./M81Controller');

// Get Sequelize instance for 'SDB' or your specific DB name
const sequelizeRDB = db.getConnection('RDB');

// Initialize model using the Sequelize instance
const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const PLRDBGAO = definePLRDBGAO(sequelizeRDB);
const PLRDBA02 = definePLRDBA02(sequelizeRDB);
const PLRDBPYMT = definePLRDBPYMT(sequelizeRDB);
const PLRDBRPAY = definePLRDBRPAY(sequelizeRDB);
const encryptor = new Encryptor();

class UpgradePlan {
    constructor() { }

    static async handlePlan(req, res) {
        const parameterString = encryptor.decrypt(req.query.pa);
        let decodedParam = decodeURIComponent(parameterString);
        let pa = querystring.parse(decodedParam);
        const { action, transactionId, A02id, additionalUser, additionalBranch, additionalCompany, moduleId, description, paymentMode, paymentMethod, modType } = pa;

        let response = { data: null, message: '', status: 'SUCCESS' };

        // Helper function for sending encrypted responses
        const sendResponse = (status, message, data = null) => {
            response.status = status;
            response.message = message;
            response.data = data;
            const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(status === 'SUCCESS' ? 200 : 400).json({ encryptedResponse });
        };

        try {

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
            let userId = decoded.userId;
            let sdbSeq = corpId.split('-');
            let sdbdbname = sdbSeq.length == 3 ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB' : sdbSeq[0] + sdbSeq[1] + 'SDB';
            let admi = new ADMIController(sdbdbname);
            let m81 = new M81Controller(sdbdbname)
            if (!action) {
                return sendResponse('FAIL', 'Invalid action');
            }

            // Action P - Plan Payment
            if (action === 'P') {
                const transactionDetail = await PLRDBRPAY.findOne({
                    where: { RPAYF01: transactionId }
                });

                if (!transactionDetail && paymentMode === 'ONLINE') {
                    return sendResponse('FAIL', 'Transaction not found');
                }

                const today = new Date();
                const todayFormatted = UpgradePlan.formatDate(today);

                // Get the date after one year
                const nextYear = new Date(today);
                nextYear.setFullYear(today.getFullYear() + 1);
                const nextYearFormatted = UpgradePlan.formatDate(nextYear);

                // Update user info in PLRDBA01
                const userUpdate = await PLRDBA01.update({
                    A02F01: A02id,
                    A02F12: todayFormatted,//today's date in YYYY-MM-DD formate
                    A02F13: nextYearFormatted//today's date after one year in YYYY-MM-DD formate
                }, {
                    where: { A01F03: corpId }
                });

                if (!userUpdate[0]) {
                    return sendResponse('FAIL', 'Failed to update user');
                }

                const userInfo = await PLRDBA01.findOne({
                    where: { A01F03: corpId }
                });

                if (!userInfo) {
                    return sendResponse('FAIL', 'User info not found');
                }

                const planInfo = await PLRDBA02.findOne({
                    where: { A02F01: userInfo.A02F01 }
                });

                if (!planInfo) {
                    return sendResponse('FAIL', 'Plan info not found');
                }

                // Construct Payment Data
                const paymentData = UpgradePlan.constructPaymentData(transactionDetail, paymentMode, A02id, corpId, userId, description, paymentMethod);
                const paymentInfo = await PLRDBPYMT.create(paymentData);

                return sendResponse('SUCCESS', 'Payment info updated successfully', paymentInfo);
            }

            // Action A - Update Branch, Company, or User Details
            else if (action === 'A') {
                const { additionalBranch, additionalCompany, userId, cmpNum, custBP, custRS, usrFld, usrMstr } = pa;

                if (!transactionId) {
                    return sendResponse('FAIL', 'Branch ID, Company ID, and User ID are required for action A');
                }

                const transactionDetail = await PLRDBRPAY.findOne({
                    where: { RPAYF01: transactionId }
                });

                if (!transactionDetail && paymentMode === 'ONLINE') {
                    return sendResponse('FAIL', 'Transaction not found');
                }

                if (additionalBranch > 0) {
                    let numOfBrc = await PLRDBA01.findOne({ A01F03: corpId });
                    let totalBranch = parseInt(numOfBrc.A01BRC) + parseInt(additionalBranch);
                    await PLRDBA01.update({
                        A01F10: totalBranch
                    }, {
                        A01F03: corpId
                    });
                }

                if (additionalCompany > 0) {
                    let numOfCmp = await PLRDBA01.findOne({ A01F03: corpId });
                    let totalCompany = parseInt(numOfCmp.A01CMP) + parseInt(additionalCompany);
                    await PLRDBA01.update({
                        A01F10: totalCompany
                    }, {
                        A01F03: corpId
                    });
                }

                if (additionalUser > 0) {
                    let numOfUsr = await PLRDBA01.findOne({ A01F03: corpId });
                    let totalUser = parseInt(numOfUsr.A01F10) + parseInt(additionalUser);
                    await PLRDBA01.update({
                        A01F10: totalUser
                    }, {
                        A01F03: corpId
                    });
                }
                if (cmpNum) {
                    let cmpList = cmpNum.includes(',') ? cmpNum.split(',') : [parseInt(cmpNum)];
                    for (let cmp of cmpList) {
                        let numOfUsr = await PLRDBGAO.findOne({ GAOF01: corpId, GAOF02: parseInt(cmp) });
                        if (!numOfUsr) {
                            await PLRDBGAO.create({
                                GAOF01: corpId,
                                GAOF02: parseInt(cmp),
                                GAOF03: 2, //Customized Bill Print(Formate Wise) Free
                                GAOF04: 0,
                                GAOF05: 5, // Customized Report Setup(Report Wise) Free
                                GAOF06: 0,
                                GAOF07: 50, // User Field(Limit Wise) Free
                                GAOF08: 0,
                                GAOF09: 5, // User Master(Limit Wise) Free
                                GAOF10: 0
                            });
                            numOfUsr = await PLRDBGAO.findOne({ GAOF01: corpId, GAOF02: parseInt(cmp) });
                        }
                        if (custBP > 0) {
                            let totalUser = parseInt(numOfUsr.GAOF03) + parseInt(custBP);
                            await PLRDBGAO.update({
                                GAOF03: totalUser
                            }, {
                                GAOF01: corpId
                            });
                        }
                        if (custRS > 0) {
                            let totalUser = parseInt(numOfUsr.GAOF05) + parseInt(custRS);
                            await PLRDBGAO.update({
                                GAOF05: totalUser
                            }, {
                                GAOF01: corpId
                            });
                        }
                        if (usrFld > 0) {
                            let totalUser = parseInt(numOfUsr.GAOF07) + parseInt(usrFld);
                            await PLRDBGAO.update({
                                GAOF07: totalUser
                            }, {
                                GAOF01: corpId
                            });
                        }
                        if (usrMstr > 0) {
                            let totalUser = parseInt(numOfUsr.GAOF09) + parseInt(usrMstr);
                            await PLRDBGAO.update({
                                GAOF09: totalUser
                            }, {
                                GAOF01: corpId
                            });
                        }
                    }
                }

                const paymentData = UpgradePlan.constructPaymentData(transactionDetail, paymentMode, A02id, corpId, userId, description, paymentMethod);
                await PLRDBPYMT.create(paymentData);
                return sendResponse('SUCCESS', 'Branch and company updated successfully');
            }

            // Action M - Update or Activate Modules
            else if (action === 'M') {
                const { moduleId, paymentMode, setUpId } = pa;

                const transactionDetail = await PLRDBRPAY.findOne({
                    where: { RPAYF01: transactionId }
                });

                if (!transactionDetail && paymentMode === 'ONLINE') {
                    return sendResponse('FAIL', 'Transaction not found');
                }

                let user
                let decryptedUserId = encryptor.decrypt(decoded.userId)
                const existing = await admi.findAll();
                for (let i of existing) {
                    const decrypted = encryptor.decrypt(i.ADMIF01)
                    if (decrypted == decryptedUserId) {
                        user = i;
                        response = {
                            message: 'User ID valid'
                        }
                    }
                }

                if (user) {
                    if (moduleId) {
                        // Ensure A01F01 and moduleId are numbers (optional but recommended)
                        const newADMIMOD = user.ADMIMOD + ',' + moduleId;
                        await admi.update({
                            ADMIMOD: newADMIMOD
                        }, {
                            ADMIF00: user.ADMIF00
                        });
                        if (!setUpId) {
                            const paymentData = UpgradePlan.constructPaymentData(null, paymentMode, A02id, decoded.corpId, user.ADMIF00, description, paymentMethod);
                            await PLRDBPYMT.create(paymentData);
                            return sendResponse('SUCCESS', 'Module activated for this user');
                        }
                    }
                    if (setUpId) {
                        let m81Usr = await m81.findOne({
                            M81F01: 'U0000000'
                        });
                        if (m81Usr.M81SID != null && m81Usr.M81SID != '') {
                            let newsetUpId = m81Usr.M81SID + ',' + setUpId;
                            await m81.update({
                                M81SID: newsetUpId
                            });
                        } else {
                            await m81.update({
                                M81SID: setUpId
                            });
                        }
                        if (!moduleId) {
                            const paymentData = UpgradePlan.constructPaymentData(null, paymentMode, A02id, decoded.corpId, user.ADMIF00, description, paymentMethod);
                            await PLRDBPYMT.create(paymentData);
                            return sendResponse('SUCCESS', 'SetUp activated for this user');
                        }
                        const paymentData = UpgradePlan.constructPaymentData(null, paymentMode, A02id, decoded.corpId, user.ADMIF00, description, paymentMethod);
                        await PLRDBPYMT.create(paymentData);
                        return sendResponse('SUCCESS', 'Module activated for this user');
                    }
                }
            }

            // Action G - Get Transactions
            else if (action === 'G') {
                let finalTransaction = [];
                const allTransaction = await PLRDBPYMT.findAll({
                    where: { PYMT01: corpId }
                });
                const planRows = await PLRDBA02.findAll();
                const userRows = await PLRDBA01.findOne({
                    where: { A01F03: corpId }
                });

                // Ensure userRows.A01F12 is a valid date (assuming it's in the format '2025-08-10T00:00:00.000Z')
                const startDate = new Date(userRows.A01F12);

                // Process each transaction to add BILLCYCLE key
                allTransaction.forEach(transaction => {
                    const transactionDate = new Date(transaction.dataValues.PYMT08); // Assuming PYMT08 is a timestamp

                    // Calculate the difference in days
                    const timeDifference = transactionDate - startDate;
                    const dayDifference = Math.floor(timeDifference / (1000 * 60 * 60 * 24)); // Convert ms to days

                    // Add the BILLCYCLE key based on the days difference
                    if (dayDifference > 365) {
                        transaction.dataValues.BILLCYCLE = 'Complete';
                    } else {
                        transaction.dataValues.BILLCYCLE = dayDifference;
                    }
                });

                // Add plan name to transactions
                for (let transaction of allTransaction) {
                    let matchingPlan = planRows.find(plan => plan.A02F01.toString().trim() === transaction.PYMT01.toString().trim());
                    transaction.dataValues.PYMTPNM = matchingPlan ? matchingPlan.A02F02 : null;
                    finalTransaction.push(transaction.dataValues);
                }
                return sendResponse('SUCCESS', 'Transactions fetched successfully', finalTransaction);
            }
            // Invalid action
            else {
                return sendResponse('FAIL', 'Invalid action type');
            }

        } catch (error) {
            console.error(error);
            return res.status(500).json({
                message: 'An error occurred while processing the plan.',
                error: error.message,
                status: 'FAILURE'
            });
        }
    }

    // Helper function to construct payment data
    static constructPaymentData(transactionDetail, paymentMode, A02id, corpId, userId, description, paymentMethod) {
        const tranInfo = transactionDetail?.RPAYF02;
        let transactionId = ''
        const now = new Date();
        if (paymentMode == 'OFFLINE') {
            // Format the date as YYYYMMDD_HHMMSS
            const date = now.toISOString().replace(/[-:T.]/g, '').slice(0, 15); // Format as YYYYMMDD_HHMMSS
            transactionId = 'TXN_' + date;
        }
        return paymentMode === 'ONLINE'
            ? {
                PYMT01: corpId,
                PYMT02: userId,
                PYMT03: tranInfo.id,
                PYMT04: paymentMode,
                PYMT05: tranInfo.amount,
                PYMT06: tranInfo.status,
                PYMT07: tranInfo.method,
                PYMT09: description,
                PYMT10: (UpgradePlan.nextDate(365)).toString(), // Next payment date
            }
            : {
                PYMT01: corpId,
                PYMT02: userId,
                PYMT03: transactionId,
                PYMT04: paymentMode,
                PYMT05: 0,
                PYMT06: 'SUCCESS',
                PYMT07: 'CASH',
                PYMT09: description,
                PYMT10: (UpgradePlan.nextDate(365)).toString(), // Next payment date
            };
    }

    static formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Method to get the next date given a range (in days)
    static nextDate(range = 1) {
        const currentDate = new Date();
        currentDate.setDate(currentDate.getDate() + range);

        const year = currentDate.getFullYear();
        const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
        const day = currentDate.getDate().toString().padStart(2, '0');

        return `${year}-${month}-${day}`;
    }
}

module.exports = UpgradePlan;
