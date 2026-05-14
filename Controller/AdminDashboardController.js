const querystring = require('querystring');
const db = require('../Config/config');
const definePLRDBA01 = require('../Models/RDB/PLRDBA01');
const TokenService = require('../Services/tokenServices');
const Encryptor = require('../Services/encryptor');
const { Op, QueryTypes, Sequelize } = require('sequelize');
const { fn, col, literal } = require('sequelize');
const sequelizeRDB = db.getConnection('RDB');
const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const definePLRDBA02 = require('../Models/RDB/PLRDBA02');
const PLRDBA02 = definePLRDBA02(sequelizeRDB);
const definePLRDBPLREL = require('../Models/RDB/PLRDBPLREL'); // Model factory
const PLRDBPLREL = definePLRDBPLREL(sequelizeRDB);
const definePLRDBPYMT = require('../Models/RDB/PLRDBPYMT');
const EP_USERController = require('./EP_USERController');
const defineEP_USER = require('../Models/RDB/EP_USER');
const defineEP_FILE = require('../Models/RDB/EP_FILE');
const ADMIController = require('./ADMIController');
const M81Controller = require('./M81Controller');
const definePermission = require('../Models/IDB/PLSYSM83');

const defineEP_PAYREQ = require('../Models/RDB/EP_PAYREQ');
const QueryService = require('../Services/queryService');
const Company = require('../PlusData/Class/CmpYrCls/Company');
const Year = require('../PlusData/Class/CmpYrCls/Year');
const CmpMaster = require('../PlusData/Class/CmpYrCls/CmpMaster');
const { LangType } = require('../PlusData/commonClass/plusCommon');
const PLRDBPYMT = definePLRDBPYMT(sequelizeRDB);
const EP_USER = defineEP_USER(sequelizeRDB);
const defineUserTypes = require('../Models/RDB/EP_USERTPYES');
// const EP_FILE = require('../Models/RDB/EP_FILE');
const definePLRDBGAO = require('../Models/RDB/PLRDBGAO'); // Model factory

const definePLRDBEXP = require("../Models/RDB/PLRDBEXP");
const PLRDBEXP = definePLRDBEXP(sequelizeRDB);

const EP_FILE = defineEP_FILE(sequelizeRDB, require('sequelize').DataTypes);
const UserTypes = defineUserTypes(sequelizeRDB, require('sequelize').DataTypes);
const EP_PAYREQ = defineEP_PAYREQ(sequelizeRDB, require('sequelize').DataTypes);
const sequelizeIDB = db.getConnection('IDBAPI');
const PLRDBGAO = definePLRDBGAO(sequelizeRDB);

const Permission = definePermission(
    sequelizeIDB,
    require('sequelize').DataTypes
);

const encryptor = new Encryptor();

async function applyLimitLogic(corporateId, payload, transaction) {

    const {
        additionalUser,
        additionalBranch,
        additionalCompany,
        cmpNum,
        custBP,
        custRS,
        usrFld,
        usrMstr
    } = payload;

    /* =========================
       1️⃣ FETCH CORPORATE
    ========================= */
    const corp = await PLRDBA01.findOne({
        where: { A01F03: corporateId },
        transaction
    });

    if (!corp) {
        throw new Error('Corporate not found during approval');
    }

    /* =========================
       2️⃣ UPDATE MAIN LIMITS
    ========================= */
    await PLRDBA01.update({

        A01F10: (corp.A01F10 || 0) + Number(additionalUser || 0),     // Users
        A01BRC: (corp.A01BRC || 0) + Number(additionalBranch || 0),   // Branch
        A01CMP: (corp.A01CMP || 0) + Number(additionalCompany || 0)   // Company

    }, {
        where: { A01F03: corporateId },
        transaction
    });

    /* =========================
       3️⃣ COMPANY-WISE LIMITS (GAO)
    ========================= */
    const hasCompanyData =
        Number(custBP || 0) > 0 ||
        Number(custRS || 0) > 0 ||
        Number(usrFld || 0) > 0 ||
        Number(usrMstr || 0) > 0;

    if (hasCompanyData && cmpNum) {

        const companies = String(cmpNum)
            .split(',')
            .map(c => c.trim())
            .filter(Boolean);

        for (let cmp of companies) {

            const existing = await PLRDBGAO.findOne({
                where: {
                    GAOF01: corporateId,
                    GAOF02: cmp
                },
                transaction
            });

            if (!existing) {

                /* ➕ INSERT NEW */
                await PLRDBGAO.create({
                    GAOF01: corporateId,
                    GAOF02: cmp,
                    GAOF03: Number(custBP || 0),
                    GAOF04: Number(custRS || 0),
                    GAOF05: Number(usrFld || 0),
                    GAOF06: Number(usrMstr || 0)
                }, { transaction });

            } else {

                /* 🔄 UPDATE EXISTING */
                await PLRDBGAO.update({

                    GAOF03: (existing.GAOF03 || 0) + Number(custBP || 0),
                    GAOF04: (existing.GAOF04 || 0) + Number(custRS || 0),
                    GAOF05: (existing.GAOF05 || 0) + Number(usrFld || 0),
                    GAOF06: (existing.GAOF06 || 0) + Number(usrMstr || 0)

                }, {
                    where: {
                        GAOF01: corporateId,
                        GAOF02: cmp
                    },
                    transaction
                });
            }
        }
    }
}
async function applyPlanLogic(corporateId, payload, transaction) {

    const { planId } = payload;

    /* =========================
       1️⃣ FETCH CORPORATE
    ========================= */
    const corp = await PLRDBA01.findOne({
        where: { A01F03: corporateId },
        transaction
    });

    if (!corp) {
        throw new Error('Corporate not found during approval');
    }

    /* =========================
       2️⃣ VALIDATE PLAN
    ========================= */
    const planInfo = await PLRDBA02.findOne({
        where: { A02F01: planId },
        transaction
    });

    if (!planInfo) {
        throw new Error('Plan not found during approval');
    }

    /* =========================
       3️⃣ DATE CALCULATION
    ========================= */
    const today = new Date();

    let baseDate = corp.A01F13 ? new Date(corp.A01F13) : today;

    // If expired → start fresh
    if (!corp.A01F13 || baseDate < today) {
        baseDate = today;
    }

    let newExpiry = null;

    /* =========================
       4️⃣ PLAN RULES
    ========================= */
    if (Number(planId) === 2) {
        baseDate.setDate(baseDate.getDate() + 7);
        newExpiry = baseDate;
    }
    else if (Number(planId) === 6) {
        newExpiry = null; // unlimited
    }
    else if (Number(planId) === 7) {
        baseDate.setFullYear(baseDate.getFullYear() + 1);
        newExpiry = baseDate;
    }
    else {
        baseDate.setFullYear(baseDate.getFullYear() + 1);
        newExpiry = baseDate;
    }

    /* =========================
       5️⃣ UPDATE CORPORATE
    ========================= */
    await PLRDBA01.update({
        A02F01: planId,
        A01F12: today,
        A01F13: newExpiry
    }, {
        where: { A01F03: corporateId },
        transaction
    });
}
async function applyModuleLogic(corporateId, payload, transaction) {

    const {
        moduleId,
        setUpId
    } = payload;

    /* =========================
       1️⃣ FETCH CORPORATE
    ========================= */
    const corp = await PLRDBA01.findOne({
        where: { A01F03: corporateId },
        transaction
    });

    if (!corp) {
        throw new Error('Corporate not found during approval');
    }

    const corpUnq = String(corp.A01F01).trim();

    /* =========================
       2️⃣ BUILD SDB NAME
    ========================= */
    const parts = corporateId.split('-');

    let sdbName =
        parts.length === 3
            ? `${parts[0]}${parts[1]}${parts[2]}SDB`
            : `${parts[0]}${parts[1]}SDB`;

    if (sdbName === 'PLP00001SDB') {
        sdbName = 'A00001SDB';
    }

    const admi = new ADMIController(sdbName);
    const m81 = new M81Controller(sdbName);

    /* =========================
       3️⃣ GET SUPER USER
    ========================= */
    const superUser = await admi.findOne({
        ADMIF06: 2,
        ADMICORP: corpUnq
    });

    if (!superUser) {
        throw new Error('Super user not found');
    }

    /* =========================
       4️⃣ NORMALIZE INPUT
    ========================= */
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

    /* =========================
       5️⃣ MODULE ACTIVATION
    ========================= */
    if (uniqueModules.length > 0) {

        let existingModules = superUser.ADMIMOD
            ? superUser.ADMIMOD.split(',').map(m => m.trim())
            : [];

        const updatedModules = [...new Set([
            ...existingModules,
            ...uniqueModules
        ])];

        await admi.update(
            { ADMIMOD: updatedModules.join(',') },
            { ADMIF00: superUser.ADMIF00 }
        );
    }

    /* =========================
       6️⃣ SETUP ACTIVATION
    ========================= */
    if (uniqueSetups.length > 0) {

        const m81Row = await m81.findOne({
            M81UNQ: superUser.ADMIF00.toString()
        });

        let existingSetups = m81Row?.M81SID
            ? m81Row.M81SID.split(',').map(s => s.trim())
            : [];

        const updatedSetups = [...new Set([
            ...existingSetups,
            ...uniqueSetups
        ])];

        await m81.update(
            { M81SID: updatedSetups.join(',') },
            { M81UNQ: superUser.ADMIF00.toString() }
        );
    }
}
function getPrefix(roleId) {
    switch (Number(roleId)) {
        case 1: return 'ADMIN';
        case 2: return 'CMPUSER';
        case 3: return 'DEALER';
        case 4: return 'RESELLER';
        case 5: return 'Accountant';
        default: return 'UNKNOWN';
    }
}

class AdminDashboardController {

    static async checkRoleAccess(roleId) {
        const roles = await UserTypes.findAll({
            attributes: ['ID'],
            raw: true
        });

        const allowedRoleIds = roles.map(r => Number(r.ID));

        return allowedRoleIds.includes(Number(roleId));
    }
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

            const decoded = await TokenService.validateToken(token);


            // allow all roles
            const roleId = Number(decoded.roleId);

            const isAllowed = await AdminDashboardController.checkRoleAccess(roleId);

            if (!isAllowed) {
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
                    return AdminDashboardController.getAllCorporateUsers1(req, res);

                case 'N':
                    return AdminDashboardController.getAllCorporateUser2(req, res);



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

                case 'S':
                    if (!corporateId || !pa.status) {
                        response.status = 'FAIL';
                        response.message = 'corporateId and status required';
                        return res.status(400).json({
                            encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                        });
                    }

                    return AdminDashboardController.updateCorporateStatus(
                        corporateId,
                        pa.status,
                        req,
                        response,
                        res
                    );

                case 'Q':   // 👈 Pending Requests
                    return AdminDashboardController.getPendingRequests(pa, response, res);

                case 'AP':  // 👈 Approve Request
                    return AdminDashboardController.approveRequest(pa, response, res, decoded);
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
            /* =========================
               🔐 TOKEN
            ========================= */
            const token = req.headers['authorization']?.split(' ')[1];

            if (!token) {
                response.status = 'FAIL';
                response.message = 'Token missing';
                encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                return res.status(401).json({ encryptedResponse });
            }

            const decoded = await TokenService.validateToken(token);
            const roleId = Number(decoded.roleId);

            const isAllowed = await AdminDashboardController.checkRoleAccess(roleId);

            if (!isAllowed) {
                response.status = 'FAIL';
                response.message = 'Access denied';
                return res.status(403).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            /* =========================
               👤 GET USER
            ========================= */

            const userCtrl = new EP_USERController('RDB');
            const users = await userCtrl.findAll({ UTF07: 'N' });

            let user = null;

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
                    user = u;
                    break;
                }
            }

            if (!user) throw new Error('User not found');

            /* =========================
               👤 LOGIN USER
            ========================= */

            const loginUser = {
                id: user.UTF01,
                name: user.UTF02,
                role: Number(user.UTF03),
                phoneNumber: user.UTF09,
                email: user.UTF10,
                dealerCode: user.UTF08,
                commission: user.UTF12
            };

            /* =========================
               🧑‍💼 ibDetail
            ========================= */

            let ibDetail;

            if ([1, 2, 5].includes(roleId)) {
                const allUsers = await userCtrl.findAll({
                    UTF07: 'N',
                    UTF03: [3, 4]
                });

                ibDetail = [
                    {
                        id: user.UTF01,
                        name: user.UTF02,
                        role: roleId
                    },
                    ...allUsers.map(u => ({
                        id: u.UTF01,
                        name: u.UTF02,
                        role: Number(u.UTF03)
                    }))
                ];
            } else {
                ibDetail = [{
                    id: user.UTF01,
                    name: user.UTF02,
                    role: roleId
                }];
            }

            /* =========================
               📊 PLAN INFO + csData
            ========================= */

            let planInfo = await PLRDBA02.findAll({
                where: { A02F13: 1 }
            });

            let oCmp = new Company();
            CmpMaster.oYear = new Year(oCmp);

            let dbconn = db.getConnection('MULTITAX');

            let oDic = await dbconn.query('SELECT * FROM CMPM00', {
                type: QueryTypes.SELECT
            });

            let oEntD = { M00: oDic[0] };

            let oM00 = new CmpMaster('', '', LangType, 'G', oEntD);
            oDic = await oM00.GetDictionary(null, 'MULTITAX', LangType, '0000');

            const csData = oDic["M00"];

            /* =========================
               🔥 ROLE FILTER
            ========================= */

            // let whereCondition = {};

            // if (![1, 2, 5].includes(roleId)) {
            //     whereCondition.A01F19 = user.UTF01;
            // }
            /* =========================
            🔥 PERMISSION FILTER
            ========================= */


            let whereCondition = {};

            // Dashboard menu id
            const MENU_ID = 1;

            const permission = await Permission.findOne({
                where: {
                    M83F02: roleId,
                    M83F08: MENU_ID
                },
                raw: true
            });

            /* =========================
               NO PERMISSION
            ========================= */

            // if (!permission || !permission.M83F06) {

            //     response.status = 'FAIL';
            //     response.message = 'No view permission';

            //     encryptedResponse = encryptor.encrypt(JSON.stringify(response));

            //     return res.status(403).json({ encryptedResponse });
            // }

            /* =========================
               SELF ACCESS
            ========================= */

            const isView = Number(permission?.M83F06) === 1;
            const isAll = Number(permission?.M83F09) === 1;

            /* =========================
               NO ACCESS
            ========================= */

            if (!isView) {

                response.status = 'FAIL';
                response.message = 'No view permission';

                encryptedResponse = encryptor.encrypt(JSON.stringify(response));

                return res.status(403).json({ encryptedResponse });
            }

            /* =========================
               SELF ACCESS
            ========================= */

            if (!isAll) {

                whereCondition.A01F19 = user.UTF01;
            }

            /* =========================
               ALL ACCESS
            ========================= */

            // if isAll = true
            // no filter needed

            /* =========================
               📅 DATE
            ========================= */

            const today = new Date();
            const next7Days = new Date();
            next7Days.setDate(today.getDate() + 7);

            /* =========================
               🏢 CORPORATE STATS
            ========================= */

            const totalCorporates = await PLRDBA01.count({ where: whereCondition });

            const activeCorporates = await PLRDBA01.count({
                where: { ...whereCondition, A01F13: { [Op.gte]: today } }
            });

            const inactiveCorporates = await PLRDBA01.count({
                where: { ...whereCondition, A01F13: { [Op.lt]: today } }
            });

            /* =========================
               📅 SUBSCRIPTIONS
            ========================= */

            const activeSubscriptions = activeCorporates;
            const expiredSubscriptions = inactiveCorporates;

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
                    [Sequelize.fn('COUNT', Sequelize.col('A02F01')), 'totalUsers']
                ],
                where: {
                    ...whereCondition,
                    A02F01: { [Op.in]: [2, 6, 7] },
                    A01F13: { [Op.gte]: today }
                },
                group: ['A02F01']
            });

            const planStats = { trial: 0, default: 0, standard: 0 };

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
                    [Sequelize.literal('CAST(A01F12 AS DATE)'), 'date'],
                    [Sequelize.fn('COUNT', Sequelize.col('A01F12')), 'totalUsers']
                ],
                where: whereCondition,
                group: [Sequelize.literal('CAST(A01F12 AS DATE)')],
                order: [[Sequelize.literal('CAST(A01F12 AS DATE)'), 'ASC']]
            });

            const newUsersGrowth = newUsersDaily.map(row => ({
                date: row.get('date'),
                totalUsers: parseInt(row.get('totalUsers'))
            }));

            /* =========================
               💳 RECENT TXN
            ========================= */

            let txnWhere = {};

            if (!isAll) {

                const corporates = await PLRDBA01.findAll({
                    attributes: ['A01F03'],
                    where: whereCondition
                });

                txnWhere.PYMT01 = {
                    [Op.in]: corporates.map(c => c.A01F03?.trim())
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
                    [Sequelize.fn('SUM', Sequelize.col('PYMT05')), 'weeklyRevenue']
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

            let allExp = await PLRDBEXP.findAll({
                where: {
                    EXPF05: 'Y'
                }
            });

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
                weeklyRevenue,

                userContext: {
                    planInfo,
                    csData,
                    ibDetail,
                    loginUser
                },

                ExpanseData: allExp
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

            const decoded = await TokenService.validateToken(token);
            const roleId = Number(decoded.roleId);

            // if (![1, 2, 3, 5].includes(roleId)) {
            //     response.status = 'FAIL';
            //     response.message = 'Access denied';
            //     return res.status(403).json({
            //         encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            //     });
            // }
            const isAllowed = await AdminDashboardController.checkRoleAccess(roleId);

            if (!isAllowed) {
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
            /* ------------------------------
  * 3. PERMISSION-BASED FILTER
  * ---------------------------- */

            let whereCondition = {};

            // 🔥 MENU ID
            const MENU_ID = 2;

            // 🔥 FIND LOGGED USER
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

            /* ------------------------------
             * FETCH PERMISSION
             * ---------------------------- */

            const permission = await Permission.findOne({
                where: {
                    M83F02: roleId,
                    M83F08: MENU_ID
                },
                raw: true
            });

            const isView = Number(permission?.M83F06) === 1;
            const isAll = Number(permission?.M83F09) === 1;

            /* ------------------------------
             * NO VIEW ACCESS
             * ---------------------------- */

            if (!isView) {

                response.status = 'FAIL';
                response.message = 'No view permission';

                encryptedResponse = encryptor.encrypt(JSON.stringify(response));

                return res.status(403).json({ encryptedResponse });
            }

            /* ------------------------------
             * SELF ACCESS
             * ---------------------------- */

            if (!isAll) {

                whereCondition.A01F19 = loggedUser.UTF01;
            }

            /* ------------------------------
             * ALL ACCESS
             * ---------------------------- */

            // if isAll = true
            // no filter needed

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
                    'A01F19',
                    'A02F01',
                    'A01F20'
                ],
                where: whereCondition,
                order: [['A01F03', 'ASC']]
            });
            // ✅ Extract corporateIds
            const corporateIds = corporates.map(c => c.A01F03);

            // ✅ Get pending counts ONLY for these corporates
            const pendingCounts = await EP_PAYREQ.findAll({
                attributes: [
                    'PRQF01',
                    [Sequelize.fn('COUNT', Sequelize.col('PRQF01')), 'total']
                ],
                where: {
                    PRQF07: 'P',
                    PRQF01: {
                        [Op.in]: corporateIds
                    }
                },
                group: ['PRQF01'],
                raw: true
            });

            // ✅ Convert to map
            const pendingMap = {};
            for (let row of pendingCounts) {
                pendingMap[row.PRQF01?.trim().toUpperCase()] = parseInt(row.total);
            }

            const files = await EP_FILE.findAll({
                attributes: ['FILE02', 'FILE03', 'FILE09', 'FILE06'],
                raw: true
            });

            const fileMap = {};

            const normalize = (val) => val?.trim().toUpperCase();

            for (let f of files) {
                const key = normalize(f.FILE09);

                fileMap[key] = {
                    fileName: f.FILE02,
                    base64: f.FILE03,
                    description: f.FILE06,
                };
            }
            // const corporateKey = normalize(row.A01F03);
            /* ------------------------------
             * 5. MAP RESPONSE (🔥 FINAL LOGIC)
             * ---------------------------- */
            response.data = corporates.map(row => {

                const ownerId = row.A01F19;
                const ownerDetails = userMap[ownerId] || {};
                const corporateKey = normalize(row.A01F03);

                return {
                    corpUnq: row.A01F01?.trim() || null,
                    corporateId: row.A01F03?.trim() || null,
                    companyName: row.A01F02?.trim() || null,
                    status: row.A01F20 === 'P' ? 'P' : 'A',
                    planId: row.A02F01,
                    subscription: {
                        startDate: row.A01F12,
                        endDate: row.A01F13
                    },
                    licensedUsers: row.A01F10 || 0,

                    // ✅ Instead of exposing A01F19
                    ownerRole: ownerDetails.role || null,
                    ownerName: ownerDetails.name || null,
                    file: fileMap[corporateKey] || null,
                    pendingRequests: pendingMap[row.A01F03?.trim().toUpperCase()] || 0
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
    static async getAllCorporateUsers1(req, res) {
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

            const decoded = await TokenService.validateToken(token);
            const roleId = Number(decoded.roleId);

            // if (![1, 2, 3, 5].includes(roleId)) {
            //     response.status = 'FAIL';
            //     response.message = 'Access denied';
            //     return res.status(403).json({
            //         encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            //     });
            // }
            const isAllowed = await AdminDashboardController.checkRoleAccess(roleId);

            if (!isAllowed) {
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
            /* ------------------------------
  * 3. PERMISSION-BASED FILTER
  * ---------------------------- */

            let whereCondition = {};

            // 🔥 MENU ID
            const MENU_ID = 4;

            // 🔥 FIND LOGGED USER
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

            /* ------------------------------
             * FETCH PERMISSION
             * ---------------------------- */

            const permission = await Permission.findOne({
                where: {
                    M83F02: roleId,
                    M83F08: MENU_ID
                },
                raw: true
            });

            const isView = Number(permission?.M83F06) === 1;
            const isAll = Number(permission?.M83F09) === 1;

            /* ------------------------------
             * NO VIEW ACCESS
             * ---------------------------- */

            if (!isView) {

                response.status = 'FAIL';
                response.message = 'No view permission';

                encryptedResponse = encryptor.encrypt(JSON.stringify(response));

                return res.status(403).json({ encryptedResponse });
            }

            /* ------------------------------
             * SELF ACCESS
             * ---------------------------- */

            if (!isAll) {

                whereCondition.A01F19 = loggedUser.UTF01;
            }

            /* ------------------------------
             * ALL ACCESS
             * ---------------------------- */

            // if isAll = true
            // no filter needed

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
                    'A01F19',
                    'A02F01',
                    'A01F20'
                ],
                where: whereCondition,
                order: [['A01F03', 'ASC']]
            });
            // ✅ Extract corporateIds
            const corporateIds = corporates.map(c => c.A01F03);

            // ✅ Get pending counts ONLY for these corporates
            const pendingCounts = await EP_PAYREQ.findAll({
                attributes: [
                    'PRQF01',
                    [Sequelize.fn('COUNT', Sequelize.col('PRQF01')), 'total']
                ],
                where: {
                    PRQF07: 'P',
                    PRQF01: {
                        [Op.in]: corporateIds
                    }
                },
                group: ['PRQF01'],
                raw: true
            });

            // ✅ Convert to map
            const pendingMap = {};
            for (let row of pendingCounts) {
                pendingMap[row.PRQF01?.trim().toUpperCase()] = parseInt(row.total);
            }

            const files = await EP_FILE.findAll({
                attributes: ['FILE02', 'FILE03', 'FILE09', 'FILE06'],
                raw: true
            });

            const fileMap = {};

            const normalize = (val) => val?.trim().toUpperCase();

            for (let f of files) {
                const key = normalize(f.FILE09);

                fileMap[key] = {
                    fileName: f.FILE02,
                    base64: f.FILE03,
                    description: f.FILE06,
                };
            }
            // const corporateKey = normalize(row.A01F03);
            /* ------------------------------
             * 5. MAP RESPONSE (🔥 FINAL LOGIC)
             * ---------------------------- */
            response.data = corporates.map(row => {

                const ownerId = row.A01F19;
                const ownerDetails = userMap[ownerId] || {};
                const corporateKey = normalize(row.A01F03);

                return {
                    corpUnq: row.A01F01?.trim() || null,
                    corporateId: row.A01F03?.trim() || null,
                    companyName: row.A01F02?.trim() || null,
                    status: row.A01F20 === 'P' ? 'P' : 'A',
                    planId: row.A02F01,
                    subscription: {
                        startDate: row.A01F12,
                        endDate: row.A01F13
                    },
                    licensedUsers: row.A01F10 || 0,

                    // ✅ Instead of exposing A01F19
                    ownerRole: ownerDetails.role || null,
                    ownerName: ownerDetails.name || null,
                    file: fileMap[corporateKey] || null,
                    pendingRequests: pendingMap[row.A01F03?.trim().toUpperCase()] || 0
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
    static async getAllCorporateUser2(req, res) {
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

            const decoded = await TokenService.validateToken(token);
            const roleId = Number(decoded.roleId);

            // if (![1, 2, 3, 5].includes(roleId)) {
            //     response.status = 'FAIL';
            //     response.message = 'Access denied';
            //     return res.status(403).json({
            //         encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            //     });
            // }
            const isAllowed = await AdminDashboardController.checkRoleAccess(roleId);

            if (!isAllowed) {
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
            /* ------------------------------
  * 3. PERMISSION-BASED FILTER
  * ---------------------------- */

            let whereCondition = {};

            // 🔥 MENU ID
            const MENU_ID = 5;

            // 🔥 FIND LOGGED USER
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

            /* ------------------------------
             * FETCH PERMISSION
             * ---------------------------- */

            const permission = await Permission.findOne({
                where: {
                    M83F02: roleId,
                    M83F08: MENU_ID
                },
                raw: true
            });

            const isView = Number(permission?.M83F06) === 1;
            const isAll = Number(permission?.M83F09) === 1;

            /* ------------------------------
             * NO VIEW ACCESS
             * ---------------------------- */

            if (!isView) {

                response.status = 'FAIL';
                response.message = 'No view permission';

                encryptedResponse = encryptor.encrypt(JSON.stringify(response));

                return res.status(403).json({ encryptedResponse });
            }

            /* ------------------------------
             * SELF ACCESS
             * ---------------------------- */

            if (!isAll) {

                whereCondition.A01F19 = loggedUser.UTF01;
            }

            /* ------------------------------
             * ALL ACCESS
             * ---------------------------- */

            // if isAll = true
            // no filter needed

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
                    'A01F19',
                    'A02F01',
                    'A01F20'
                ],
                where: whereCondition,
                order: [['A01F03', 'ASC']]
            });
            // ✅ Extract corporateIds
            const corporateIds = corporates.map(c => c.A01F03);

            // ✅ Get pending counts ONLY for these corporates
            const pendingCounts = await EP_PAYREQ.findAll({
                attributes: [
                    'PRQF01',
                    [Sequelize.fn('COUNT', Sequelize.col('PRQF01')), 'total']
                ],
                where: {
                    PRQF07: 'P',
                    PRQF01: {
                        [Op.in]: corporateIds
                    }
                },
                group: ['PRQF01'],
                raw: true
            });

            // ✅ Convert to map
            const pendingMap = {};
            for (let row of pendingCounts) {
                pendingMap[row.PRQF01?.trim().toUpperCase()] = parseInt(row.total);
            }

            const files = await EP_FILE.findAll({
                attributes: ['FILE02', 'FILE03', 'FILE09', 'FILE06'],
                raw: true
            });

            const fileMap = {};

            const normalize = (val) => val?.trim().toUpperCase();

            for (let f of files) {
                const key = normalize(f.FILE09);

                fileMap[key] = {
                    fileName: f.FILE02,
                    base64: f.FILE03,
                    description: f.FILE06,
                };
            }
            // const corporateKey = normalize(row.A01F03);
            /* ------------------------------
             * 5. MAP RESPONSE (🔥 FINAL LOGIC)
             * ---------------------------- */
            response.data = corporates.map(row => {

                const ownerId = row.A01F19;
                const ownerDetails = userMap[ownerId] || {};
                const corporateKey = normalize(row.A01F03);

                return {
                    corpUnq: row.A01F01?.trim() || null,
                    corporateId: row.A01F03?.trim() || null,
                    companyName: row.A01F02?.trim() || null,
                    status: row.A01F20 === 'P' ? 'P' : 'A',
                    planId: row.A02F01,
                    subscription: {
                        startDate: row.A01F12,
                        endDate: row.A01F13
                    },
                    licensedUsers: row.A01F10 || 0,

                    // ✅ Instead of exposing A01F19
                    ownerRole: ownerDetails.role || null,
                    ownerName: ownerDetails.name || null,
                    file: fileMap[corporateKey] || null,
                    pendingRequests: pendingMap[row.A01F03?.trim().toUpperCase()] || 0
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
                attributes: ['A01F01', 'A01F02', 'A01F12', 'A01F13']
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
            console.log("Corp Data:", corp.toJSON());
            response.data = {
                corporateId: corpId,
                companyName: corp.A01F02?.trim(),


                totalBranches,
                totalCompanies,
                subscription: {
                    startDate: corp.A01F12,
                    endDate: corp.A01F13
                },
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
                attributes: ['A01F01', 'A01F02', 'A01F12', 'A01F13']
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
                subscription: { startDate: corp.A01F12, endDate: corp.A01F13 },

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

    static async updateCorporateStatus(req, res) {
        let response = { status: 'SUCCESS', message: '', data: null };

        try {
            /* =========================
               🔐 TOKEN
            ========================= */
            const token = req.headers['authorization']?.split(' ')[1];

            if (!token) {
                response.status = 'FAIL';
                response.message = 'Token missing';
                return res.status(401).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            const decoded = await TokenService.validateToken(token);

            /* =========================
               🔓 DECRYPT PA
            ========================= */
            const encryptedPa = req.body.pa;

            if (!encryptedPa) {
                response.status = 'FAIL';
                response.message = 'pa is required';
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            const decrypted = encryptor.decrypt(encryptedPa);
            const pa = querystring.parse(decodeURIComponent(decrypted));

            const corporateId = pa.corporateId;
            const status = pa.status;
            const paymentDescription = pa.paymentDescription;
            const paymentSource = pa.paymentSource || 'SC';   //status change

            /* =========================
               ✅ VALIDATION
            ========================= */
            if (!corporateId || !status) {
                response.status = 'FAIL';
                response.message = 'corporateId and status required';
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            if (!['A', 'R'].includes(status)) {
                response.status = 'FAIL';
                response.message = 'Invalid status';
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            // if (!req.file && !paymentDescription) {
            //     response.status = 'FAIL';
            //     response.message = 'Either file or description required';
            //     return res.status(400).json({
            //         encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            //     });
            // }

            /* =========================
               🔄 UPDATE CORPORATE
            ========================= */
            const updated = await PLRDBA01.update(
                { A01F20: status },
                { where: { A01F03: corporateId } }
            );

            if (!updated || updated[0] === 0) {
                response.status = 'FAIL';
                response.message = 'Corporate not found or not updated';
                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            /* =========================
               📄 FILE HANDLING
            ========================= */
            let fileName = null;
            let base64 = null;

            if (req.file) {
                const mime = req.file.mimetype;

                if (!mime.includes('pdf') && !mime.includes('image')) {
                    throw new Error('Only PDF or Image allowed');
                }

                if (req.file.size > 2 * 1024 * 1024) {
                    throw new Error('File size exceeds 2MB');
                }

                fileName = req.file.originalname;
                base64 = req.file.buffer.toString('base64');
            }

            /* =========================
               👤 USER FETCH
            ========================= */
            let userRecord = await EP_USER.findOne({
                where: {
                    UTF04: decoded.userId,
                    UTF07: 'N'
                }
            });

            if (!userRecord) {
                throw new Error('User not found');
            }

            /* =========================
               💾 SAVE EP_FILE
            ========================= */
            await EP_FILE.create({
                FILE02: fileName,
                FILE03: base64,
                FILE04: userRecord.UTF01,
                FILE06: paymentDescription || null,
                FILE07: paymentSource,
                // FILE08: corporateId   // optional but recommended
            });

            /* =========================
               ✅ RESPONSE
            ========================= */
            response.status = 'SUCCESS';
            response.message =
                status === 'A'
                    ? 'Corporate Activated Successfully'
                    : 'Corporate Rejected';

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {
            console.error(err);

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: 'Status update failed'
                }))
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

    // static async previewCorporateDeletion(corporateId, response, res) {

    //     try {

    //         const corpId = corporateId.trim().toUpperCase();

    //         // 1️⃣ Validate corporate
    //         const corp = await PLRDBA01.findOne({
    //             where: { A01F03: corpId },
    //             attributes: ['A01F01']
    //         });

    //         if (!corp) {
    //             response.status = 'FAIL';
    //             response.message = 'Corporate not found';
    //             return res.status(404).json({
    //                 encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //             });
    //         }

    //         /* =========================
    //            2️⃣ Extract numeric part
    //         ========================== */

    //         const numberPart = corpId.split('-')[1];  // 00086

    //         /* =========================
    //            3️⃣ Build SDB
    //         ========================== */

    //         const sdbName = `EP${numberPart}SDB`;

    //         const sdb = db.getConnection(sdbName);

    //         /* =========================
    //            4️⃣ Get companies from SDB
    //         ========================== */

    //         const companies = await sdb.query(`
    //         SELECT CMPF01
    //         FROM PLSDBCMP
    //     `, {
    //             type: require('sequelize').QueryTypes.SELECT
    //         });

    //         /* =========================
    //            5️⃣ Build CMP DB names
    //         ========================== */

    //         const cmpDatabases = companies.map(c =>
    //             // `A${numberPart}CMP${c.CMPF01}`
    //             `A${numberPart}CMP${String(c.CMPF01).padStart(4, '0')}`
    //         );

    //         response.data = {
    //             corporateId: corpId,
    //             sdbDatabase: sdbName,
    //             cmpDatabases
    //         };

    //         return res.status(200).json({
    //             encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //         });

    //     } catch (err) {

    //         console.error(err);

    //         response.status = 'FAIL';
    //         response.message = 'Preview failed';

    //         return res.status(500).json({
    //             encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //         });
    //     }
    // }
    static async previewCorporateDeletion(corporateId, response, res) {

        try {

            const corpId = corporateId.trim().toUpperCase();

            /* =========================
               1️⃣ VALIDATE CORPORATE
            ========================= */
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
               2️⃣ FIND SDB (LIKE ADMI)
            ========================= */

            let sdbSeq = corpId.split('-');

            let sdbName =
                sdbSeq.length === 3
                    ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB'
                    : sdbSeq[0] + sdbSeq[1] + 'SDB';

            // same special handling as ADMIController
            if (sdbName === 'PLP00001SDB') {
                sdbName = 'A00001SDB';
            }

            const sdb = db.getConnection(sdbName);

            /* =========================
               3️⃣ GET COMPANIES FROM SDB
            ========================= */
            const companies = await sdb.query(`
            SELECT CMPF01
            FROM PLSDBCMP
        `, {
                type: require('sequelize').QueryTypes.SELECT
            });

            /* =========================
               4️⃣ GENERATE CMP DBs (USING YOUR SERVICE)
            ========================= */
            const cmpDatabases = companies.map(c =>
                QueryService.generateDatabaseName(corpId, c.CMPF01)
            );

            /* =========================
               5️⃣ RESPONSE
            ========================= */
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
    static async deleteCorporateCompletely(req, res) {
        let response = { status: 'SUCCESS', message: '', data: null };

        const sequelizeMASTER = db.getConnection('MASTER'); // for DROP
        const sequelizeRDB = db.getConnection('RDB');       // for PLRDBA01

        try {
            /* =========================
               🔐 TOKEN (optional but recommended)
            ========================= */
            const token = req.headers['authorization']?.split(' ')[1];
            if (!token) {
                throw new Error('Token missing');
            }

            const decoded = await TokenService.validateToken(token);

            /* =========================
               🔓 INPUT
            ========================= */
            const corporateId = req.body.corporateId?.trim().toUpperCase();

            if (!corporateId) {
                throw new Error('corporateId required');
            }

            /* =========================
               1️⃣ VALIDATE CORPORATE
            ========================= */
            const corp = await PLRDBA01.findOne({
                where: { A01F03: corporateId }
            });

            if (!corp) {
                throw new Error('Corporate not found');
            }

            /* =========================
               2️⃣ FIND SDB (ADMI STYLE)
            ========================= */
            let sdbSeq = corporateId.split('-');

            let sdbName =
                sdbSeq.length === 3
                    ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB'
                    : sdbSeq[0] + sdbSeq[1] + 'SDB';

            if (sdbName === 'PLP00001SDB') {
                sdbName = 'A00001SDB';
            }

            /* =========================
               3️⃣ GET CMP DATABASES
            ========================= */
            let cmpDatabases = [];

            try {
                const sdb = db.getConnection(sdbName);

                const companies = await sdb.query(`
                SELECT CMPF01 FROM PLSDBCMP
            `, {
                    type: require('sequelize').QueryTypes.SELECT
                });

                cmpDatabases = companies.map(c =>
                    QueryService.generateDatabaseName(corporateId, c.CMPF01)
                );

            } catch (err) {
                console.warn('SDB not found or already deleted:', sdbName);
            }

            /* =========================
               4️⃣ DROP CMP DATABASES
            ========================= */
            for (let dbName of cmpDatabases) {

                if (!/^[A-Z0-9]+$/.test(dbName)) continue; // safety

                try {
                    await sequelizeMASTER.query(`
                    IF EXISTS (SELECT name FROM sys.databases WHERE name = '${dbName}')
                    DROP DATABASE [${dbName}]
                `);
                    console.log(`Dropped CMP DB: ${dbName}`);
                } catch (err) {
                    console.error(`Failed to drop CMP DB ${dbName}:`, err.message);
                }
            }

            /* =========================
               5️⃣ DROP SDB
            ========================= */
            if (/^[A-Z0-9]+$/.test(sdbName)) {
                try {
                    await sequelizeMASTER.query(`
                    IF EXISTS (SELECT name FROM sys.databases WHERE name = '${sdbName}')
                    DROP DATABASE [${sdbName}]
                `);
                    console.log(`Dropped SDB: ${sdbName}`);
                } catch (err) {
                    console.error(`Failed to drop SDB ${sdbName}:`, err.message);
                }
            }

            /* =========================
               5.5️⃣ UPDATE DBSER_INFO (SERVER USAGE)
            ========================= */

            try {

                const ip = corp.A01F52; // ✅ THIS IS YOUR MATCHING FIELD

                console.log("SERVER DEBUG:", {
                    ip
                });

                if (ip) {

                    await sequelizeRDB.query(`
            UPDATE DBSER_INFO
            SET INFO_10 = CASE 
                WHEN INFO_10 > 0 THEN INFO_10 - 1 
                ELSE 0 
            END
            WHERE INFO_02 = :ip
        `, {
                        replacements: { ip },
                        type: Sequelize.QueryTypes.UPDATE
                    });

                    console.log(`Updated DBSER_INFO for IP: ${ip}`);
                }

            } catch (err) {
                console.error('Failed to update DBSER_INFO:', err.message);
            }
            /* =========================
            5.6️⃣ DELETE PLRDBGAO (IMPORTANT)
            ========================= */
            try {

                const deletedRows = await PLRDBGAO.destroy({
                    where: { GAOF01: corporateId }
                });

                // console.log(`Deleted ${deletedRows} rows from PLRDBGAO`);
                if (deletedRows === 0) {
                    console.warn('No GAO records found for this corporate');
                } else {
                    console.log(`Deleted ${deletedRows} rows from PLRDBGAO`);
                }

            } catch (err) {
                console.error('Failed to delete PLRDBGAO rows:', err.message);
            }



            /* =========================
               6️⃣ DELETE FROM RDB
            ========================= */
            await PLRDBA01.destroy({
                where: { A01F03: corporateId }
            });

            /* =========================
               ✅ RESPONSE
            ========================= */
            response.status = "SUCCESS"
            response.message = 'Corporate and all databases deleted successfully';

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {
            console.error(err);

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: err.message || 'Delete failed'
                }))
            });
        }
    }

    //show pending request of corporate
    static async getPendingRequests(pa, response, res) {
        try {

            let response = { status: 'SUCCESS', message: '', data: null };

            const { corporateId, page = 1, limit = 10 } = pa;

            const safeParse = (val) => {
                try {
                    if (!val) return {};
                    if (typeof val === 'object') return val;
                    return JSON.parse(val);
                } catch {
                    return {};
                }
            };

            /* =========================
               🔍 WHERE FILTER
            ========================= */
            const whereClause = {
                PRQF07: 'P'
            };

            if (corporateId) {
                whereClause.PRQF01 = corporateId;
            }

            /* =========================
               📄 PAGINATION CALC
            ========================= */
            const offset = (page - 1) * limit;

            /* =========================
               📦 FETCH REQUESTS
            ========================= */
            const { rows: requests, count } = await EP_PAYREQ.findAndCountAll({
                where: whereClause,
                order: [['PRQF00', 'DESC']],
                offset,
                limit,
                raw: true
            });

            /* =========================
               📁 FETCH FILES (OPTIMIZED)
            ========================= */
            const requestIds = requests.map(r => r.PRQF00);

            let fileMap = {};

            if (requestIds.length > 0) {
                const files = await EP_FILE.findAll({
                    where: {
                        FILE08: requestIds
                    },
                    raw: true
                });

                for (let f of files) {
                    if (f.FILE08) {
                        fileMap[f.FILE08] = f;
                    }
                }
            }

            /* =========================
               📤 RESPONSE BUILD
            ========================= */
            response.data = requests.map(r => ({
                requestId: r.PRQF00,
                corporateId: r.PRQF01,
                type: r.PRQF02,
                amount: r.PRQF05,
                description: r.PRQF06,
                status: r.PRQF07,

                payload: safeParse(r.PRQF03),
                payment: safeParse(r.PRQF04),

                file: fileMap[r.PRQF00]
                    ? {
                        fileName: fileMap[r.PRQF00].FILE02,
                        base64: fileMap[r.PRQF00].FILE03
                    }
                    : null
            }));

            /* =========================
               📊 META (IMPORTANT)
            ========================= */
            response.meta = {
                total: count,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(count / limit)
            };

            response.status = 'SUCCESS';
            response.message = requests.length
                ? 'Pending requests fetched'
                : 'No pending requests found';

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            console.error('getPendingRequests error:', err);

            response.status = 'FAIL';
            response.message = err.message;

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }

    //approve payment request of corporate
    static async approveRequest(pa, response, res, decoded) {

        const { requestId, decision } = pa;

        const transaction = await sequelizeRDB.transaction();

        try {

            /* =========================
               0️⃣ VALIDATE INPUT
            ========================= */
            if (!['A', 'R'].includes(decision)) {
                throw new Error('Invalid decision');
            }

            /* =========================
               1️⃣ FETCH REQUEST
            ========================= */
            const reqRow = await EP_PAYREQ.findOne({
                where: { PRQF00: requestId },
                transaction
            });

            if (!reqRow) throw new Error('Request not found');

            if (reqRow.PRQF07 !== 'P') {
                throw new Error('Request already processed');
            }

            /* =========================
               2️⃣ GET ACCOUNTANT USER
            ========================= */
            const userRecord = await EP_USER.findOne({
                where: {
                    UTF04: decoded.userId,
                    UTF07: 'N'
                },
                transaction
            });

            if (!userRecord) throw new Error('User not found');

            const approverId = userRecord.UTF01;

            /* =========================
               3️⃣ HANDLE REJECT
            ========================= */
            if (decision === 'R') {

                await EP_PAYREQ.update({
                    PRQF07: 'R',
                    PRQF09: approverId,
                    // PRQF11: new Date().toISOString().slice(0, 23).replace('T', ' ')
                    // PRQF11: new Date()
                    PRQF11: Sequelize.literal('GETDATE()')
                }, {
                    where: { PRQF00: requestId },
                    transaction
                });

                await transaction.commit();

                response.status = 'SUCCESS';
                response.message = 'Request rejected';

                return res.status(200).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            /* =========================
               4️⃣ PARSE DATA (SAFE)
            ========================= */
            const type = reqRow.PRQF02;
            const corporateId = reqRow.PRQF01;

            function safeParse(json) {
                try {
                    return typeof json === 'string' ? JSON.parse(json) : json;
                } catch (e) {
                    return {};
                }
            }
            const payload = safeParse(reqRow.PRQF03);
            // const payment = safeParse(reqRow.PRQF04);
            const payment = safeParse(reqRow.PRQF04) || {};

            /* =========================
               5️⃣ APPLY LOGIC
            ========================= */

            if (type === 'PLAN') {
                await applyPlanLogic(corporateId, payload, transaction);
            }
            else if (type === 'LIMIT') {
                await applyLimitLogic(corporateId, payload, transaction);
            }
            else if (type === 'MODULE') {
                await applyModuleLogic(corporateId, payload, transaction);
            }
            else {
                throw new Error('Invalid request type');
            }

            /* =========================
               6️⃣ INSERT PAYMENT
            ========================= */
            const prefix = getPrefix(decoded.roleId);

            await PLRDBPYMT.create({
                PYMT01: corporateId,
                PYMT02: 0,
                PYMT03: payment.referenceNo || (`${prefix}_${Date.now()}`),
                PYMT04: 'OFFLINE',
                // PYMT05: payment.amount || 0,
                PYMT05: parseFloat(reqRow.PRQF05 || payment.amount || 0),
                PYMT06: 'SUCCESS',
                PYMT07: payment.paymentMethod || 'CASH',
                PYMT09: reqRow.PRQF06,
                PYMT10: null
            }, { transaction });

            /* =========================
               7️⃣ MARK APPROVED
            ========================= */
            await EP_PAYREQ.update({
                PRQF07: 'A',
                PRQF09: approverId,
                PRQF11: Sequelize.literal('GETDATE()')
                // PRQF11: new Date()
            }, {
                where: { PRQF00: requestId },
                transaction
            });

            await transaction.commit();

            response.status = 'SUCCESS';
            response.message = 'Request approved successfully';

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            console.error('approveRequest error:', err);

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




}

module.exports = AdminDashboardController;