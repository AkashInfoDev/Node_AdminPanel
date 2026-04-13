const querystring = require('querystring');
const db = require('../Config/config');
const definePLRDBA01 = require('../Models/RDB/PLRDBA01');
const TokenService = require('../Services/tokenServices');
const Encryptor = require('../Services/encryptor');
const { Op } = require('sequelize');
const { fn, col, literal } = require('sequelize');
const sequelizeRDB = db.getConnection('RDB');
const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const definePLRDBA02 = require('../Models/RDB/PLRDBA02');
const PLRDBA02 = definePLRDBA02(sequelizeRDB);
const definePLRDBPLREL = require('../Models/RDB/PLRDBPLREL'); // Model factory
const PLRDBPLREL = definePLRDBPLREL(sequelizeRDB);
const definePLRDBPYMT = require('../Models/RDB/PLRDBPYMT');
const EP_USERController = require('./EP_USERController');
const PLRDBPYMT = definePLRDBPYMT(sequelizeRDB);


const encryptor = new Encryptor();

class AdminDashboardController {

    static async manageDashboard(req, res) {
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

            const decoded = await TokenService.validateAdminToken(token);


            // allow all roles
            const roleId = Number(decoded.roleId);

            if (![1,2,3].includes(roleId)) {
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

                /* ==========================
                 * D → DASHBOARD COUNTS
                 * ========================== */
                case 'D':
                    return AdminDashboardController.dashboardCounts(req, res);

                /* ==========================
                 * C → ALL CORPORATES
                 * ========================== */
                case 'U':
                    return AdminDashboardController.getAllCorporateUsers(req, res);



                case 'P':
                    if (!pa.password || !corporateId) {
                        response.status = 'FAIL';
                        response.message = 'corporateId or password are required';
                        return res.status(400).json({
                            encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                        });
                    }

                    return AdminDashboardController.updateUserPassword(
                        corporateId,
                        pa.password,
                        response,
                        res
                    );


                /* ==========================
                * X → FULL CORPORATE DETAILS
                * ========================== */


                case 'X':
                    if (!corporateId) {
                        response.status = 'FAIL';
                        response.message = 'corporateId is required';
                        return res.status(400).json({
                            encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                        });
                    }

                    return AdminDashboardController.gotCorporateFullDetails(
                        corporateId,
                        response,
                        res
                    );


                case 'R':
                    if (!corporateId || !pa.companyId) {
                        response.status = 'FAIL';
                        response.message = 'corporateId and cmpId are required';
                        return res.status(400).json({
                            encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                        });
                    }

                    return AdminDashboardController.recoverCompany(
                        corporateId,
                        pa.companyId,
                        response,
                        res
                    );

                case 'Z':
                    if (!corporateId) {
                        response.status = 'FAIL';
                        response.message = 'corporateId is required';
                        return res.status(400).json({
                            encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                        });
                    }

                    return AdminDashboardController.getCorporatePlanDetails(
                        corporateId,
                        response,
                        res
                    );

                case 'Y':
                    if (!corporateId) {
                        response.status = 'FAIL';
                        response.message = 'corporateId is required';
                        return res.status(400).json({
                            encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                        });
                    }

                    return AdminDashboardController.previewCorporateDeletion(
                        corporateId,
                        response,
                        res
                    );

                default:
                    response.status = 'FAIL';
                    response.message = 'Invalid action';
                    return res.status(400).json({
                        encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                    });
            }

        } catch (err) {
            console.error('manageDashboard error:', err);
            response.status = 'FAIL';
            response.message = 'Server error';
            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }

    static async dashboardCounts(req, res) {
        let response = { status: 'SUCCESS', message: '', data: null };
        let encryptedResponse;

        try {
            // 🔐 1. Token
            const token = req.headers['authorization']?.split(' ')[1];
            if (!token) {
                response.status = 'FAIL';
                response.message = 'Token missing';
                encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                return res.status(401).json({ encryptedResponse });
            }

            const decoded = await TokenService.validateAdminToken(token);

            const roleId = Number(decoded.roleId);

            if (![1, 2, 3, 4].includes(roleId)) {
                response.status = 'FAIL';
                response.message = 'Access denied';
                return res.status(403).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            /* =========================
               🔥 ROLE-BASED FILTER
            ========================= */

            let whereCondition = {};

            if (![1, 2].includes(roleId)) {

                // 👤 Get User_Id from UserTable
                const userCtrl = new EP_USERController('RDB');

                const users = await userCtrl.findAll({
                    UTF07: 'N'
                });

                let loggedUser = null;

                for (let u of users) {
                    let decryptedId;

                    try {
                        decryptedId = encryptor.decrypt(u.UTF04);
                    } catch {
                        decryptedId = u.UTF04;
                    }

                    let tokenUserId;

                    try {
                        tokenUserId = encryptor.decrypt(decoded.userId);
                    } catch {
                        tokenUserId = decoded.userId;
                    }

                    if (String(decryptedId) === String(tokenUserId)) {
                        loggedUser = u;
                        break;
                    }
                }

                if (!loggedUser) {
                    throw new Error('User not found');
                }

                // 🔥 MAIN FILTER
                whereCondition.A01F19 = loggedUser.UTF01;
            }

            /* =========================
               📅 DATE SETUP
            ========================= */

            const today = new Date();
            const next7Days = new Date();
            next7Days.setDate(today.getDate() + 7);

            /* =========================
               🏢 CORPORATE COUNTS
            ========================= */

            const totalCorporates = await PLRDBA01.count({
                where: whereCondition
            });

            const activeCorporates = await PLRDBA01.count({
                where: {
                    ...whereCondition,
                    A01F08: 'A'
                }
            });

            const inactiveCorporates = await PLRDBA01.count({
                where: {
                    ...whereCondition,
                    A01F08: 'D'
                }
            });

            /* =========================
               📅 SUBSCRIPTIONS
            ========================= */

            const activeSubscriptions = await PLRDBA01.count({
                where: {
                    ...whereCondition,
                    A01F13: { [Op.gte]: today }
                }
            });

            const expiredSubscriptions = await PLRDBA01.count({
                where: {
                    ...whereCondition,
                    A01F13: { [Op.lt]: today }
                }
            });

            const expiringSoon = await PLRDBA01.count({
                where: {
                    ...whereCondition,
                    A01F13: { [Op.between]: [today, next7Days] }
                }
            });

            /* =========================
               💰 PAYMENTS
            ========================= */

            const paymentDone = activeSubscriptions;

            const paymentPending = await PLRDBA01.count({
                where: {
                    ...whereCondition,
                    [Op.or]: [
                        { A01F13: { [Op.lt]: today } },
                        { A01F08: 'D' }
                    ]
                }
            });

            /* =========================
               📊 PLAN STATS
            ========================= */

            const planUsage = await PLRDBA01.findAll({
                attributes: [
                    'A02F01',
                    [fn('COUNT', col('A02F01')), 'totalUsers']
                ],
                where: {
                    ...whereCondition,
                    A02F01: { [Op.in]: [2, 6, 7] },
                    A01F13: { [Op.gte]: today }
                },
                group: ['A02F01']
            });

            const planStats = {
                trial: 0,
                default: 0,
                standard: 0
            };

            planUsage.forEach(row => {
                const planId = row.A02F01;
                const count = parseInt(row.get('totalUsers'));

                if (planId === 2) planStats.trial = count;
                if (planId === 6) planStats.default = count;
                if (planId === 7) planStats.standard = count;
            });

            /* =========================
               📈 GROWTH
            ========================= */

            const newUsersDaily = await PLRDBA01.findAll({
                attributes: [
                    [literal('CAST(A01F12 AS DATE)'), 'date'],
                    [fn('COUNT', col('A01F12')), 'totalUsers']
                ],
                where: whereCondition,
                group: [literal('CAST(A01F12 AS DATE)')],
                order: [[literal('CAST(A01F12 AS DATE)'), 'ASC']]
            });

            const newUsersGrowth = newUsersDaily.map(row => ({
                date: row.get('date'),
                totalUsers: parseInt(row.get('totalUsers'))
            }));

            /* =========================
               💳 RECENT TXN (optional filter later)
            ========================= */
            let corporateIds = [];

            if (![1, 2].includes(roleId)) {

                const corporates = await PLRDBA01.findAll({
                    attributes: ['A01F03'],
                    where: whereCondition
                });

                corporateIds = corporates.map(c => c.A01F03?.trim());
            }


            const txnWhere = {};

            if (![1, 2].includes(roleId)) {
                txnWhere.PYMT01 = {
                    [Op.in]: corporateIds
                };
            }

            const recentTransactions = await PLRDBPYMT.findAll({
                attributes: ['PYMT01', 'PYMT05', 'PYMT06', 'PYMT03', 'PYMT08'],
                where: txnWhere,
                order: [['PYMT08', 'DESC']],
                limit: 7
            });

            const recentTxnList = recentTransactions.map(txn => ({
                corporateId: txn.PYMT01,
                amount: parseFloat(txn.PYMT05),
                status: txn.PYMT06,
                reference: txn.PYMT03,
                date: txn.PYMT08
            }));

            /* =========================
               💰 WEEKLY REVENUE
            ========================= */

            const last7Days = new Date();
            last7Days.setDate(last7Days.getDate() - 7);

            const weeklyRevenueResult = await PLRDBPYMT.findAll({
                attributes: [
                    [fn('SUM', col('PYMT05')), 'weeklyRevenue']
                ],
                where: {
                    ...txnWhere,
                    PYMT06: 'SUCCESS',
                    PYMT08: { [Op.gte]: last7Days }
                },
                raw: true
            });

            const weeklyRevenue =
                parseFloat(weeklyRevenueResult[0]?.weeklyRevenue) || 0;

            /* =========================
               ✅ FINAL RESPONSE
            ========================= */

            response.data = {
                corporateStats: {
                    total: totalCorporates,
                    active: activeCorporates,
                    inactive: inactiveCorporates
                },
                subscriptionStats: {
                    active: activeSubscriptions,
                    expired: expiredSubscriptions,
                    expiringSoon
                },
                paymentStats: {
                    paymentDone,
                    paymentPending
                },
                planStats,
                newUsersGrowth,
                recentTransactions: recentTxnList,
                weeklyRevenue
            };

            encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(200).json({ encryptedResponse });

        } catch (err) {
            console.error('DashboardCounts error:', err.message);

            response.status = 'FAIL';
            response.message = 'Dashboard load failed';

            encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(500).json({ encryptedResponse });
        }
    }


    // static async getAllCorporateUsers(req, res) {
    //     let response = { status: 'SUCCESS', message: '', data: null };
    //     let encryptedResponse;

    //     try {
    //         /* ------------------------------
    //          * 1. TOKEN VALIDATION
    //          * ---------------------------- */
    //         const token = req.headers['authorization']?.split(' ')[1];

    //         if (!token) {
    //             response.status = 'FAIL';
    //             response.message = 'Authorization token missing';
    //             encryptedResponse = encryptor.encrypt(JSON.stringify(response));
    //             return res.status(401).json({ encryptedResponse });
    //         }

    //         const decoded = await TokenService.validateAdminToken(token);

    //         const roleId = Number(decoded.roleId);

    //         if (![1, 2, 3, 4].includes(roleId)) {
    //             response.status = 'FAIL';
    //             response.message = 'Access denied';
    //             return res.status(403).json({
    //                 encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //             });
    //         }

    //         /* ------------------------------
    //          * 🔥 ROLE-BASED FILTER
    //          * ---------------------------- */

    //         let whereCondition = {};

    //         if (![1, 2].includes(roleId)) {

    //             const userCtrl = new EP_USERController('RDB');

    //             const users = await userCtrl.findAll({
    //                 UTF07: 'N'
    //             });

    //             let loggedUser = null;

    //             for (let u of users) {
    //                 let decryptedId;

    //                 try {
    //                     decryptedId = encryptor.decrypt(u.UTF04);
    //                 } catch {
    //                     decryptedId = u.UTF04;
    //                 }

    //                 if (decryptedId === decoded.userId) {
    //                     loggedUser = u;
    //                     break;
    //                 }
    //             }

    //             if (!loggedUser) {
    //                 throw new Error('User not found');
    //             }

    //             // 🔥 FILTER BY OWNER
    //             whereCondition.A01F19 = loggedUser.UTF01;
    //         }

    //         /* ------------------------------
    //          * 2. FETCH CORPORATES
    //          * ---------------------------- */
    //         const userCtrl = new EP_USERController('RDB');

    //         const users = await userCtrl.findAll({
    //             UTF07: 'N'
    //         });

    //         // Create lookup map → O(1) access (VERY IMPORTANT 🔥)
    //         const userMap = {};

    //         for (let u of users) {
    //             userMap[u.UTF01] = {
    //                 role: u.UTF03,
    //                 name: u.UTF02
    //             };
    //         }

    //         const corporates = await PLRDBA01.findAll({
    //             attributes: [
    //                 'A01F01',
    //                 'A01F02',
    //                 'A01F03',
    //                 'A01F08',
    //                 'A01F12',
    //                 'A01F13',
    //                 'A01F10',
    //                 'A01F19'

    //             ],
    //             where: whereCondition,
    //             order: [['A01F03', 'ASC']]
    //         });

    //         /* ------------------------------
    //          * 3. MAP RESPONSE
    //          * ---------------------------- */

    //         response.data = corporates.map(row => ({
    //             corpUnq: row.A01F01?.trim() || null,
    //             corporateId: row.A01F03?.trim() || null,
    //             companyName: row.A01F02?.trim() || null,
    //             status: row.A01F08 === 'A' ? 'ACTIVE' : 'INACTIVE',
    //             subscription: {
    //                 startDate: row.A01F12,
    //                 endDate: row.A01F13
    //             },
    //             licensedUsers: row.A01F10 || 0
    //         }));

    //         /* ------------------------------
    //          * 4. ENCRYPT RESPONSE
    //          * ---------------------------- */

    //         encryptedResponse = encryptor.encrypt(JSON.stringify(response));
    //         return res.status(200).json({ encryptedResponse });

    //     } catch (err) {
    //         console.error('getAllCorporateUsers error:', err.message);

    //         response.status = 'FAIL';
    //         response.message = 'Failed to load corporate list';

    //         encryptedResponse = encryptor.encrypt(JSON.stringify(response));
    //         return res.status(500).json({ encryptedResponse });
    //     }
    // }
    static async getAllCorporateUsers(req, res) {
        let response = { status: 'SUCCESS', message: '', data: null };
        let encryptedResponse;

        try {
            /* ------------------------------
             * 1. TOKEN VALIDATION
             * ---------------------------- */
            const token = req.headers['authorization']?.split(' ')[1];

            if (!token) {
                response.status = 'FAIL';
                response.message = 'Authorization token missing';
                encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                return res.status(401).json({ encryptedResponse });
            }

            const decoded = await TokenService.validateAdminToken(token);
            const roleId = Number(decoded.roleId);

            if (![1, 2,3].includes(roleId)) {
                response.status = 'FAIL';
                response.message = 'Access denied';
                return res.status(403).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            /* ------------------------------
             * 2. FETCH USERS ONCE (🔥 IMPORTANT)
             * ---------------------------- */
            const userCtrl = new EP_USERController('RDB');

            const users = await userCtrl.findAll({
                UTF07: 'N'
            });

            // 🔥 Create lookup map (O(1))
            const userMap = {};

            for (let u of users) {
                userMap[u.UTF01] = {
                    role: u.UTF03,
                    name: u.UTF02,
                    encryptedId: u.UTF04
                };
            }

            /* ------------------------------
             * 3. ROLE-BASED FILTER
             * ---------------------------- */
            let whereCondition = {};

            if (![1, 2].includes(roleId)) {

                let loggedUser = null;

                for (let u of users) {
                    let decryptedId;

                    try {
                        decryptedId = encryptor.decrypt(u.UTF04);
                    } catch {
                        decryptedId = u.UTF04;
                    }

                    // if (decryptedId === decoded.userId) {
                    //     loggedUser = u;
                    //     break;
                    // }
                    let tokenUserId;

                    try {
                        tokenUserId = encryptor.decrypt(decoded.userId);
                    } catch {
                        tokenUserId = decoded.userId;
                    }

                    if (String(decryptedId) === String(tokenUserId)) {
                        loggedUser = u;
                        break;
                    }
                }

                if (!loggedUser) {
                    throw new Error('User not found');
                }

                // 🔥 Filter corporates by owner
                whereCondition.A01F19 = loggedUser.UTF01;
            }

            /* ------------------------------
             * 4. FETCH CORPORATES
             * ---------------------------- */
            const corporates = await PLRDBA01.findAll({
                attributes: [
                    'A01F01',
                    'A01F02',
                    'A01F03',
                    'A01F08',
                    'A01F12',
                    'A01F13',
                    'A01F10',
                    'A01F19' // internal use only
                ],
                where: whereCondition,
                order: [['A01F03', 'ASC']]
            });

            /* ------------------------------
             * 5. MAP RESPONSE (🔥 FINAL LOGIC)
             * ---------------------------- */
            response.data = corporates.map(row => {

                const ownerId = row.A01F19;
                const ownerDetails = userMap[ownerId] || {};

                return {
                    corpUnq: row.A01F01?.trim() || null,
                    corporateId: row.A01F03?.trim() || null,
                    companyName: row.A01F02?.trim() || null,
                    status: row.A01F08 === 'A' ? 'ACTIVE' : 'INACTIVE',
                    subscription: {
                        startDate: row.A01F12,
                        endDate: row.A01F13
                    },
                    licensedUsers: row.A01F10 || 0,

                    // ✅ Instead of exposing A01F19
                    ownerRole: ownerDetails.role || null,
                    ownerName: ownerDetails.name || null
                };
            });

            /* ------------------------------
             * 6. ENCRYPT RESPONSE
             * ---------------------------- */
            encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(200).json({ encryptedResponse });

        } catch (err) {
            console.error('getAllCorporateUsers error:', err.message);

            response.status = 'FAIL';
            response.message = 'Failed to load corporate list';

            encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(500).json({ encryptedResponse });
        }
    }

    static async getCorporateUserList(corporateId, response, res) {
        try {
            const corpId = corporateId.trim().toUpperCase();

            /* =========================
             * 1. RDB → CORPORATE LOOKUP
             * ========================= */
            const corp = await PLRDBA01.findOne({
                where: { A01F03: corpId },
                attributes: ['A01F01', 'A01F02']
            });

            if (!corp) {
                response.status = 'FAIL';
                response.message = 'Corporate not found';
                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            // const corpUnq = corp.A01F01.trim();
            const corpUnq = String(corp.A01F01).trim();


            /* =========================
             * 2. BUILD SDB NAME
             * ========================= */
            const parts = corpId.split('-');
            let sdbName =
                parts.length === 3
                    ? `${parts[0]}${parts[1]}${parts[2]}SDB`
                    : `${parts[0]}${parts[1]}SDB`;

            if (sdbName === 'PLP00001SDB') sdbName = 'A00001SDB';
            const { Sequelize } = require('sequelize');
            const sdb = db.getConnection(sdbName);


            /* =========================
             * 3. FETCH USERS (PLSDBADMI)
             * ========================= */
            const ADMIController = require('./ADMIController');
            const admi = new ADMIController(sdbName);

            const users = await admi.findAll(
                { ADMICORP: corpUnq },
                [],
                [
                    'ADMIF01', // User ID (Encrypted)
                    'ADMIF02', // First Name
                    'ADMIF04', // Last Name
                    'ADMIF05', // Password (Encrypted)
                    'ADMIF06', // Role ID
                    'ADMIF07', // Email
                    'ADMIF08', // Is Active
                    'ADMIF09', // DOB
                    'ADMIF10', // Gender
                    'ADMIBRC', // Assigned Branches
                    'ADMICOMP', // Assigned Companies
                    'ADMIROL'
                ]
            );

            /* =========================
             * 4. USER DTO MAPPER
             * ========================= */
            const mapUser = (u) => {
                const isActive = u.ADMIF08 === 1 || u.ADMIF08 === true;

                let userId = null;
                let password = null;

                try { userId = encryptor.decrypt(u.ADMIF01); }
                catch { userId = u.ADMIF01; }

                try { password = encryptor.decrypt(u.ADMIF05); }
                catch { password = u.ADMIF05; }

                return {
                    /* 🔹 BASIC INFORMATION */
                    userId,
                    password,
                    assignRole: u.ADMIF06 ?? null,
                    assignCompanyNo: u.ADMICOMP || 'All',
                    assignBranch: u.ADMIBRC || 'All',

                    /* 🔹 PERSONAL INFORMATION */
                    firstName: u.ADMIF02 || '',
                    lastName: u.ADMIF04 || '',
                    gender: u.ADMIF10 || '',
                    dob: u.ADMIF09 || null,
                    email: u.ADMIF07 || '',

                    /* 🔹 STATUS */
                    isActive,
                    status: isActive ? 'ACTIVE' : 'INACTIVE'
                };
            };

            /* =========================
             * 5. ROLE-WISE SPLIT
             * ========================= */
            const superUsers = users.filter(u => u.ADMIF06 === 2);
            const normalUsers = users.filter(u => u.ADMIF06 === 3);

            /* =========================
             * 6. STATUS COUNTS
             * ========================= */
            const activeCount = users.filter(
                u => u.ADMIF08 === 1 || u.ADMIF08 === true
            ).length;

            const inactiveCount = users.length - activeCount;

            /* =========================
 * 6A. COUNT BRANCHES
 * ========================= */
            const branchCountResult = await sdb.query(
                `
    SELECT COUNT(*) AS total
    FROM PLSDBBRC
    WHERE BRCORP = :corpUnq
    `,
                {
                    replacements: { corpUnq },
                    type: Sequelize.QueryTypes.SELECT
                }
            );

            const totalBranches = branchCountResult[0]?.total || 0;

            /* =========================
             * 6B. COUNT COMPANIES
             * ========================= */
            const companyCountResult = await sdb.query(
                `
    SELECT COUNT(*) AS total
    FROM PLSDBCMP
    WHERE CMPDEL IS NULL
    `,
                {
                    type: Sequelize.QueryTypes.SELECT
                }
            );

            const totalCompanies = companyCountResult[0]?.total || 0;


            /* =========================
             * 7. FINAL RESPONSE
             * ========================= */
            response.data = {
                corporateId: corpId,
                companyName: corp.A01F02?.trim(),


                totalBranches,
                totalCompanies,

                totalUsers: users.length,

                usersStatus: {
                    active: activeCount,
                    inactive: inactiveCount
                },

                roleStatus: {
                    superUsers: superUsers.length,
                    users: normalUsers.length
                },

                superUser: superUsers.map(mapUser),
                users: normalUsers.map(mapUser)
            };

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {
            console.error('getCorporateUserList error:', err);

            response.status = 'FAIL';
            response.message = 'Failed to load users';

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }

    //Corporate Super User Password Change
    static async updateUserPassword(corporateId, password, response, res) {
        try {
            const corpId = corporateId.trim().toUpperCase();

            /* =========================
             * 1. RDB → CORPORATE LOOKUP
             * ========================= */
            const corp = await PLRDBA01.findOne({
                where: { A01F03: corpId },
                attributes: ['A01F01']
            });

            if (!corp) {
                response.status = 'FAIL';
                response.message = 'Corporate not found';
                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            const corpUnq = corp.A01F01.trim();

            /* =========================
             * 2. BUILD SDB NAME
             * ========================= */
            const parts = corpId.split('-');
            let sdbName =
                parts.length === 3
                    ? `${parts[0]}${parts[1]}${parts[2]}SDB`
                    : `${parts[0]}${parts[1]}SDB`;

            if (sdbName === 'PLP00001SDB') sdbName = 'A00001SDB';

            /* =========================
             * 3. ENCRYPT PASSWORD
             * ========================= */
            const encryptedPassword = encryptor.encrypt(password);

            /* =========================
             * 4. UPDATE PASSWORD (ROLE = 2 ONLY)
             * ========================= */
            const ADMIController = require('./ADMIController');
            const admi = new ADMIController(sdbName);

            const updated = await admi.update(
                { ADMIF05: encryptedPassword },
                {
                    // ADMIF00: admiF00,   // ✅ AUTO-INCREMENT PK
                    ADMIF06: 2,         // ✅ ROLE = 2 ONLY
                    ADMICORP: corpUnq
                }
            );

            if (!updated || updated === 0) {
                response.status = 'FAIL';
                response.message = 'User not found or password not updated';
                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            /* =========================
             * 5. SUCCESS
             * ========================= */
            response.status = 'SUCCESS';
            response.message = 'Password updated successfully';
            response.data = null;

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {
            console.error('updateUserPassword error:', err);

            response.status = 'FAIL';
            response.message = 'Failed to update password';

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }


    static async gotCorporateFullDetails(corporateId, response, res) {
        try {
            const corpId = corporateId.trim().toUpperCase();

            /* =========================
             * 1. CORPORATE LOOKUP (RDB)
             * ========================= */
            const corp = await PLRDBA01.findOne({
                where: { A01F03: corpId },
                attributes: ['A01F01', 'A01F02']
            });

            if (!corp) {
                response.status = 'FAIL';
                response.message = 'Corporate not found';
                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            const corpUnq = String(corp.A01F01).trim();

            /* =========================
             * 2. BUILD SDB NAME
             * ========================= */
            const parts = corpId.split('-');
            let sdbName =
                parts.length === 3
                    ? `${parts[0]}${parts[1]}${parts[2]}SDB`
                    : `${parts[0]}${parts[1]}SDB`;

            if (sdbName === 'PLP00001SDB')
                sdbName = 'A00001SDB';

            const sdb = db.getConnection(sdbName);

            /* =========================
             * 3. LOAD CONTROLLERS
             * ========================= */
            const ADMIController = require('./ADMIController');
            const defineCRONLOGS = require('../Models/SDB/CRONLOGS');

            const admi = new ADMIController(sdbName);

            // CRONLOGS from system DB
            const sequelizeSystemSDB = db.getConnection('A00001SDB');
            const CRONLOGS = defineCRONLOGS(sequelizeSystemSDB);

            /* =========================
             * 4. USERS
             * ========================= */
            const users = await admi.findAll(
                { ADMICORP: corpUnq },
                [],
                [
                    'ADMIF00',
                    'ADMIF01', 'ADMIF02', 'ADMIF04', 'ADMIF05',
                    'ADMIF06', 'ADMIF07', 'ADMIF08', 'ADMIF09',
                    'ADMIF10', 'ADMIBRC', 'ADMICOMP', 'ADMIROL'
                ]
            );

            const superUsers = users.filter(u => u.ADMIF06 === 2);
            const normalUsers = users.filter(u => u.ADMIF06 === 3);

            const activeCount = users.filter(
                u => u.ADMIF08 === 1 || u.ADMIF08 === true
            ).length;

            const inactiveCount = users.length - activeCount;

            /* =========================
             * 5. FETCH ALL COMPANIES
             * ========================= */
            const companies = await sdb.query(`
            SELECT CMPF01,CMPF02,CMPF03,CMPF04,
                   CMPF11,CMPF12,CMPDEL
            FROM PLSDBCMP
            ORDER BY CMPF12 DESC
        `, {
                type: require('sequelize').QueryTypes.SELECT
            });

            /* =========================
             * 6. LOAD CRON LOGS
             * ========================= */
            const cronRows = await CRONLOGS.findAll({
                where: {
                    CRONF02: corpId,
                    CRONF07: 'Y'
                }
            });

            const cronMap = {};
            cronRows.forEach(r => {
                cronMap[String(r.CRONF03)] = r;
            });

            /* =========================
             * 7. DATE DIFFERENCE FUNCTION
             * ========================= */
            function getDateDifference(cronDateStr) {

                if (!cronDateStr) return 999;

                cronDateStr = String(cronDateStr).replace(/'/g, '').trim();
                if (cronDateStr.length !== 8) return 999;

                const year = parseInt(cronDateStr.substring(0, 4));
                const month = parseInt(cronDateStr.substring(4, 6)) - 1;
                const day = parseInt(cronDateStr.substring(6, 8));

                const deletedDate = new Date(year, month, day);
                const today = new Date();

                return Math.floor((today - deletedDate) / (1000 * 60 * 60 * 24));
            }

            /* =========================
             * 8. BUILD LIFECYCLE STATUS
             * ========================= */
            const companiesWithStatus = companies.map(c => {

                const cmpId = String(c.CMPF01);
                const cron = cronMap[cmpId];

                let lifecycleStatus = 'ACTIVE';

                if (c.CMPDEL !== null) {

                    if (cron) {
                        const diff = getDateDifference(cron.CRONF04);

                        lifecycleStatus = diff <= 30
                            ? 'RECOVERABLE'
                            : 'NOT_RECOVERABLE';
                    } else {
                        lifecycleStatus = 'NOT_RECOVERABLE';
                    }
                }

                return {
                    companyId: c.CMPF01,
                    companyName: c.CMPF02,
                    dbType: c.CMPF03,
                    groupName: c.CMPF04 || 'No Group',
                    createdBy: c.CMPF11,
                    createdAt: c.CMPF12,
                    status: 'ACTIVE',
                    lifecycleStatus
                };
            });

            /* =========================
             * 9. LOAD BRANCHES
             * ========================= */
            const branches = await sdb.query(`
            SELECT BRID,BRCODE,BRNAME,BRGST,BRSTATE,BRDEF,BRCCOMP
            FROM PLSDBBRC
            WHERE BRCORP = :corpUnq
        `, {
                replacements: { corpUnq },
                type: require('sequelize').QueryTypes.SELECT
            });

            const branchList = branches.map(b => ({
                branchId: b.BRID,
                branchCode: b.BRCODE,
                branchName: b.BRNAME,
                gst: b.BRGST,
                state: b.BRSTATE,
                isDefault: b.BRDEF === 'Y',
                companyCodes: b.BRCCOMP ? b.BRCCOMP.split(',') : []
            }));

            /* =========================
             * 10. USER MAPPER (UPDATED)
             * ========================= */
            const mapUser = (u) => {

                const isActive = u.ADMIF08 === 1 || u.ADMIF08 === true;

                let userId = null;
                let password = null;

                try { userId = encryptor.decrypt(u.ADMIF01); }
                catch { userId = u.ADMIF01; }

                try { password = encryptor.decrypt(u.ADMIF05); }
                catch { password = u.ADMIF05; }

                let assignedCompanies = [];

                // SUPER USER → ALL COMPANIES
                if (u.ADMIF06 === 2) {
                    assignedCompanies = companiesWithStatus;
                }
                // NORMAL USER → FILTERED COMPANIES
                else if (u.ADMICOMP && u.ADMICOMP.trim() !== '') {

                    const userCompanyIds = u.ADMICOMP
                        .split(',')
                        .map(x => x.trim());

                    assignedCompanies = companiesWithStatus.filter(c =>
                        userCompanyIds.includes(String(c.companyId))
                    );
                }

                return {
                    userId,
                    password,
                    assignRole: u.ADMIF06 ?? null,
                    userRole: u.ADMIROL || null,
                    assignCompanyNo: assignedCompanies,
                    assignBranch: u.ADMIBRC || 'All',
                    firstName: u.ADMIF02 || '',
                    lastName: u.ADMIF04 || '',
                    gender: u.ADMIF10 || '',
                    dob: u.ADMIF09 || null,
                    email: u.ADMIF07 || '',
                    isActive,
                    status: isActive ? 'ACTIVE' : 'INACTIVE'
                };
            };

            // const mapUser = (u) => {

            //     const isActive = u.ADMIF08 === 1 || u.ADMIF08 === true;

            //     let userId = null;
            //     let password = null;

            //     try { userId = encryptor.decrypt(u.ADMIF01); }
            //     catch { userId = u.ADMIF01; }

            //     try { password = encryptor.decrypt(u.ADMIF05); }
            //     catch { password = u.ADMIF05; }

            //     /* =========================
            //      * ASSIGN COMPANIES
            //      * ========================= */
            //     let assignedCompanies = [];

            //     if (u.ADMIF06 === 2) {
            //         // SUPER USER → ALL COMPANIES
            //         assignedCompanies = companiesWithStatus;
            //     }
            //     else if (u.ADMICOMP && u.ADMICOMP.trim() !== '') {
            //         const userCompanyIds = u.ADMICOMP
            //             .split(',')
            //             .map(x => x.trim());

            //         assignedCompanies = companiesWithStatus.filter(c =>
            //             userCompanyIds.includes(String(c.companyId))
            //         );
            //     }

            //     /* =========================
            //      * ASSIGN BRANCHES
            //      * ========================= */
            //     let assignedBranches = [];

            //     if (u.ADMIF06 === 2) {
            //         // SUPER USER → ALL BRANCHES
            //         assignedBranches = branchList;
            //     }
            //     else if (u.ADMIBRC && u.ADMIBRC.trim() !== '') {
            //         const userBranchCodes = u.ADMIBRC
            //             .split(',')
            //             .map(x => x.trim());

            //         assignedBranches = branchList.filter(b =>
            //             userBranchCodes.includes(String(b.branchCode)) ||
            //             userBranchCodes.includes(String(b.branchId))
            //         );
            //     }

            //     return {
            //         userId,
            //         password,
            //         assignRole: u.ADMIF06 ?? null,
            //         assignCompanyNo: assignedCompanies,
            //         assignBranch: assignedBranches,
            //         firstName: u.ADMIF02 || '',
            //         lastName: u.ADMIF04 || '',
            //         gender: u.ADMIF10 || '',
            //         dob: u.ADMIF09 || null,
            //         email: u.ADMIF07 || '',
            //         isActive,
            //         status: isActive ? 'ACTIVE' : 'INACTIVE'
            //     };
            // };
            /* =========================
             * FINAL RESPONSE
             * ========================= */
            response.data = {
                corporateId: corpId,
                companyName: corp.A01F02?.trim(),
                totalBranches: branchList.length,
                totalCompanies: companiesWithStatus.length,
                totalUsers: users.length,

                usersStatus: {
                    active: activeCount,
                    inactive: inactiveCount
                },

                roleStatus: {
                    superUsers: superUsers.length,
                    users: normalUsers.length
                },

                superUser: superUsers.map(mapUser),
                users: normalUsers.map(mapUser),
                branches: branchList,
                companies: companiesWithStatus
            };

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {
            console.error(err);

            response.status = 'FAIL';
            response.message = 'Failed to load data';

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }
    //Recover company before 30 days
    static async recoverCompany(corporateId, companyId, response, res) {
        const { Sequelize } = require('sequelize');

        try {
            const corpId = corporateId.trim().toUpperCase();

            /* =========================
             * 1. FIND CORPORATE (RDB)
             * ========================= */
            const corp = await PLRDBA01.findOne({
                where: { A01F03: corpId },
                attributes: ['A01F01']
            });

            if (!corp) {
                response.status = 'FAIL';
                response.message = 'Corporate not found';
                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            const corpUnq = String(corp.A01F01).trim();

            /* =========================
             * 2. BUILD SDB NAME
             * ========================= */
            const parts = corpId.split('-');
            let sdbName =
                parts.length === 3
                    ? `${parts[0]}${parts[1]}${parts[2]}SDB`
                    : `${parts[0]}${parts[1]}SDB`;

            if (sdbName === 'PLP00001SDB')
                sdbName = 'A00001SDB';

            const sdb = db.getConnection(sdbName);

            const definePLSDBCMP = require('../Models/SDB/PLSDBCMP');
            const definePLSDBM82 = require('../Models/SDB/PLSDBM82');
            const defineCRONLOGS = require('../Models/SDB/CRONLOGS');

            const PLSDBCMP = definePLSDBCMP(sdb);
            const PLSDBM82 = definePLSDBM82(sdb);

            // CRONLOGS always system DB
            const systemDB = db.getConnection('A00001SDB');
            const CRONLOGS = defineCRONLOGS(systemDB);

            /* =========================
             * 3. FETCH COMPANY
             * ========================= */
            const company = await PLSDBCMP.findOne({
                where: { CMPF01: companyId }
            });

            if (!company || !company.CMPDEL) {
                response.status = 'FAIL';
                response.message = 'Company is not in deleted state';
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            /* =========================
             * 4. FETCH M82 ENTRY
             * ========================= */
            const m82Entry = await PLSDBM82.findOne({
                where: { M82F02: companyId }
            });

            if (!m82Entry || m82Entry.M82ADA !== 'D') {
                response.status = 'FAIL';
                response.message = 'Company is not recoverable';
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            /* =========================
             * 5. FETCH CRON RECORD
             * ========================= */
            const cron = await CRONLOGS.findOne({
                where: {
                    CRONF02: corpId,
                    CRONF03: companyId,
                    CRONF07: 'Y'
                }
            });

            if (!cron) {
                response.status = 'FAIL';
                response.message = 'Recovery window expired';
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            /* =========================
             * 6. CHECK 30 DAY WINDOW
             * ========================= */
            function getDateDifference(cronDateStr) {
                cronDateStr = String(cronDateStr).replace(/'/g, '').trim();
                const year = parseInt(cronDateStr.substring(0, 4));
                const month = parseInt(cronDateStr.substring(4, 6)) - 1;
                const day = parseInt(cronDateStr.substring(6, 8));

                const deletedDate = new Date(year, month, day);
                const today = new Date();

                return Math.floor((today - deletedDate) / (1000 * 60 * 60 * 24));
            }

            const diff = getDateDifference(cron.CRONF04);

            if (diff > 30) {
                response.status = 'FAIL';
                response.message = 'Recovery period expired';
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            /* =========================
             * 7. TRANSACTION (SAFE RECOVERY)
             * ========================= */
            const transaction = await sdb.transaction();

            try {
                await PLSDBCMP.update(
                    { CMPDEL: null },
                    { where: { CMPF01: companyId }, transaction }
                );

                await PLSDBM82.update(
                    { M82ADA: 'A' },
                    { where: { M82F02: companyId }, transaction }
                );

                // await CRONLOGS.update(
                //     { CRONF07: 'N' },
                //     {
                //         where: {
                //             CRONF02: corpId,
                //             CRONF03: cmpId
                //         }
                //     }
                // );
                await CRONLOGS.destroy({
                    where: {
                        CRONF02: corpId,
                        CRONF03: companyId,
                        CRONF07: 'Y'   // optional but safer
                    }
                });

                await transaction.commit();

            } catch (err) {
                await transaction.rollback();
                throw err;
            }

            response.status = 'SUCCESS';
            response.message = 'Company recovered successfully';
            response.data = null;

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {
            console.error('recoverCompany error:', err);

            response.status = 'FAIL';
            response.message = 'Failed to recover company';

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }
    //get plan details of corporate
    static async getCorporatePlanDetails(corporateId, response, res) {
        try {

            const corpId = corporateId.trim().toUpperCase();

            /* =========================
             * 1. FIND CORPORATE (RDB)
             * ========================= */
            const corp = await PLRDBA01.findOne({
                where: { A01F03: corpId }
            });

            if (!corp) {
                response.status = 'FAIL';
                response.message = 'Corporate not found';
                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            const corpUnq = String(corp.A01F01).trim();

            /* =========================
             * 2. BUILD SDB NAME
             * ========================= */
            const parts = corpId.split('-');
            let sdbName =
                parts.length === 3
                    ? `${parts[0]}${parts[1]}${parts[2]}SDB`
                    : `${parts[0]}${parts[1]}SDB`;

            if (sdbName === 'PLP00001SDB')
                sdbName = 'A00001SDB';

            const ADMIController = require('./ADMIController');
            const M81Controller = require('./M81Controller');

            const admi = new ADMIController(sdbName);
            const m81 = new M81Controller(sdbName);

            /* =========================
             * 3. LOAD PLAN MASTER
             * ========================= */
            const currentPlan = await PLRDBA02.findOne({
                where: { A02F01: corp.A02F01 }
            });

            if (!currentPlan) {
                response.status = 'FAIL';
                response.message = 'Plan not found';
                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            /* =========================
             * 4. INCLUDED LIMITS FROM PLAN
             * ========================= */
            const includedUsers = parseInt(currentPlan.A02F07 || 0);
            const includedCompanies = parseInt(currentPlan.A02F08 || 0);
            const includedBranches = parseInt(currentPlan.A02F11F11 || currentPlan.A02F11 || 0);

            /* =========================
             * 5. CURRENT USAGE
             * ========================= */
            const currentUsers = parseInt(corp.A01F10 || 0);
            const currentCompanies = parseInt(corp.A01CMP || 0);
            const currentBranches = parseInt(corp.A01BRC || 0);

            /* =========================
             * 6. BILLABLE CALCULATION
             * ========================= */
            const billableUsers = Math.max(currentUsers - includedUsers, 0);
            const billableCompanies = Math.max(currentCompanies - includedCompanies, 0);
            const billableBranches = Math.max(currentBranches - includedBranches, 0);

            /* =========================
             * 7. LOAD ADD-ON PRICING
             *    (3 = User, 4 = Branch, 5 = Company)
             * ========================= */
            const userPlan = await PLRDBA02.findOne({ where: { A02F01: 3 } });
            const branchPlan = await PLRDBA02.findOne({ where: { A02F01: 4 } });
            const companyPlan = await PLRDBA02.findOne({ where: { A02F01: 5 } });

            const usrDetail = {
                totalUsr: billableUsers,
                totalPrice: billableUsers * (userPlan?.A02F05 || 0)
            };

            const brcDetail = {
                totalBrc: billableBranches,
                totalPrice: billableBranches * (branchPlan?.A02F05 || 0)
            };

            const cmpDetail = {
                totalCmp: billableCompanies,
                totalPrice: billableCompanies * (companyPlan?.A02F05 || 0)
            };

            /* =========================
             * 8. MODULES & SETUPS
             * ========================= */
            const superUser = await admi.findOne({
                ADMIF06: 2,
                ADMICORP: corpUnq
            });
            let totalModule = [];
            let comboModules = [];
            let totalSetUps = [];

            if (superUser) {

                const m81Row = await m81.findOne({
                    M81UNQ: superUser.ADMIF00.toString()
                });

                const custModSetUp = await PLRDBPLREL.findAll();

                const modArray = superUser.ADMIMOD
                    ? superUser.ADMIMOD.split(',').map(m => m.trim())
                    : [];

                for (const cms of custModSetUp) {

                    // 🔹 MENU MODULE
                    if (cms.RELF03 === 'M') {
                        if (modArray.includes(String(cms.RELF01).trim())) {
                            totalModule.push({
                                modId: cms.RELF01,
                                modPrice: cms.RELF02
                            });
                        }
                    }

                    // 🔹 COMBO MODULE
                    // if (cms.RELF03 === 'C') {
                    //     if (modArray.includes(String(cms.RELF01).trim())) {
                    //         comboModules.push({
                    //             modId: cms.RELF01,
                    //             modPrice: cms.RELF02
                    //         });
                    //     }
                    // }
                    if (cms.RELF03 === 'C') {

                        const comboCodes = cms.RELF01
                            .split(',')
                            .map(c => c.trim());

                        const hasAny = comboCodes.some(code =>
                            modArray.includes(code)
                        );

                        if (hasAny) {
                            comboModules.push({
                                comboId: cms.RELF00,   // better to use RELF00 as combo id
                                comboCodes: comboCodes,
                                modPrice: cms.RELF02
                            });
                        }
                    }

                    // 🔹 SETUP
                    if (cms.RELF03 === 'S' && m81Row?.M81SID) {

                        const setUpList = m81Row.M81SID.includes(',')
                            ? m81Row.M81SID.split(',').map(s => s.trim())
                            : [m81Row.M81SID.trim()];

                        const setUpId = cms.RELF01.split('-')[1]?.trim();

                        if (setUpId && setUpList.includes(setUpId)) {
                            totalSetUps.push({
                                setUPId: setUpId,
                                setUPPrice: cms.RELF02
                            });
                        }
                    }
                }
            }

            /* =========================
             * 9. FINAL RESPONSE
             * ========================= */
            response.data = {
                corporateId: corpId,
                companyName: corp.A01F02,
                reNewalPlanDetails: {
                    currentPlanDetails: {
                        currenplanID: currentPlan.A02F01,
                        currenPlan: currentPlan.A02F02,
                        currenPlanPrice: currentPlan.A02F05
                    },
                    cmpDetail,
                    brcDetail,
                    usrDetail,
                    totalModule,
                    comboModules,
                    totalSetUps
                }
            };

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            console.error('getCorporatePlanDetails error:', err);

            response.status = 'FAIL';
            response.message = 'Failed to load plan details';

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }

    static async previewCorporateDeletion(corporateId, response, res) {

        try {

            const corpId = corporateId.trim().toUpperCase();

            // 1️⃣ Validate corporate
            const corp = await PLRDBA01.findOne({
                where: { A01F03: corpId },
                attributes: ['A01F01']
            });

            if (!corp) {
                response.status = 'FAIL';
                response.message = 'Corporate not found';
                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            /* =========================
               2️⃣ Extract numeric part
            ========================== */

            const numberPart = corpId.split('-')[1];  // 00086

            /* =========================
               3️⃣ Build SDB
            ========================== */

            const sdbName = `EP${numberPart}SDB`;

            const sdb = db.getConnection(sdbName);

            /* =========================
               4️⃣ Get companies from SDB
            ========================== */

            const companies = await sdb.query(`
            SELECT CMPF01
            FROM PLSDBCMP
        `, {
                type: require('sequelize').QueryTypes.SELECT
            });

            /* =========================
               5️⃣ Build CMP DB names
            ========================== */

            const cmpDatabases = companies.map(c =>
                // `A${numberPart}CMP${c.CMPF01}`
                `A${numberPart}CMP${String(c.CMPF01).padStart(4, '0')}`
            );

            response.data = {
                corporateId: corpId,
                sdbDatabase: sdbName,
                cmpDatabases
            };

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            console.error(err);

            response.status = 'FAIL';
            response.message = 'Preview failed';

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }
}

module.exports = AdminDashboardController;