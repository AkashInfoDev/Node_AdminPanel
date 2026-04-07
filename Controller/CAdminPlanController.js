const querystring = require('querystring');
const db = require('../Config/config');
const definePLRDBA01 = require('../Models/RDB/PLRDBA01');
const definePLRDBPYMT = require('../Models/RDB/PLRDBPYMT');
const definePLRDBA02 = require('../Models/RDB/PLRDBA02');
const definePLRDBPLREL = require('../Models/RDB/PLRDBPLREL');
const TokenService = require('../Services/tokenServices');
const Encryptor = require('../Services/encryptor');

const definePLRDBGAO = require('../Models/RDB/PLRDBGAO'); // Model factory
const ADMIController = require('./ADMIController');
const M81Controller = require('./M81Controller');

const sequelizeRDB = db.getConnection('RDB');

const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const PLRDBPYMT = definePLRDBPYMT(sequelizeRDB);
const PLRDBA02 = definePLRDBA02(sequelizeRDB);
const PLRDBPLREL = definePLRDBPLREL(sequelizeRDB);
const PLRDBGAO = definePLRDBGAO(sequelizeRDB);


const encryptor = new Encryptor();

class CAdminPlanController {

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

            if (decoded.roleId != 1) {
                response.status = 'FAIL';
                response.message = 'Access denied';
                return res.status(403).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            /* 🔓 DECRYPT QUERY */
            if (!req.query.pa) {
                response.status = 'FAIL';
                response.message = 'Encrypted parameter missing';
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            const decrypted = encryptor.decrypt(req.query.pa);
            const pa = querystring.parse(decodeURIComponent(decrypted));

            const action = pa.action;
            const corporateId = pa.corporateId;

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

                    return CAdminPlanController.planRenewal(pa, response, res);


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

                    return CAdminPlanController.limitIncrease(pa, response, res);


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

                    return CAdminPlanController.moduleActivation(pa, response, res);


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

                    return CAdminPlanController.moduleDeactivation(pa, response, res);

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
    static async planRenewal(pa, response, res) {

        const {
            corporateId,
            A02id,
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

            // ==============================
            // FETCH PLAN DETAILS
            // ==============================

            const planInfo = await PLRDBA02.findOne({
                where: { A02F01: A02id },
                transaction
            });

            if (!planInfo) {
                response.status = 'FAIL';
                response.message = 'Plan not found';
                await transaction.rollback();
                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            const today = new Date();

            // SaaS Extension Logic:
            // If current expiry is future → extend from expiry
            // If expired or null → start from today
            let baseDate = corp.A01F13 ? new Date(corp.A01F13) : today;
            if (!corp.A01F13 || baseDate < today) {
                baseDate = today;
            }

            let newExpiry = null;

            // ==============================
            // PLAN VALIDITY RULES
            // ==============================

            const planId = parseInt(A02id);

            if (planId === 2) {
                // Trial → 7 days
                baseDate.setDate(baseDate.getDate() + 7);
                newExpiry = baseDate;
            }
            else if (planId === 6) {
                // Default → Unlimited
                newExpiry = null;
            }
            else if (planId === 7) {
                // Standard → 1 year
                baseDate.setFullYear(baseDate.getFullYear() + 1);
                newExpiry = baseDate;
            }
            else {
                // Fallback → 1 year
                baseDate.setFullYear(baseDate.getFullYear() + 1);
                newExpiry = baseDate;
            }

            // ==============================
            // UPDATE CORPORATE PLAN
            // ==============================

            await PLRDBA01.update({
                A02F01: A02id,
                A01F12: today,      // Plan Start Date
                A01F13: newExpiry   // Expiry Date
            }, {
                where: { A01F03: corporateId },
                transaction
            });

            // ==============================
            // CREATE PAYMENT ENTRY
            // ==============================
            await PLRDBPYMT.create({
                PYMT01: corporateId,
                PYMT02: 0,
                PYMT03: referenceNo || ('ADMIN_' + Date.now()),
                PYMT04: 'OFFLINE',
                PYMT05: parseFloat(amount || 0),
                PYMT06: 'SUCCESS',
                PYMT07: paymentMethod || 'CASH',
                PYMT09: description || 'Plan Renewal',
                PYMT10: newExpiry ? newExpiry.toISOString() : null
            }, { transaction });

            await transaction.commit();

            response.status = 'SUCCESS';
            response.message = 'Plan renewed successfully';

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            await transaction.rollback();

            console.error(err);

            response.status = 'FAIL';
            response.message = 'Failed to renew plan';

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }
    /* ===================================================== */
    /* LIMIT INCREASE                                       */
    /* ===================================================== */
    static async limitIncrease(pa, response, res) {

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
            referenceNo
        } = pa;

        const transaction = await sequelizeRDB.transaction();

        try {

            const corp = await PLRDBA01.findOne({
                where: { A01F03: corporateId },
                transaction
            });

            if (!corp) {
                throw new Error('Corporate not found');
            }

            // ==============================
            // 1️⃣ UPDATE MAIN LIMITS
            // ==============================

            await PLRDBA01.update({
                A01F10: Number(corp.A01F10 || 0) + Number(additionalUser || 0),
                A01BRC: Number(corp.A01BRC || 0) + Number(additionalBranch || 0),
                A01CMP: Number(corp.A01CMP || 0) + Number(additionalCompany || 0)
            }, {
                where: { A01F03: corporateId },
                transaction
            });

            // ==============================
            // 2️⃣ COMPANY-WISE LIMIT UPDATE
            // ==============================

            const companyWiseIncrease =
                Number(custBP || 0) > 0 ||
                Number(custRS || 0) > 0 ||
                Number(usrFld || 0) > 0 ||
                Number(usrMstr || 0) > 0;

            if (companyWiseIncrease && !cmpNum) {
                throw new Error('Company number (cmpNum) is required for company-wise limit increase');
            }

            let paymentEntity = 0;

            if (cmpNum) {

                let cmpList = String(cmpNum).includes(',')
                    ? String(cmpNum).split(',')
                    : [cmpNum];

                if (cmpList.length === 1) {
                    paymentEntity = Number(cmpList[0]);
                }

                for (let cmp of cmpList) {

                    cmp = Number(cmp);

                    let gaoRow = await PLRDBGAO.findOne({
                        where: { GAOF01: corporateId, GAOF02: cmp },
                        transaction
                    });

                    if (!gaoRow) {
                        await PLRDBGAO.create({
                            GAOF01: corporateId,
                            GAOF02: cmp,
                            GAOF03: 2,
                            GAOF04: 0,
                            GAOF05: 5,
                            GAOF06: 0,
                            GAOF07: 50,
                            GAOF08: 0,
                            GAOF09: 5,
                            GAOF10: 0
                        }, { transaction });

                        gaoRow = await PLRDBGAO.findOne({
                            where: { GAOF01: corporateId, GAOF02: cmp },
                            transaction
                        });
                    }

                    // Safe numeric updates

                    if (Number(custBP || 0) > 0) {
                        await PLRDBGAO.update({
                            GAOF03: Number(gaoRow.GAOF03 || 0) + Number(custBP)
                        }, {
                            where: { GAOF01: corporateId, GAOF02: cmp },
                            transaction
                        });
                    }

                    if (Number(custRS || 0) > 0) {
                        await PLRDBGAO.update({
                            GAOF05: Number(gaoRow.GAOF05 || 0) + Number(custRS)
                        }, {
                            where: { GAOF01: corporateId, GAOF02: cmp },
                            transaction
                        });
                    }

                    if (Number(usrFld || 0) > 0) {
                        await PLRDBGAO.update({
                            GAOF07: Number(gaoRow.GAOF07 || 0) + Number(usrFld)
                        }, {
                            where: { GAOF01: corporateId, GAOF02: cmp },
                            transaction
                        });
                    }

                    if (Number(usrMstr || 0) > 0) {
                        await PLRDBGAO.update({
                            GAOF09: Number(gaoRow.GAOF09 || 0) + Number(usrMstr)
                        }, {
                            where: { GAOF01: corporateId, GAOF02: cmp },
                            transaction
                        });
                    }
                }
            }

            // ==============================
            // 3️⃣ CREATE PAYMENT ENTRY
            // ==============================

            await PLRDBPYMT.create({
                PYMT01: corporateId,
                PYMT02: paymentEntity,   // 🔥 company if single, else 0
                PYMT03: referenceNo || ('ADMIN_' + Date.now()),
                PYMT04: 'OFFLINE',
                PYMT05: Number(amount || 0),
                PYMT06: 'SUCCESS',
                PYMT07: paymentMethod || 'CASH',
                PYMT09: description || 'Limit Increase',
                PYMT10: corp.A01F13 || null
            }, { transaction });

            await transaction.commit();

            response.status = 'SUCCESS';
            response.message = 'Limits updated successfully';

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            await transaction.rollback();
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

            // 1️⃣ Fetch all transactions (no corporate filter)
            const rows = await PLRDBPYMT.findAll({
                order: [['PYMT08', 'DESC']]
            });

            // 2️⃣ Group by Corporate ID
            const groupedData = {};

            for (let txn of rows) {

                const corpId = txn.PYMT01;

                if (!groupedData[corpId]) {
                    groupedData[corpId] = [];
                }

                groupedData[corpId].push(txn);
            }

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
    static async moduleActivation(pa, response, res) {

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

            /* 1️⃣ GET SUPER USER */
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

            /* 2️⃣ NORMALIZE INPUT (IMPORTANT) */

            const modules = String(moduleId || '')
                .split(',')
                .map(m => m.trim())
                .filter(Boolean);

            const uniqueModules = [...new Set(modules)];

            const setups = String(setUpId || '')
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);

            const uniqueSetups = [...new Set(setups)];

            /* 3️⃣ MODULE ACTIVATION */

            if (uniqueModules.length > 0) {

                let existingModules = superUser.ADMIMOD
                    ? superUser.ADMIMOD.split(',').map(m => m.trim())
                    : [];

                const updatedModules = [...new Set([...existingModules, ...uniqueModules])];

                await admi.update(
                    { ADMIMOD: updatedModules.join(',') },
                    { ADMIF00: superUser.ADMIF00 }
                );
            }

            /* 4️⃣ SETUP ACTIVATION */

            if (uniqueSetups.length > 0) {

                const m81Row = await m81.findOne({
                    M81UNQ: superUser.ADMIF00.toString()
                });

                let existingSetups = m81Row?.M81SID
                    ? m81Row.M81SID.split(',').map(s => s.trim())
                    : [];

                const updatedSetups = [...new Set([...existingSetups, ...uniqueSetups])];

                await m81.update(
                    { M81SID: updatedSetups.join(',') },
                    { M81UNQ: superUser.ADMIF00.toString() }
                );
            }

            /* 5️⃣ PAYMENT ENTRY */

            await PLRDBPYMT.create({
                PYMT01: corporateId,
                PYMT02: 0,
                PYMT03: referenceNo || ('ADMIN_MOD_' + Date.now()),
                PYMT04: 'OFFLINE',
                PYMT05: parseFloat(amount || 0),
                PYMT06: 'SUCCESS',
                PYMT07: paymentMethod || 'CASH',
                PYMT09: description || `Modules: ${uniqueModules.join(',') || 'None'} | Setups: ${uniqueSetups.join(',') || 'None'}`,
                PYMT10: corp.A01F13 || null
            }, { transaction });

            await transaction.commit();

            response.status = 'SUCCESS';
            response.message = 'Module / Setup activated successfully';

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            await transaction.rollback();

            console.error(err);

            response.status = 'FAIL';
            response.message = 'Failed to activate module';

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
    // static async moduleDeactivation(pa, response, res) {

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

    //         /* ============================ */
    //         /* 1️⃣ GET SUPER USER           */
    //         /* ============================ */

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

    //         /* ============================ */
    //         /* 2️⃣ MODULE DEACTIVATION      */
    //         /* ============================ */

    //         if (moduleId) {

    //             // Convert incoming modules to array
    //             let removeModules = String(moduleId).includes(',')
    //                 ? String(moduleId).split(',')
    //                 : [moduleId];

    //             removeModules = removeModules.map(m => m.trim());

    //             // Existing modules
    //             let existingModules = superUser.ADMIMOD
    //                 ? superUser.ADMIMOD.split(',')
    //                 : [];

    //             existingModules = existingModules.map(m => m.trim());

    //             // Remove modules
    //             const updatedModules = existingModules.filter(
    //                 mod => !removeModules.includes(mod)
    //             );

    //             await admi.update(
    //                 { ADMIMOD: updatedModules.join(',') },
    //                 { ADMIF00: superUser.ADMIF00 }
    //             );
    //         }

    //         /* ============================ */
    //         /* 3️⃣ SETUP DEACTIVATION       */
    //         /* ============================ */

    //         if (setUpId) {

    //             const m81Row = await m81.findOne({
    //                 M81UNQ: superUser.ADMIF00.toString()
    //             });

    //             if (m81Row) {

    //                 let existingSetups = m81Row.M81SID
    //                     ? m81Row.M81SID.split(',')
    //                     : [];

    //                 existingSetups = existingSetups
    //                     .filter(id => id !== setUpId);

    //                 await m81.update(
    //                     { M81SID: existingSetups.join(',') },
    //                     { M81UNQ: superUser.ADMIF00.toString() }
    //                 );
    //             }
    //         }

    //         /* ============================ */
    //         /* 4️⃣ PAYMENT / AUDIT ENTRY    */
    //         /* ============================ */

    //         await PLRDBPYMT.create({
    //             PYMT01: corporateId,
    //             PYMT02: 0,
    //             PYMT03: referenceNo || ('ADMIN_DEMOD_' + Date.now()),
    //             PYMT04: 'OFFLINE',
    //             PYMT05: parseFloat(amount || 0),
    //             PYMT06: 'SUCCESS',
    //             PYMT07: paymentMethod || 'CASH',
    //             PYMT09: description || 'Module Deactivation',
    //             PYMT10: corp.A01F13 || null
    //         }, { transaction });

    //         await transaction.commit();

    //         response.status = 'SUCCESS';
    //         response.message = 'Module / Setup deactivated successfully';

    //         return res.status(200).json({
    //             encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //         });

    //     } catch (err) {

    //         await transaction.rollback();

    //         console.error(err);

    //         response.status = 'FAIL';
    //         response.message = 'Failed to deactivate module';

    //         return res.status(500).json({
    //             encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //         });
    //     }
    // }
    static async moduleDeactivation(pa, response, res) {

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

            await PLRDBPYMT.create({
                PYMT01: corporateId,
                PYMT02: 0,
                PYMT03: referenceNo || ('ADMIN_DEMOD_' + Date.now()),
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
}

module.exports = CAdminPlanController;