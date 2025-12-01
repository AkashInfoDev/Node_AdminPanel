// const querystring = require('querystring');
// const jwt = require('jsonwebtoken');
// require('dotenv').config();

// const db = require('../Config/config'); // Your Database class
// const definePLSDBADMI = require('../Models/SDB/PLSDBADMI'); // Model factory
// const definePLSDBREL = require('../Models/SDB/PLSDBREL'); // Model factory
// const definePLRDBA01 = require('../Models/RDB/PLRDBA01'); // Model factory
// const definePLRDBA02 = require('../Models/RDB/PLRDBA02'); // Model factory
// const definePLRDBPYMT = require('../Models/RDB/PLRDBPYMT'); // Model factory
// const definePLSDBM81 = require('../Models/SDB/PLSDBM81');
// const definePLRDBRPAY = require('../Models/RDB/PLRDBRPAY');
// const definePLSDBUBC = require('../Models/RDB/PLSDBUBC');
// const Encryptor = require('../Services/encryptor');
// const { Op } = require('sequelize');
// const TokenService = require('../Services/tokenServices');
// const CompanyService = require('../Controller/companyController');
// const AuthenticationService = require('../Services/loginServices');

// // Get Sequelize instance for 'SDB' or your specific DB name
// const sequelizeSDB = db.getConnection('A00001SDB');
// const sequelizeRDB = db.getConnection('RDB');

// // Initialize model using the Sequelize instance
// const PLSDBADMI = definePLSDBADMI(sequelizeSDB);
// const PLSDBREL = definePLSDBREL(sequelizeSDB);
// const PLSDBM81 = definePLSDBM81(sequelizeSDB);
// const PLRDBA01 = definePLRDBA01(sequelizeRDB);
// const PLRDBA02 = definePLRDBA02(sequelizeRDB);
// const PLRDBPYMT = definePLRDBPYMT(sequelizeRDB);
// const PLRDBRPAY = definePLRDBRPAY(sequelizeRDB);
// const PLSDBUBC = definePLSDBUBC(sequelizeRDB);
// const encryptor = new Encryptor();

// class UpgradePlan {
//     constructor() { }

//     static async handlePlan(req, res) {
//         const { action, transactionId, A02id, corpId, userId, additionalUser, additionalBranch, additionalCompany, moduleId, description } = req.query;

//         let response = { data: null, message: '', status: 'SUCCESS' };

//         try {
//             if (!action) {
//                 return res.status(400).json({ message: 'Invalid action' });
//             }

//             if (action == 'P') {

//                 // Fetch transaction details from PLRDBRPAY table
//                 const transactionDetail = await PLRDBRPAY.findOne({
//                     where: { RPAYF01: transactionId }
//                 });

//                 if (!transactionDetail) {
//                     return res.status(404).json({ message: 'Transaction not found' });
//                 }

//                 // Update user info in PLRDBA01
//                 const userUpdate = await PLRDBA01.update({
//                     A02F01: A02id
//                 }, {
//                     where: { A01F03: corpId }
//                 });

//                 if (!userUpdate[0]) {
//                     return res.status(400).json({ message: 'Failed to update user' });
//                 }

//                 const userInfo = await PLRDBA01.findOne({
//                     where: { A01F03: corpId }
//                 });

//                 if (!userInfo) {
//                     return res.status(404).json({ message: 'User info not found' });
//                 }

//                 const planInfo = await PLRDBA02.findOne({
//                     where: { A02F01: userInfo.A02F01 }
//                 });

//                 if (!planInfo) {
//                     return res.status(404).json({ message: 'Plan info not found' });
//                 }

//                 // Update admin info in PLSDBADMI
//                 // const admiInfo = await PLSDBADMI.update({
//                 //     ADMIMOD: planInfo.A02F12
//                 // }, {
//                 //     where: { ADMICORP: userInfo.A01F01 }
//                 // });

//                 let UserAdd = await PLSDBUBC.findOne({
//                     where: { UBCF05: userInfo.A01F01 }
//                 })
//                 if (UserAdd) {
//                     let planAdd = await PLSDBUBC.update({
//                         UBCF01: additionalUser,
//                         UBCF02: additionalBranch,
//                         UBCF03: additionalCompany,
//                         UBCF04: planInfo.A02F12,
//                         // UBCF05: userInfo.A01F01
//                     }, {
//                         where: { UBCF05: userInfo.A01F01 }
//                     });
//                 }else{
//                     let planAdd = await PLSDBUBC.create({
//                         UBCF01: additionalUser,
//                         UBCF02: additionalBranch,
//                         UBCF03: additionalCompany,
//                         UBCF04: planInfo.A02F12,
//                         UBCF05: userInfo.A01F01
//                     });
//                 }
//                 // Payment information creation
//                 const tranInfo = transactionDetail.RPAYF02;
//                 const paymentData = {
//                     PYMT01: A02id,
//                     PYMT02: corpId,
//                     PYMT03: userId,
//                     PYMT04: 'ONLINE', // Payment Type
//                     PYMT05: additionalUser,
//                     PYMT06: additionalCompany,
//                     PYMT07: additionalBranch,
//                     PYMT08: planInfo.A02F12,
//                     PYMT09: '365', // Number of days
//                     PYMT10: description, // Payment Description
//                     PYMT11: tranInfo.id, // Transaction ID
//                     PYMT12: tranInfo.amount, // Amount
//                     PYMT13: tranInfo.status, // Payment Status
//                     PYMT15: tranInfo.method, // Payment Method
//                     PYMT16: UpgradePlan.nextDate(365) // Next Payment date - call as static method
//                 };

//                 const paymentInfo = await PLRDBPYMT.create(paymentData);

//                 // Send success response
//                 return res.status(200).json({
//                     data: paymentInfo,
//                     message: 'Payment info updated successfully',
//                     status: 'SUCCESS'
//                 });
//             } else if (action == 'A') {
//                 // Fetch transaction details from PLRDBRPAY table
//                 const transactionDetail = await PLRDBRPAY.findOne({
//                     where: { RPAYF01: transactionId }
//                 });

//                 if (!transactionDetail) {
//                     return res.status(404).json({ message: 'Transaction not found' });
//                 }

//                 const userInfo = await PLRDBA01.findOne({
//                     where: { A01F03: corpId }
//                 });

//                 if (!userInfo) {
//                     return res.status(404).json({ message: 'User info not found' });
//                 }

//                 const planInfo = await PLRDBA02.findOne({
//                     where: { A02F01: userInfo.A02F01 }
//                 });

//                 if (!planInfo) {
//                     return res.status(404).json({ message: 'Plan info not found' });
//                 }

//                 // Update admin info in PLSDBADMI
//                 const admiInfo = await PLRDBA01.update({
//                     A01F10: userInfo.A01F10 + additionalUser
//                 }, {
//                     where: { ADMICORP: userInfo.A01F01 }
//                 });

//                 // Payment information creation
//                 const tranInfo = transactionDetail.RPAYF02;
//                 const paymentData = {
//                     PYMT01: A02id,
//                     PYMT02: corpId,
//                     PYMT03: userId,
//                     PYMT04: 'ONLINE', // Payment Type
//                     PYMT05: additionalUser,
//                     PYMT06: additionalCompany,
//                     PYMT07: additionalBranch,
//                     PYMT08: planInfo.A02F12,
//                     PYMT09: '365', // Number of days
//                     PYMT10: description, // Payment Description
//                     PYMT11: tranInfo.id, // Transaction ID
//                     PYMT12: tranInfo.amount, // Amount
//                     PYMT13: tranInfo.status, // Payment Status
//                     PYMT15: tranInfo.method, // Payment Method
//                     PYMT16: UpgradePlan.nextDate(365) // Next Payment date - call as static method
//                 };

//                 const paymentInfo = await PLRDBPYMT.create(paymentData);

//                 // Send success response
//                 return res.status(200).json({
//                     data: paymentInfo,
//                     message: 'Payment info updated successfully',
//                     status: 'SUCCESS'
//                 });
//             } else if (action == 'M') {
//                 // Fetch transaction details from PLRDBRPAY table
//                 const transactionDetail = await PLRDBRPAY.findOne({
//                     where: { RPAYF01: transactionId }
//                 });

//                 if (!transactionDetail) {
//                     return res.status(404).json({ message: 'Transaction not found' });
//                 }
//             }

//         } catch (error) {
//             console.error(error);
//             return res.status(500).json({
//                 message: 'An error occurred while processing the plan.',
//                 error: error.message,
//                 status: 'FAILURE'
//             });

//         }
//     }

//     // Method to get the next date given a range (in days)
//     static nextDate(range = 1) {
//         const currentDate = new Date();
//         currentDate.setDate(currentDate.getDate() + range);

//         const year = currentDate.getFullYear();
//         const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
//         const day = currentDate.getDate().toString().padStart(2, '0');

//         return `${year}-${month}-${day}`;
//     }
// }

// module.exports = UpgradePlan;


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
        const { action, transactionId, A02id, corpId, userId, additionalUser, additionalBranch, additionalCompany, moduleId, description } = pa;

        let response = { data: null, message: '', status: 'SUCCESS' };

        try {
            if (!action) {
                return res.status(400).json({ message: 'Invalid action' });
            }

            if (action == 'P') {
                // Action P logic (Plan Payment)
                const transactionDetail = await PLRDBRPAY.findOne({
                    where: { RPAYF01: transactionId }
                });

                if (!transactionDetail) {
                    return res.status(404).json({ message: 'Transaction not found' });
                }

                // Update user info in PLRDBA01
                const userUpdate = await PLRDBA01.update({
                    A02F01: A02id
                }, {
                    where: { A01F03: corpId }
                });

                if (!userUpdate[0]) {
                    response.status = 'Fail';
                    response.message = 'Failed to update user'
                    const encryptresponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(400).json({ encryptresponse });
                }

                const userInfo = await PLRDBA01.findOne({
                    where: { A01F03: corpId }
                });

                if (!userInfo) {
                    response.status = 'Fail';
                    response.message = 'User info not found'
                    const encryptresponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(404).json({ encryptresponse });
                }

                const planInfo = await PLRDBA02.findOne({
                    where: { A02F01: userInfo.A02F01 }
                });

                if (!planInfo) {
                    response.status = 'Fail';
                    response.message = 'Plan info not found'
                    const encryptresponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(404).json({ encryptresponse });
                }

                let UserAdd = await PLSDBUBC.findOne({
                    where: { UBCF05: userInfo.A01F01 }
                })
                if (UserAdd) {
                    let planAdd = await PLSDBUBC.update({
                        UBCF01: additionalUser,
                        UBCF02: additionalBranch,
                        UBCF03: additionalCompany,
                        UBCF04: planInfo.A02F12,
                    }, {
                        where: { UBCF05: userInfo.A01F01 }
                    });
                } else {
                    let planAdd = await PLSDBUBC.create({
                        UBCF01: additionalUser,
                        UBCF02: additionalBranch,
                        UBCF03: additionalCompany,
                        UBCF04: planInfo.A02F12,
                        UBCF05: userInfo.A01F01
                    });
                }

                const tranInfo = transactionDetail.RPAYF02;
                const paymentData = {
                    PYMT01: A02id,
                    PYMT02: corpId,
                    PYMT03: userId,
                    PYMT04: 'ONLINE',
                    PYMT05: additionalUser,
                    PYMT06: additionalCompany,
                    PYMT07: additionalBranch,
                    PYMT08: planInfo.A02F12,
                    PYMT09: '365',
                    PYMT10: description,
                    PYMT11: tranInfo.id,
                    PYMT12: tranInfo.amount,
                    PYMT13: tranInfo.status,
                    PYMT15: tranInfo.method,
                    PYMT16: UpgradePlan.nextDate(365) // Next payment date
                };

                const paymentInfo = await PLRDBPYMT.create(paymentData);
                response.status = 'SUCCESS';
                response.message = 'Payment info updated successfully';
                response.data = paymentInfo
                const encryptresponse = encryptor.encrypt(JSON.stringify(response));
                return res.status(200).json({ encryptresponse });
            }

            // Action A - Update Branch, Company, or User Details
            else if (action == 'A') {
                const { branchId, companyId, userId } = req.query;

                if (!branchId || !companyId || !userId) {
                    response.status = 'FAIL';
                    response.message = 'Branch ID, Company ID, and User ID are required for action A';
                    const encryptresponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(404).json({ encryptresponse });
                }

                // Update the user's branch and company info
                const userUpdate = await PLSDBUBC.update({
                    UBCF02: branchId,
                    UBCF03: companyId
                }, {
                    where: { UBCF01: userId }
                });

                if (userUpdate[0] === 0) {
                    response.status = 'FAIL';
                    response.message = 'User not found or no update performed';
                    const encryptresponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(404).json({ encryptresponse });
                }

                response.status = 'SUCCESS';
                response.message = 'Branch and company updated successfully';
                const encryptresponse = encryptor.encrypt(JSON.stringify(response));
                return res.status(200).json({ encryptresponse });
            }

            // Action M - Update or Activate Modules
            else if (action == 'M') {
                const { moduleId, userId } = req.query;

                if (!moduleId || !userId) {
                    response.status = 'FAIL';
                    response.message = 'Module ID and User ID are required for action M';
                    const encryptresponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(400).json({ encryptresponse });
                }

                // Check if the module exists
                const moduleInfo = await PLRDBA02.findOne({
                    where: { A02F01: moduleId }
                });

                if (!moduleInfo) {
                    response.status = 'FAIL';
                    response.message = 'Module not found';
                    const encryptresponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(404).json({ encryptresponse });
                }

                // Add module to the user's module list
                const userModules = await PLSDBUBC.findOne({
                    where: { UBCF01: userId }
                });

                let modules = userModules ? userModules.UBCF04.split(',') : [];

                if (!modules.includes(moduleInfo.A02F12)) {
                    modules.push(moduleInfo.A02F12);
                    const updatedModules = modules.join(',');

                    await PLSDBUBC.update(
                        { UBCF04: updatedModules },
                        { where: { UBCF01: userId } }
                    );

                    response.status = 'SUCCESS';
                    response.message = 'Module activated successfully';
                    const encryptresponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(200).json({ encryptresponse });
                } else {
                    response.status = 'SUCCESS';
                    response.message = 'Module is already activated for this user';
                    const encryptresponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(200).json({ encryptresponse });
                }
            } else if (action == 'G') {
                let finalTransaction = [];
                let allTransaction = await PLRDBPYMT.findAll({
                    where: { PYMT02: corpId }
                });
                let planRows = await PLRDBA02.findAll();
                // Loop through allTransaction and add the plan name (A02F02)
                for (let transaction of allTransaction) {
                    // Convert PYMT01 to string for comparison
                    let transactionId = transaction.PYMT01.toString().trim();
                
                    // Find the matching plan row in planRows
                    let matchingPlan = planRows.find(plan => {
                        let planId = plan.A02F01 ? plan.A02F01.toString().trim() : ''; // Ensure A02F01 is a string and trimmed
                
                        return planId === transactionId;  // Compare after trimming
                    });
                
                    if (matchingPlan) {
                        // If a matching plan is found, add PYMTPNM key to the transaction
                        transaction.dataValues.PYMTPNM = matchingPlan.A02F02;
                        finalTransaction.push(transaction.dataValues)
                    } else {
                        // If no matching plan is found, handle as needed
                        transaction.dataValues.PYMTPNM = null;
                        finalTransaction.push(transaction.dataValues)
                    }
                }
                
                
                response.status = 'SUCCESS';
                response.data = finalTransaction;
                const encryptresponse = encryptor.encrypt(JSON.stringify(response));
                return res.status(200).json({ encryptresponse });
            }

            // Invalid action
            else {
                response.status = 'SUCCESS';
                response.message = 'Invalid action type';
                const encryptresponse = encryptor.encrypt(JSON.stringify(response));
                return res.status(400).json({ encryptresponse });
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
