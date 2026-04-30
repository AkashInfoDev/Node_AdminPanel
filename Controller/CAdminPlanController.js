const querystring = require('querystring');
const db = require('../Config/config');
const definePLRDBA01 = require('../Models/RDB/PLRDBA01');
const definePLRDBPYMT = require('../Models/RDB/PLRDBPYMT');
const definePLRDBA02 = require('../Models/RDB/PLRDBA02');
const definePLRDBPLREL = require('../Models/RDB/PLRDBPLREL');
const defineEP_USER = require('../Models/RDB/EP_USER');

const TokenService = require('../Services/tokenServices');
const Encryptor = require('../Services/encryptor');

// const defineEP_FILE = require('../Models/RDB/EP_FILE');
const definePLRDBGAO = require('../Models/RDB/PLRDBGAO'); // Model factory
const ADMIController = require('./ADMIController');
const M81Controller = require('./M81Controller');
const EP_USERController = require('./EP_USERController');
const defineEPTRNS = require('../Models/RDB/EP_TRNS');
const defineEP_PAYREQ = require('../Models/RDB/EP_PAYREQ');
const defineEP_FILE = require('../Models/RDB/EP_FILE');
const { error } = require('console');

const sequelizeRDB = db.getConnection('RDB');
const EP_USER = defineEP_USER(sequelizeRDB);

const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const PLRDBPYMT = definePLRDBPYMT(sequelizeRDB);
const PLRDBA02 = definePLRDBA02(sequelizeRDB);
const PLRDBPLREL = definePLRDBPLREL(sequelizeRDB);
const PLRDBGAO = definePLRDBGAO(sequelizeRDB);
const EP_TRNS = defineEPTRNS(sequelizeRDB);
const EP_FILE = defineEP_FILE(sequelizeRDB, require('sequelize').DataTypes);
const EP_PAYREQ = defineEP_PAYREQ(sequelizeRDB, require('sequelize').DataTypes);


const encryptor = new Encryptor();

function getPrefix(roleId) {
    switch (Number(roleId)) {
        case 1: return 'ADMIN';
        case 2: return 'CMPUSER';
        case 3: return 'DEALER';
        case 4: return 'RESELLER';
        default: return 'UNKNOWN';
    }
}
class CAdminPlanController {

    static async getLoggedInUser(decoded) {

        const encryptor = new Encryptor();

        /* =========================
           🔥 RESOLVE RDB NAME
        ========================= */

        let rdbName;

        if (decoded.corpId) {
            const parts = decoded.corpId.split('-');

            rdbName = parts.length === 3
                ? parts[0] + parts[1] + parts[2] + 'RDB'
                : parts[0] + parts[1] + 'RDB';
        } else {
            rdbName = 'RDB';
        }

        /* =========================
           🔌 CONNECT USER DB
        ========================= */

        const userCtrl = new EP_USERController(rdbName);

        /* =========================
           🔍 FETCH USERS (NOT DELETED)
        ========================= */

        const users = await userCtrl.findAll({
            UTF07: 'N'   // ✅ FIXED
        });

        /* =========================
           🔐 MATCH USER
        ========================= */

        for (let u of users) {

            let decryptedId;

            try {
                decryptedId = encryptor.decrypt(u.UTF04); // ✅ FIXED
            } catch {
                decryptedId = u.UTF04; // fallback
            }

            if (decryptedId === decoded.userId) {
                return u; // ✅ FOUND USER
            }
        }

        return null; // ❌ NOT FOUND
    }
    /* ===================================================== */
    /* MAIN ROUTER */
    /* ===================================================== */

    static async handlePlan(req, res) {

        let response = { status: 'SUCCESS', message: '', data: null };

        try {

            /* 🔐 TOKEN */
            const token = req.headers['authorization']?.split(' ')[1];

            if (!token) {
                response.status = 'FAIL';
                response.message = 'Authorization token missing';
                return res.status(401).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            const decoded = await TokenService.validateToken(token);


            const roleId = Number(decoded.roleId);

            // if (![1, 2, 3, 4, 5].includes(roleId)) {
            //     response.status = 'FAIL';
            //     response.message = 'Access denied';
            //     return res.status(403).json({
            //         encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            //     });
            // }
            //     const roles = await sequelizeRDB.query(`
            //     SELECT ID FROM EP_USERTPYES
            // `, { type: require('sequelize').QueryTypes.SELECT });

            //             const allowedRoleIds = roles.map(r => r.ID);

            //             if (!allowedRoleIds.includes(roleId)) {
            //                 return res.status(403).json({
            //                     encryptedResponse: encryptor.encrypt(JSON.stringify({
            //                         status: 'FAIL',
            //                         message: 'Access denied'
            //                     }))
            //                 });
            //             }
            const defineUserTypes = require('../Models/RDB/EP_USERTPYES');
            const UserTypes = defineUserTypes(sequelizeRDB, require('sequelize').DataTypes);

            const roles = await UserTypes.findAll({
                attributes: ['ID'],
                raw: true
            });

            const allowedRoleIds = roles.map(r => Number(r.ID));

            if (!allowedRoleIds.includes(Number(roleId))) {
                return res.status(403).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        status: 'FAIL',
                        message: 'Access denied'
                    }))
                });
            }
            const encryptedPa = req.body.pa || req.query.pa;
            /* 🔓 DECRYPT QUERY */
            if (!encryptedPa) {
                response.status = 'FAIL';
                response.message = 'Encrypted parameter missing';
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            // const decrypted = encryptor.decrypt(req.query.pa);
            const decrypted = encryptor.decrypt(encryptedPa);
            const pa = querystring.parse(decodeURIComponent(decrypted));
            /* =========================
   📄 FILE HANDLING (NEW)
========================= */
            if (req.file) {

                if (!req.file.mimetype.includes('pdf')) {
                    throw new Error('Only PDF allowed');
                }

                pa.fileBase64 = req.file.buffer.toString('base64');
                pa.fileName = req.file.originalname;
            }

            const action = pa.action;
            const corporateId = pa.corporateId;
            /* =========================
             🔥 ROLE-BASED ACCESS CHECK
            ========================= */

            // if (roleId !== 1 && corporateId) {

            //     const loggedUser = await CAdminPlanController.getLoggedInUser(decoded);

            //     if (!loggedUser) {
            //         response.status = 'FAIL';
            //         response.message = 'User not found';
            //         return res.status(403).json({
            //             encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            //         });
            //     }

            //     const corp = await PLRDBA01.findOne({
            //         where: {
            //             A01F03: corporateId,
            //             // A01F19: loggedUser.User_Id
            //             A01F19: loggedUser.UTF01
            //         }
            //     });

            //     if (!corp) {
            //         response.status = 'FAIL';
            //         response.message = 'Access denied for this corporate';
            //         return res.status(403).json({
            //             encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            //         });
            //     }
            // }
            if (![1, 2, 3, 4, 5].includes(roleId) && corporateId) {

                const loggedUser = await CAdminPlanController.getLoggedInUser(decoded);

                if (!loggedUser) {
                    response.status = 'FAIL';
                    response.message = 'User not found';
                    return res.status(403).json({
                        encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                    });
                }

                const corp = await PLRDBA01.findOne({
                    where: {
                        A01F03: corporateId,
                        A01F19: loggedUser.UTF01   // ✅ FIXED
                    }
                });

                if (!corp) {
                    response.status = 'FAIL';
                    response.message = 'Access denied for this corporate';
                    return res.status(403).json({
                        encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                    });
                }
            }

            /* 🎯 ACTION ROUTER */
            switch (action) {

                /* ========================== */
                /* P → PLAN RENEWAL           */
                /* ========================== */
                case 'P':

                    if (!corporateId || !pa.A02id) {
                        response.status = 'FAIL';
                        response.message = 'corporateId and A02id are required';
                        return res.status(400).json({
                            encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                        });
                    }

                    // return CAdminPlanController.planRenewal(pa, response, res);
                    return CAdminPlanController.planRenewal(pa, response, res, decoded);


                /* ========================== */
                /* A → LIMIT INCREASE         */
                /* ========================== */
                case 'A':

                    if (!corporateId) {
                        response.status = 'FAIL';
                        response.message = 'corporateId is required';
                        return res.status(400).json({
                            encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                        });
                    }

                    // return CAdminPlanController.limitIncrease(pa, response, res);
                    return CAdminPlanController.limitIncrease(pa, response, res, decoded);

                /* ========================== */
                /* M → MODULE ACTIVATION      */
                /* ========================== */
                case 'M':

                    if (!corporateId) {
                        response.status = 'FAIL';
                        response.message = 'corporateId is required';
                        return res.status(400).json({
                            encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                        });
                    }

                    // return CAdminPlanController.moduleActivation(pa, response, res);
                    return CAdminPlanController.moduleActivation(pa, response, res, decoded);


                /* ========================== */
                /* G → GET TRANSACTIONS       */
                /* ========================== */
                case 'G':
                    return CAdminPlanController.getTransactions(pa, response, res);


                case 'U':   // 👈 NEW CASE
                    return CAdminPlanController.getMasterData(response, res);


                case 'L':
                    if (!corporateId) {
                        response.status = 'FAIL';
                        response.message = 'corporateId is required';
                        return res.status(400).json({
                            encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                        });
                    }


                    return CAdminPlanController.getCurrentLimits(pa, response, res);


                /* ========================== */
                /* D → MODULE DEACTIVATION   */
                /* ========================== */
                case 'D':

                    if (!corporateId) {
                        response.status = 'FAIL';
                        response.message = 'corporateId is required';
                        return res.status(400).json({
                            encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                        });
                    }

                    // return CAdminPlanController.moduleDeactivation(pa, response, res);
                    return CAdminPlanController.moduleDeactivation(pa, response, res, decoded);

                default:
                    response.status = 'FAIL';
                    response.message = 'Invalid action';
                    return res.status(400).json({
                        encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                    });
            }

        } catch (err) {

            console.error('handlePlan error:', err);

            response.status = 'FAIL';
            response.message = 'Server error';

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }

    /* ===================================================== */
    /* PLAN RENEWAL                                         */
    /* ===================================================== */
    // static async planRenewal(pa, response, res, decoded) {

    //     const {
    //         corporateId,
    //         A02id,
    //         amount,
    //         description,
    //         paymentMethod,
    //         referenceNo
    //     } = pa;

    //     const transaction = await sequelizeRDB.transaction();

    //     try {

    //         const corp = await PLRDBA01.findOne({
    //             where: { A01F03: corporateId },
    //             transaction
    //         });

    //         if (!corp) {
    //             response.status = 'FAIL';
    //             response.message = 'Corporate not found';
    //             await transaction.rollback();
    //             return res.status(404).json({
    //                 encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //             });
    //         }

    //         // ==============================
    //         // FETCH PLAN DETAILS
    //         // ==============================

    //         const planInfo = await PLRDBA02.findOne({
    //             where: { A02F01: A02id },
    //             transaction
    //         });

    //         if (!planInfo) {
    //             response.status = 'FAIL';
    //             response.message = 'Plan not found';
    //             await transaction.rollback();
    //             return res.status(404).json({
    //                 encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //             });
    //         }

    //         const today = new Date();

    //         // SaaS Extension Logic:
    //         // If current expiry is future → extend from expiry
    //         // If expired or null → start from today
    //         let baseDate = corp.A01F13 ? new Date(corp.A01F13) : today;
    //         if (!corp.A01F13 || baseDate < today) {
    //             baseDate = today;
    //         }

    //         let newExpiry = null;

    //         // ==============================
    //         // PLAN VALIDITY RULES
    //         // ==============================

    //         const planId = parseInt(A02id);

    //         if (planId === 2) {
    //             // Trial → 7 days
    //             baseDate.setDate(baseDate.getDate() + 7);
    //             newExpiry = baseDate;
    //         }
    //         else if (planId === 6) {
    //             // Default → Unlimited
    //             newExpiry = null;
    //         }
    //         else if (planId === 7) {
    //             // Standard → 1 year
    //             baseDate.setFullYear(baseDate.getFullYear() + 1);
    //             newExpiry = baseDate;
    //         }
    //         else {
    //             // Fallback → 1 year
    //             baseDate.setFullYear(baseDate.getFullYear() + 1);
    //             newExpiry = baseDate;
    //         }

    //         // ==============================
    //         // UPDATE CORPORATE PLAN
    //         // ==============================

    //         await PLRDBA01.update({
    //             A02F01: A02id,
    //             A01F12: today,      // Plan Start Date
    //             A01F13: newExpiry   // Expiry Date
    //         }, {
    //             where: { A01F03: corporateId },
    //             transaction
    //         });

    //         const prefix = getPrefix(decoded.roleId);
    //         // ==============================
    //         // CREATE PAYMENT ENTRY
    //         // ==============================
    //         await PLRDBPYMT.create({
    //             PYMT01: corporateId,
    //             PYMT02: 0,
    //             // PYMT03: referenceNo || ('ADMIN_' + Date.now()),
    //             PYMT03: referenceNo || (`${prefix}_${Date.now()}`),
    //             PYMT04: 'OFFLINE',
    //             PYMT05: parseFloat(amount || 0),
    //             PYMT06: 'SUCCESS',
    //             PYMT07: paymentMethod || 'CASH',
    //             PYMT09: description || 'Plan Renewal',
    //             PYMT10: newExpiry ? newExpiry.toISOString() : null
    //         }, { transaction });

    //         await transaction.commit();

    //         response.status = 'SUCCESS';
    //         response.message = 'Plan renewed successfully';

    //         return res.status(200).json({
    //             encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //         });

    //     } catch (err) {

    //         await transaction.rollback();

    //         console.error(err);

    //         response.status = 'FAIL';
    //         response.message = 'Failed to renew plan';

    //         return res.status(500).json({
    //             encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //         });
    //     }
    // }
    static async planRenewal(pa, response, res, decoded) {

        const {
            corporateId,
            A02id,
            amount,
            description,
            paymentMethod,
            referenceNo,
            fileBase64,
            fileName
        } = pa;

        const transaction = await sequelizeRDB.transaction();

        try {

            /* =========================
               1️⃣ VALIDATE CORPORATE
            ========================= */
            const corp = await PLRDBA01.findOne({
                where: { A01F03: corporateId },
                transaction
            });

            if (!corp) {
                response.status = 'FAIL';
                response.message = 'Corporate not found';

                if (!transaction.finished) await transaction.rollback();

                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            /* =========================
               2️⃣ VALIDATE PLAN
            ========================= */
            const planInfo = await PLRDBA02.findOne({
                where: { A02F01: A02id },
                transaction
            });

            if (!planInfo) {
                response.status = 'FAIL';
                response.message = 'Plan not found';

                if (!transaction.finished) await transaction.rollback();

                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            /* =========================
               3️⃣ GET USER (IMPORTANT FIX)
            ========================= */
            const userRecord = await EP_USER.findOne({
                where: {
                    UTF04: decoded.userId,
                    UTF07: 'N'
                },
                transaction
            });

            if (!userRecord) {
                throw new Error('User not found');
            }

            const userInternalId = userRecord.UTF01;

            /* =========================
               4️⃣ CREATE REQUEST
            ========================= */
            const request = await EP_PAYREQ.create({
                PRQF01: corporateId,
                PRQF02: 'PLAN',

                PRQF03: JSON.stringify({
                    planId: Number(A02id)
                }),

                PRQF04: JSON.stringify({
                    paymentMethod,
                    referenceNo,
                    amount: parseFloat(amount || 0),
                    requestedAt: new Date().toISOString()
                }),

                PRQF05: parseFloat(amount || 0),
                PRQF06: description || 'Plan Renewal Request',

                PRQF07: 'P',
                PRQF08: userInternalId

            }, { transaction });

            /* =========================
               5️⃣ STORE FILE
            ========================= */
            if (fileBase64) {

                const file = await EP_FILE.create({
                    FILE02: fileName || 'payment-proof.pdf',
                    FILE03: fileBase64,
                    FILE04: userInternalId,
                    FILE06: 'Plan payment proof',
                    FILE07: 'PR',                 // 🔥 consistent with your system
                    FILE08: request.PRQF00,       // 🔥 link to request
                    FILE09: corporateId
                }, { transaction });

                await EP_PAYREQ.update({
                    PRQF12: file.FILE01
                }, {
                    where: { PRQF00: request.PRQF00 },
                    transaction
                });
            }

            /* =========================
               6️⃣ COMMIT
            ========================= */
            if (!transaction.finished) {
                await transaction.commit();
            }

            /* =========================
               7️⃣ RESPONSE
            ========================= */
            response.status = 'SUCCESS';
            response.message = 'Plan request submitted, waiting for accountant approval';
            response.data = {
                requestId: request.PRQF00
            };

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            console.error('planRenewal error:', err);

            if (!transaction.finished) {
                await transaction.rollback();
            }

            response.status = 'FAIL';
            response.message = err?.message || 'Failed to create plan request';

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }
    /* ===================================================== */
    /* LIMIT INCREASE                                       */
    /* ===================================================== */
    // static async limitIncrease(pa, response, res, decoded) {

    //     const {
    //         corporateId,
    //         additionalUser,
    //         additionalBranch,
    //         additionalCompany,
    //         cmpNum,
    //         custBP,
    //         custRS,
    //         usrFld,
    //         usrMstr,
    //         amount,
    //         description,
    //         paymentMethod,
    //         referenceNo
    //     } = pa;

    //     const transaction = await sequelizeRDB.transaction();

    //     try {

    //         const corp = await PLRDBA01.findOne({
    //             where: { A01F03: corporateId },
    //             transaction
    //         });

    //         if (!corp) {
    //             throw new Error('Corporate not found');
    //         }

    //         // ==============================
    //         // 1️⃣ UPDATE MAIN LIMITS
    //         // ==============================

    //         await PLRDBA01.update({
    //             A01F10: Number(corp.A01F10 || 0) + Number(additionalUser || 0),
    //             A01BRC: Number(corp.A01BRC || 0) + Number(additionalBranch || 0),
    //             A01CMP: Number(corp.A01CMP || 0) + Number(additionalCompany || 0)
    //         }, {
    //             where: { A01F03: corporateId },
    //             transaction
    //         });

    //         // ==============================
    //         // 2️⃣ COMPANY-WISE LIMIT UPDATE
    //         // ==============================

    //         const companyWiseIncrease =
    //             Number(custBP || 0) > 0 ||
    //             Number(custRS || 0) > 0 ||
    //             Number(usrFld || 0) > 0 ||
    //             Number(usrMstr || 0) > 0;

    //         if (companyWiseIncrease && !cmpNum) {
    //             throw new Error('Company number (cmpNum) is required for company-wise limit increase');
    //         }

    //         let paymentEntity = 0;

    //         if (cmpNum) {

    //             let cmpList = String(cmpNum).includes(',')
    //                 ? String(cmpNum).split(',')
    //                 : [cmpNum];

    //             if (cmpList.length === 1) {
    //                 paymentEntity = Number(cmpList[0]);
    //             }

    //             for (let cmp of cmpList) {

    //                 cmp = Number(cmp);

    //                 let gaoRow = await PLRDBGAO.findOne({
    //                     where: { GAOF01: corporateId, GAOF02: cmp },
    //                     transaction
    //                 });

    //                 if (!gaoRow) {
    //                     await PLRDBGAO.create({
    //                         GAOF01: corporateId,
    //                         GAOF02: cmp,
    //                         GAOF03: 2,
    //                         GAOF04: 0,
    //                         GAOF05: 5,
    //                         GAOF06: 0,
    //                         GAOF07: 50,
    //                         GAOF08: 0,
    //                         GAOF09: 5,
    //                         GAOF10: 0
    //                     }, { transaction });

    //                     gaoRow = await PLRDBGAO.findOne({
    //                         where: { GAOF01: corporateId, GAOF02: cmp },
    //                         transaction
    //                     });
    //                 }

    //                 // Safe numeric updates

    //                 if (Number(custBP || 0) > 0) {
    //                     await PLRDBGAO.update({
    //                         GAOF03: Number(gaoRow.GAOF03 || 0) + Number(custBP)
    //                     }, {
    //                         where: { GAOF01: corporateId, GAOF02: cmp },
    //                         transaction
    //                     });
    //                 }

    //                 if (Number(custRS || 0) > 0) {
    //                     await PLRDBGAO.update({
    //                         GAOF05: Number(gaoRow.GAOF05 || 0) + Number(custRS)
    //                     }, {
    //                         where: { GAOF01: corporateId, GAOF02: cmp },
    //                         transaction
    //                     });
    //                 }

    //                 if (Number(usrFld || 0) > 0) {
    //                     await PLRDBGAO.update({
    //                         GAOF07: Number(gaoRow.GAOF07 || 0) + Number(usrFld)
    //                     }, {
    //                         where: { GAOF01: corporateId, GAOF02: cmp },
    //                         transaction
    //                     });
    //                 }

    //                 if (Number(usrMstr || 0) > 0) {
    //                     await PLRDBGAO.update({
    //                         GAOF09: Number(gaoRow.GAOF09 || 0) + Number(usrMstr)
    //                     }, {
    //                         where: { GAOF01: corporateId, GAOF02: cmp },
    //                         transaction
    //                     });
    //                 }
    //             }
    //         }

    //         // ==============================
    //         // 3️⃣ CREATE PAYMENT ENTRY
    //         // ==============================
    //         const prefix = getPrefix(decoded.roleId);
    //         await PLRDBPYMT.create({
    //             PYMT01: corporateId,
    //             PYMT02: paymentEntity,   // 🔥 company if single, else 0
    //             // PYMT03: referenceNo || ('ADMIN_' + Date.now()),
    //             PYMT03: referenceNo || (`${prefix}_${Date.now()}`),
    //             PYMT04: 'OFFLINE',
    //             PYMT05: Number(amount || 0),
    //             PYMT06: 'SUCCESS',
    //             PYMT07: paymentMethod || 'CASH',
    //             PYMT09: description || 'Limit Increase',
    //             PYMT10: corp.A01F13 || null
    //         }, { transaction });

    //         await transaction.commit();

    //         response.status = 'SUCCESS';
    //         response.message = 'Limits updated successfully';

    //         return res.status(200).json({
    //             encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //         });

    //     } catch (err) {

    //         await transaction.rollback();
    //         response.status = 'FAIL';
    //         response.message = err.message;

    //         return res.status(500).json({
    //             encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //         });
    //     }
    // }
    static async limitIncrease(pa, response, res, decoded) {

        const {
            corporateId,
            additionalUser,
            additionalBranch,
            additionalCompany,
            cmpNum,
            custBP,
            custRS,
            usrFld,
            usrMstr,
            amount,
            description,
            paymentMethod,
            referenceNo,
            fileBase64,
            fileName
        } = pa;

        const transaction = await sequelizeRDB.transaction();

        try {

            /* =========================
               1️⃣ VALIDATE CORPORATE
            ========================= */
            const corp = await PLRDBA01.findOne({
                where: { A01F03: corporateId },
                transaction
            });

            if (!corp) {
                throw new Error('Corporate not found');
            }

            /* =========================
               2️⃣ VALIDATE COMPANY LOGIC
            ========================= */
            const companyWiseIncrease =
                Number(custBP || 0) > 0 ||
                Number(custRS || 0) > 0 ||
                Number(usrFld || 0) > 0 ||
                Number(usrMstr || 0) > 0;

            if (companyWiseIncrease && !cmpNum) {
                throw new Error('Company number (cmpNum) is required for company-wise limit increase');
            }

            /* =========================
               3️⃣ GET USER (INTERNAL ID)
            ========================= */
            const userRecord = await EP_USER.findOne({
                where: {
                    UTF04: decoded.userId,
                    UTF07: 'N'
                },
                transaction
            });

            if (!userRecord) {
                throw new Error('User not found');
            }

            const userInternalId = userRecord.UTF01;

            /* =========================
               4️⃣ CREATE REQUEST (🔥 CORE CHANGE)
            ========================= */
            const request = await EP_PAYREQ.create({
                PRQF01: corporateId,
                PRQF02: 'LIMIT',

                PRQF03: JSON.stringify({
                    additionalUser,
                    additionalBranch,
                    additionalCompany,
                    cmpNum,
                    custBP,
                    custRS,
                    usrFld,
                    usrMstr
                }),

                PRQF04: JSON.stringify({
                    paymentMethod,
                    referenceNo,
                    amount: Number(amount || 0),
                    requestedAt: new Date().toISOString()
                }),

                PRQF05: Number(amount || 0),
                PRQF06: description || 'Limit Increase Request',

                PRQF07: 'P',
                PRQF08: userInternalId

            }, { transaction });

            /* =========================
               5️⃣ STORE FILE (OPTIONAL)
            ========================= */
            if (fileBase64) {

                const file = await EP_FILE.create({
                    FILE02: fileName || 'payment-proof.pdf',
                    FILE03: fileBase64,
                    FILE04: userInternalId,
                    FILE06: 'Limit increase payment proof',
                    FILE07: 'PR',
                    FILE08: request.PRQF00,
                    FILE09: corporateId
                }, { transaction });

                await EP_PAYREQ.update({
                    PRQF12: file.FILE01
                }, {
                    where: { PRQF00: request.PRQF00 },
                    transaction
                });
            }

            /* =========================
               6️⃣ COMMIT
            ========================= */
            if (!transaction.finished) {
                await transaction.commit();
            }

            /* =========================
               7️⃣ RESPONSE
            ========================= */
            response.status = 'SUCCESS';
            response.message = 'Limit increase request submitted for approval';
            response.data = {
                requestId: request.PRQF00
            };

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            console.error('limitIncrease error:', err);

            if (!transaction.finished) {
                await transaction.rollback();
            }

            response.status = 'FAIL';
            response.message = err.message;

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }
    /* ===================================================== */
    /* GET TRANSACTIONS                                     */
    /* ===================================================== */
    static async getTransactions(pa, response, res) {
        try {

            const { Sequelize } = require('sequelize');

            /* =========================
               1️⃣ JOIN QUERY
            ========================= */
            const rows = await sequelizeRDB.query(`
            SELECT 
                p.*,
                c.A01F02 AS companyName,
                c.A01F19 AS roleid,
                u.UTF02 AS dealerName,
                u.UTF12 AS commission,
                u.UTF17 AS gstNumber
            FROM PLRDBPYMT p
            LEFT JOIN PLRDBA01 c 
                ON p.PYMT01 = LTRIM(RTRIM(c.A01F03))
            LEFT JOIN EP_USER u 
                ON c.A01F19 = u.UTF01
            ORDER BY p.PYMT08 DESC
        `, {
                type: Sequelize.QueryTypes.SELECT
            });

            /* =========================
               2️⃣ GROUP DATA (KEEP EXISTING)
            ========================= */


            const groupedData = {};

            for (let txn of rows) {

                const corpId = txn.PYMT01?.trim();

                if (!groupedData[corpId]) {
                    groupedData[corpId] = [];
                }
                const amount = parseFloat(txn.PYMT05) || 0;
                const commissionPercent = parseFloat(txn.commission) || 0;

                // ✅ Calculate commission amount
                const commissionAmount = (amount * commissionPercent) / 100;


                groupedData[corpId].push({

                    // ✅ KEEP EXISTING FIELDS (same as DB)
                    PYMT00: txn.PYMT00,
                    PYMT01: txn.PYMT01,
                    PYMT02: txn.PYMT02,
                    PYMT03: txn.PYMT03,
                    PYMT04: txn.PYMT04,
                    PYMT05: txn.PYMT05,
                    PYMT06: txn.PYMT06,
                    PYMT07: txn.PYMT07,
                    PYMT08: txn.PYMT08,
                    PYMT09: txn.PYMT09,
                    PYMT10: txn.PYMT10,

                    // ➕ NEW FIELDS (ADDED ONLY)
                    customerName: txn.companyName || null,
                    dealerName: txn.dealerName || null,
                    dealerId: txn.roleid || null,
                    commission: txn.commission || null,
                    gstNumber: txn.gstNumber || null,
                    commissionAmount: commissionAmount || null
                });
            }

            /* =========================
               3️⃣ RESPONSE
            ========================= */

            response.data = groupedData;
            response.status = 'SUCCESS';
            response.message = 'All corporate transactions fetched successfully';

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            console.error(err);

            response.status = 'FAIL';
            response.message = 'Failed to load transactions';

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }
    // static async moduleActivation(pa, response, res, decoded) {

    //     const {
    //         corporateId,
    //         moduleId,
    //         setUpId,
    //         amount,
    //         description,
    //         paymentMethod,
    //         referenceNo
    //     } = pa;

    //     const transaction = await sequelizeRDB.transaction();

    //     try {

    //         const corp = await PLRDBA01.findOne({
    //             where: { A01F03: corporateId },
    //             transaction
    //         });

    //         if (!corp) {
    //             response.status = 'FAIL';
    //             response.message = 'Corporate not found';
    //             await transaction.rollback();
    //             return res.status(404).json({
    //                 encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //             });
    //         }

    //         const corpUnq = String(corp.A01F01).trim();

    //         const parts = corporateId.split('-');
    //         let sdbName =
    //             parts.length === 3
    //                 ? `${parts[0]}${parts[1]}${parts[2]}SDB`
    //                 : `${parts[0]}${parts[1]}SDB`;

    //         if (sdbName === 'PLP00001SDB')
    //             sdbName = 'A00001SDB';

    //         const admi = new ADMIController(sdbName);
    //         const m81 = new M81Controller(sdbName);

    //         /* 1️⃣ GET SUPER USER */
    //         const superUser = await admi.findOne({
    //             ADMIF06: 2,
    //             ADMICORP: corpUnq
    //         });

    //         if (!superUser) {
    //             response.status = 'FAIL';
    //             response.message = 'Super user not found';
    //             await transaction.rollback();
    //             return res.status(400).json({
    //                 encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //             });
    //         }

    //         /* 2️⃣ NORMALIZE INPUT (IMPORTANT) */

    //         const modules = String(moduleId || '')
    //             .split(',')
    //             .map(m => m.trim())
    //             .filter(Boolean);

    //         const uniqueModules = [...new Set(modules)];

    //         const setups = String(setUpId || '')
    //             .split(',')
    //             .map(s => s.trim())
    //             .filter(Boolean);

    //         const uniqueSetups = [...new Set(setups)];

    //         /* 3️⃣ MODULE ACTIVATION */

    //         if (uniqueModules.length > 0) {

    //             let existingModules = superUser.ADMIMOD
    //                 ? superUser.ADMIMOD.split(',').map(m => m.trim())
    //                 : [];

    //             const updatedModules = [...new Set([...existingModules, ...uniqueModules])];

    //             await admi.update(
    //                 { ADMIMOD: updatedModules.join(',') },
    //                 { ADMIF00: superUser.ADMIF00 }
    //             );
    //         }

    //         /* 4️⃣ SETUP ACTIVATION */

    //         if (uniqueSetups.length > 0) {

    //             const m81Row = await m81.findOne({
    //                 M81UNQ: superUser.ADMIF00.toString()
    //             });

    //             let existingSetups = m81Row?.M81SID
    //                 ? m81Row.M81SID.split(',').map(s => s.trim())
    //                 : [];

    //             const updatedSetups = [...new Set([...existingSetups, ...uniqueSetups])];

    //             await m81.update(
    //                 { M81SID: updatedSetups.join(',') },
    //                 { M81UNQ: superUser.ADMIF00.toString() }
    //             );
    //         }

    //         /* 5️⃣ PAYMENT ENTRY */
    //         const prefix = getPrefix(decoded.roleId);
    //         await PLRDBPYMT.create({
    //             PYMT01: corporateId,
    //             PYMT02: 0,
    //             // PYMT03: referenceNo || ('ADMIN_MOD_' + Date.now()),
    //             PYMT03: referenceNo || (`${prefix}_${Date.now()}`),
    //             PYMT04: 'OFFLINE',
    //             PYMT05: parseFloat(amount || 0),
    //             PYMT06: 'SUCCESS',
    //             PYMT07: paymentMethod || 'CASH',
    //             PYMT09: description || `Modules: ${uniqueModules.join(',') || 'None'} | Setups: ${uniqueSetups.join(',') || 'None'}`,
    //             PYMT10: corp.A01F13 || null
    //         }, { transaction });

    //         await transaction.commit();

    //         response.status = 'SUCCESS';
    //         response.message = 'Module / Setup activated successfully';

    //         return res.status(200).json({
    //             encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //         });

    //     } catch (err) {

    //         await transaction.rollback();

    //         console.error(err);

    //         response.status = 'FAIL';
    //         response.message = 'Failed to activate module';

    //         return res.status(500).json({
    //             encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //         });
    //     }
    // }
    static async moduleActivation(pa, response, res, decoded) {

        const {
            corporateId,
            moduleId,
            setUpId,
            amount,
            description,
            paymentMethod,
            referenceNo,
            fileBase64,
            fileName
        } = pa;

        const transaction = await sequelizeRDB.transaction();

        try {

            /* =========================
               1️⃣ VALIDATE CORPORATE
            ========================= */
            const corp = await PLRDBA01.findOne({
                where: { A01F03: corporateId },
                transaction
            });

            if (!corp) {
                throw new Error('Corporate not found');
            }

            /* =========================
               2️⃣ VALIDATE INPUT
            ========================= */
            const modules = String(moduleId || '')
                .split(',')
                .map(m => m.trim())
                .filter(Boolean);

            const setups = String(setUpId || '')
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);

            if (modules.length === 0 && setups.length === 0) {
                throw new Error('At least one module or setup is required');
            }

            /* =========================
               3️⃣ GET USER (INTERNAL ID)
            ========================= */
            const userRecord = await EP_USER.findOne({
                where: {
                    UTF04: decoded.userId,
                    UTF07: 'N'
                },
                transaction
            });

            if (!userRecord) {
                throw new Error('User not found');
            }

            const userInternalId = userRecord.UTF01;

            /* =========================
               4️⃣ CREATE REQUEST (🔥 CORE)
            ========================= */
            const request = await EP_PAYREQ.create({
                PRQF01: corporateId,
                PRQF02: 'MODULE',

                PRQF03: JSON.stringify({
                    moduleId: modules,
                    setUpId: setups
                }),

                PRQF04: JSON.stringify({
                    paymentMethod,
                    referenceNo,
                    amount: Number(amount || 0),
                    requestedAt: new Date().toISOString()
                }),

                PRQF05: Number(amount || 0),
                PRQF06: description || `Modules: ${modules.join(',')} | Setups: ${setups.join(',')}`,

                PRQF07: 'P',
                PRQF08: userInternalId

            }, { transaction });

            /* =========================
               5️⃣ STORE FILE (OPTIONAL)
            ========================= */
            if (fileBase64) {

                const file = await EP_FILE.create({
                    FILE02: fileName || 'payment-proof.pdf',
                    FILE03: fileBase64,
                    FILE04: userInternalId,
                    FILE06: 'Module activation payment proof',
                    FILE07: 'PR',
                    FILE08: request.PRQF00,
                    FILE09: corporateId
                }, { transaction });

                await EP_PAYREQ.update({
                    PRQF12: file.FILE01
                }, {
                    where: { PRQF00: request.PRQF00 },
                    transaction
                });
            }

            /* =========================
               6️⃣ COMMIT
            ========================= */
            if (!transaction.finished) {
                await transaction.commit();
            }

            /* =========================
               7️⃣ RESPONSE
            ========================= */
            response.status = 'SUCCESS';
            response.message = 'Module activation request submitted for approval';
            response.data = {
                requestId: request.PRQF00
            };

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            console.error('moduleActivation error:', err);

            if (!transaction.finished) {
                await transaction.rollback();
            }

            response.status = 'FAIL';
            response.message = err.message;

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }
    /* ===================================================== */
    /* MERGED MASTER DATA (PLAN + MODULE)                   */
    /* ===================================================== */
    static async getMasterData(response, res) {

        try {

            /* ==============================
               1️⃣ FETCH PLAN MASTER
            ============================== */

            const planRecords = await PLRDBA02.findAll({
                where: { A02F09: 1 },
                order: [['A02F13', 'ASC'], ['A02F01', 'ASC']]
            });

            const plans = [];
            const generalAddOns = [];
            const companyAddOns = [];

            planRecords.forEach(r => {
                if (r.A02F13 === 1) plans.push(r);
                else if (r.A02F13 === 2) generalAddOns.push(r);
                else if (r.A02F13 === 3) companyAddOns.push(r);
            });


            /* ==============================
               2️⃣ FETCH MODULE MASTER
            ============================== */

            const moduleRecords = await PLRDBPLREL.findAll({
                order: [['RELF03', 'ASC'], ['RELF00', 'ASC']]
            });

            const menuDetails = [];
            const comboMenuDetails = [];
            const setupDetails = [];

            moduleRecords.forEach(row => {

                const mapped = {
                    moduleID: row.RELF00,
                    ModuleCode: row.RELF01,
                    price: row.RELF02,
                    ModuleType: row.RELF03,
                    menuId: row.RELF04
                };

                switch (row.RELF03) {
                    case 'M':
                        menuDetails.push(mapped);
                        break;

                    case 'C':
                        comboMenuDetails.push(mapped);
                        break;

                    case 'S':
                        setupDetails.push(mapped);
                        break;
                }
            });


            /* ==============================
               3️⃣ FINAL MERGED RESPONSE
            ============================== */

            response.status = 'SUCCESS';
            response.message = 'Master data fetched successfully';
            response.data = {

                planDetails: {
                    data: plans
                },

                generalAddOnDetails: {
                    data: generalAddOns
                },

                companyAddOnDetails: {
                    data: companyAddOns
                },

                menuDetails: {
                    ModuleType: 'M',
                    data: menuDetails
                },

                comboMenuDetails: {
                    ModuleType: 'C',
                    data: comboMenuDetails
                },

                setupDetails: {
                    ModuleType: 'S',
                    data: setupDetails
                }
            };

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            console.error(err);

            response.status = 'FAIL';
            response.message = 'Failed to fetch master data';

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }

    /* ===================================================== */
    /* GET CURRENT LIMITS                                   */
    /* ===================================================== */
    static async getCurrentLimits(pa, response, res) {

        try {

            const { corporateId } = pa;

            // 1️⃣ Corporate Master
            const corp = await PLRDBA01.findOne({
                where: { A01F03: corporateId }
            });

            if (!corp) {
                response.status = 'FAIL';
                response.message = 'Corporate not found';
                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            // 2️⃣ Company-wise limits
            const gaoRows = await PLRDBGAO.findAll({
                where: { GAOF01: corporateId },
                order: [['GAOF02', 'ASC']]
            });

            // 3️⃣ Format Response
            response.status = 'SUCCESS';
            response.message = 'Current limits fetched successfully';
            response.data = {

                corporateLimits: {
                    totalUsers: Number(corp.A01F10 || 0),
                    totalBranches: Number(corp.A01BRC || 0),
                    totalCompanies: Number(corp.A01CMP || 0)
                },

                companyWiseLimits: gaoRows.map(row => ({
                    companyId: row.GAOF02,
                    custBP: Number(row.GAOF03 || 0),
                    custRS: Number(row.GAOF05 || 0),
                    usrFld: Number(row.GAOF07 || 0),
                    usrMstr: Number(row.GAOF09 || 0)
                }))
            };

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            response.status = 'FAIL';
            response.message = 'Failed to fetch current limits';

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }

    /* ===================================================== */
    /* MODULE DEACTIVATION                                  */
    /* ===================================================== */

    static async moduleDeactivation(pa, response, res, decoded) {

        const {
            corporateId,
            moduleId,
            setUpId,
            amount,
            description,
            paymentMethod,
            referenceNo
        } = pa;

        const transaction = await sequelizeRDB.transaction();

        try {

            const corp = await PLRDBA01.findOne({
                where: { A01F03: corporateId },
                transaction
            });

            if (!corp) {
                response.status = 'FAIL';
                response.message = 'Corporate not found';
                await transaction.rollback();

                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            const corpUnq = String(corp.A01F01).trim();

            const parts = corporateId.split('-');

            let sdbName =
                parts.length === 3
                    ? `${parts[0]}${parts[1]}${parts[2]}SDB`
                    : `${parts[0]}${parts[1]}SDB`;

            if (sdbName === 'PLP00001SDB')
                sdbName = 'A00001SDB';

            const admi = new ADMIController(sdbName);
            const m81 = new M81Controller(sdbName);

            /* ============================ */
            /* 1️⃣ GET SUPER USER           */
            /* ============================ */

            const superUser = await admi.findOne({
                ADMIF06: 2,
                ADMICORP: corpUnq
            });

            if (!superUser) {
                response.status = 'FAIL';
                response.message = 'Super user not found';
                await transaction.rollback();

                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            /* ============================ */
            /* 2️⃣ NORMALIZE INPUT          */
            /* ============================ */

            const removeModules = String(moduleId || '')
                .split(',')
                .map(m => m.trim())
                .filter(Boolean);

            const uniqueRemoveModules = [...new Set(removeModules)];

            const removeSetups = String(setUpId || '')
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);

            const uniqueRemoveSetups = [...new Set(removeSetups)];

            /* ============================ */
            /* 3️⃣ MODULE DEACTIVATION      */
            /* ============================ */

            if (uniqueRemoveModules.length > 0) {

                let existingModules = superUser.ADMIMOD
                    ? superUser.ADMIMOD.split(',').map(m => m.trim())
                    : [];

                const updatedModules = existingModules.filter(
                    mod => !uniqueRemoveModules.includes(mod)
                );

                await admi.update(
                    { ADMIMOD: updatedModules.join(',') },
                    { ADMIF00: superUser.ADMIF00 }
                );
            }

            /* ============================ */
            /* 4️⃣ SETUP DEACTIVATION       */
            /* ============================ */

            if (uniqueRemoveSetups.length > 0) {

                const m81Row = await m81.findOne({
                    M81UNQ: superUser.ADMIF00.toString()
                });

                if (m81Row) {

                    let existingSetups = m81Row.M81SID
                        ? m81Row.M81SID.split(',').map(s => s.trim())
                        : [];

                    const updatedSetups = existingSetups.filter(
                        s => !uniqueRemoveSetups.includes(s)
                    );

                    await m81.update(
                        { M81SID: updatedSetups.join(',') },
                        { M81UNQ: superUser.ADMIF00.toString() }
                    );
                }
            }

            /* ============================ */
            /* 5️⃣ PAYMENT / AUDIT ENTRY    */
            /* ============================ */
            const prefix = getPrefix(decoded.roleId);
            await PLRDBPYMT.create({
                PYMT01: corporateId,
                PYMT02: 0,
                PYMT03: referenceNo || (`${prefix}_DEMOD_${Date.now()}`),
                PYMT04: 'OFFLINE',
                PYMT05: parseFloat(amount || 0),
                PYMT06: 'SUCCESS',
                PYMT07: paymentMethod || 'CASH',
                PYMT09: description || `Removed Modules: ${uniqueRemoveModules.join(',') || 'None'} | Removed Setups: ${uniqueRemoveSetups.join(',') || 'None'}`,
                PYMT10: corp.A01F13 || null
            }, { transaction });

            await transaction.commit();

            response.status = 'SUCCESS';
            response.message = 'Module / Setup deactivated successfully';

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            await transaction.rollback();

            console.error(err);

            response.status = 'FAIL';
            response.message = 'Failed to deactivate module';

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }

    static async approve(pa, response, res, decoded) {
        const { requestId, decision } = pa;
        const transaction = await sequelizeRDB.transaction()
        try {
            if (![A, R].includes(decision)) {
                throw new Error("invalid decision");
            }
            const reqRow = await EP_PAYREQ.findOne({
                where: { PRQF00: requestId },
                transaction
            });
            if (!reqRow) { throw new Error("request not found ") }


            if (reqRow.PRQF07 !== 'P') {
                throw new Error('Request already processed');
            }

            const userRecord = await EP_USER.findOne({
                where: {
                    UTF04: decoded.userId,
                    UTF07: "N"
                },
                transaction
            });
            if (!userRecord) throw new Error('user not found')

            const approverID = userRecord.UTF01;

            if (decision === 'R') {
                await EP_PAYREQ.update({
                    PRQF07: 'R',
                    PRQF09: approverID,
                    PRQF11: ''
                },
                    {
                        where: {
                            PRQF00: requestId
                        },
                        transaction
                    });
                    await transaction.commit();

                    response.status = 'SUCCESS';
                    response.message = 'Request rejected'

                    return res.status(200).json({
                        encryptedResponse:encryptor.encrypt(JSON.stringify(response))
                    })
            }

            const type = reqRow.PRQF02;

            function safeParse(json){
                try {
                    return typeof json === 'string'? JSON.parse(json):json;
                } catch (error) {
                    return {}
                }
            }
            const payload = safeParse(reqRow.PRQF03);
            const payment = safeParse(reqRow.PRQF04) || {};

            await PLRDBPYMT.create({
                PYMT00:corporateId,
                PYMT02:0
            },{
                transaction
            })

            await EP_PAYREQ.update({
                PRQF07:'A',
                PRQF09:approverID,
                PRQF11:''
            },{
                where: {PRQF00:requestId},
                transaction
            })

            await transaction.commit();

            response.status = 'SUCCESS',
            response.message = 'request approved successfull'

            return res.status(200).json({
                encryptedResponse:encryptor.encrypt(JSON.stringify(response))
            })
        } catch (error) {
            console.error('approve request');

            if(!transaction.finished){
                await transaction.rollback();

            }

            response.status = 'fail',
            response.message = err.message

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            })
        }
    }
}

module.exports = CAdminPlanController;