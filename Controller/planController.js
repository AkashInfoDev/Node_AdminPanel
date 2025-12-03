const querystring = require('querystring');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('../Config/config'); // Your Database class
const definePLSDBADMI = require('../Models/SDB/PLSDBADMI'); // Model factory
const definePLSDBREL = require('../Models/SDB/PLSDBREL'); // Model factory
const definePLRDBA01 = require('../Models/RDB/PLRDBA01'); // Model factory
const definePLRDBA02 = require('../Models/RDB/PLRDBA02'); // Model factory
const definePLRDBPYMT = require('../Models/RDB/PLRDBPYMT'); // Model factory
const definePLSDBM81 = require('../Models/SDB/PLSDBM81');
const definePLRDBRPAY = require('../Models/RDB/PLRDBRPAY');
const definePLSDBUBC = require('../Models/RDB/PLSDBUBC');
const Encryptor = require('../Services/encryptor');
const { Op } = require('sequelize');
const TokenService = require('../Services/tokenServices');
const CompanyService = require('../Controller/companyController');
const AuthenticationService = require('../Services/loginServices');

// Get Sequelize instance for 'SDB' or your specific DB name
const sequelizeSDB = db.getConnection('A00001SDB');
const sequelizeRDB = db.getConnection('RDB');

// Initialize model using the Sequelize instance
const PLSDBADMI = definePLSDBADMI(sequelizeSDB);
const PLSDBREL = definePLSDBREL(sequelizeSDB);
const PLSDBM81 = definePLSDBM81(sequelizeSDB);
const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const PLRDBA02 = definePLRDBA02(sequelizeRDB);
const PLRDBPYMT = definePLRDBPYMT(sequelizeRDB);
const PLRDBRPAY = definePLRDBRPAY(sequelizeRDB);
const PLSDBUBC = definePLSDBUBC(sequelizeRDB);
const encryptor = new Encryptor();

class UpgradePlan {
    constructor() { }

    static async handlePlan(req, res) {
        const parameterString = encryptor.decrypt(req.query.pa);
        let decodedParam = decodeURIComponent(parameterString);
        let pa = querystring.parse(decodedParam);
        const { action, transactionId, A02id, corpId, userId, additionalUser, additionalBranch, additionalCompany, moduleId, description, paymentMode, paymentMethod } = pa;

        let response = { data: null, message: '', status: 'SUCCESS' };

        // Helper function for sending encrypted responses
        const sendResponse = (status, message, data = null) => {
            response.status = status;
            response.message = message;
            response.data = data;
            const encryptresponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(status === 'SUCCESS' ? 200 : 400).json({ encryptresponse });
        };

        try {
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
                const { additionalBranch, additionalCompany, userId } = pa;

                if (!transactionId || !additionalBranch || !additionalCompany || !userId) {
                    return sendResponse('FAIL', 'Branch ID, Company ID, and User ID are required for action A');
                }

                const transactionDetail = await PLRDBRPAY.findOne({
                    where: { RPAYF01: transactionId }
                });

                if (!transactionDetail && paymentMode === 'ONLINE') {
                    return sendResponse('FAIL', 'Transaction not found');
                }

                if (additionalBranch > 0) {
                    await PLSDBADMI.update({
                        ADMIBRC: additionalBranch,
                    }, {
                        where: {
                            ADMIF00: userInfo.A01F01,
                            ADMIF06: 2
                        }
                    });
                }

                if (additionalCompany > 0) {
                    await PLSDBADMI.update({
                        ADMICOMP: additionalCompany,
                    }, {
                        where: {
                            ADMIF00: userInfo.A01F01,
                            ADMIF06: 2
                        }
                    });
                }

                if (additionalUser > 0) {
                    await PLRDBA01.update({
                        A01F10: additionalUser
                    }, {
                        where: { A01F03: corpId }
                    });
                }

                const paymentData = UpgradePlan.constructPaymentData(transactionDetail, paymentMode, A02id, corpId, userId, description, paymentMethod);
                await PLRDBPYMT.create(paymentData);

                return sendResponse('SUCCESS', 'Branch and company updated successfully');
            }

            // Action M - Update or Activate Modules
            else if (action === 'M') {
                const { moduleId, userId, paymentMode } = pa;

                let user = await PLSDBADMI.findOne({
                    where: { ADMIF00: userId }
                });

                if (user && moduleId) {
                    // Ensure A01F01 and moduleId are numbers (optional but recommended)
                    const newADMIMOD = user.ADMIMOD + ',' + moduleId;

                    await PLSDBADMI.update({
                        ADMIMOD: newADMIMOD
                    }, {
                        where: { ADMIF00: userId }
                    });
                    const paymentData = UpgradePlan.constructPaymentData(null, paymentMode, A02id, corpId, userId, description, paymentMethod);
                    await PLRDBPYMT.create(paymentData);
                    return sendResponse('SUCCESS', 'Module activated for this user');
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
        const isoString = now.toISOString();
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
                PYMT04: 'ONLINE',
                PYMT05: tranInfo.amount,
                PYMT06: tranInfo.status,
                PYMT07: tranInfo.method,
                PYMT08: isoString,
                PYMT09: description,
                PYMT10: (UpgradePlan.nextDate(365)).toString(), // Next payment date
            }
            : {
                PYMT01: corpId,
                PYMT02: userId,
                PYMT03: transactionId,
                PYMT04: 'OFFLINE',
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
