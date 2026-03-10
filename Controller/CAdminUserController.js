const querystring = require('querystring');
const db = require('../Config/config');
const Encryptor = require('../Services/encryptor');
const TokenService = require('../Services/tokenServices');
const { Op } = require('sequelize');
const definePLRDBA01 = require('../Models/RDB/PLRDBA01');
const sequelizeRDB = db.getConnection('RDB');

const PLRDBA01 = definePLRDBA01(sequelizeRDB);

const ADMIController = require('./ADMIController');
const M81Controller = require('./M81Controller');
const CROLEController = require('./CROLOEController');
const queryService = require('../Services/queryService');

const encryptor = new Encryptor();

class CAdminUserController {

    /* ===================================================== */
    /* MAIN ENTRY                                            */
    /* ===================================================== */
    static async manageUser(req, res) {

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

            /* 🔓 DECRYPT PARAM */
            if (!req.query.pa) {
                response.status = 'FAIL';
                response.message = 'Encrypted parameter missing';
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            const decrypted = encryptor.decrypt(req.query.pa);
            const pa = querystring.parse(decodeURIComponent(decrypted));

            const { action, corporateId } = pa;

            if (!corporateId) {
                response.status = 'FAIL';
                response.message = 'corporateId is required';
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            const sdbName = CAdminUserController.getSDBName(corporateId);

            switch (action) {

                case 'A':
                    return CAdminUserController.createUser(pa, sdbName, corporateId, res);

                case 'U':
                    return CAdminUserController.updateUser(pa, sdbName, res);

                case 'D':
                    return CAdminUserController.deleteUser(pa, sdbName, res);
                // return CAdminUserController.deleteUser(pa, sdbName, decoded, res);

                case 'G':
                    return CAdminUserController.getAllUsers(sdbName, res);

                case 'S':
                    return CAdminUserController.toggleStatus(pa, sdbName, res);

                case 'L':
                    return CAdminUserController.getCurrentLimits(
                        corporateId,
                        sdbName,
                        res
                    );

                case 'R':
                    return CAdminUserController.getCustomRoles(
                        corporateId,
                        sdbName,
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

            console.error('manageUser error:', err);

            response.status = 'FAIL';
            response.message = 'Server error';

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }

    /* ===================================================== */
    /* CREATE USER                                           */
    /* ===================================================== */
    static async createUser(pa, sdbName, corpId, res) {

        let response = { status: 'SUCCESS', message: '', data: null };

        const {
            userId,
            firstName,
            lastName,
            password,
            roleId,
            email,
            CmpList,
            BrcList,
            cusRole,
            dob,
            gender
        } = pa;

        const sequelize = db.getConnection(sdbName);
        const transaction = await sequelize.transaction();

        try {

            /* ==============================
               1️⃣ Basic Validation
            ============================== */

            if (!userId || !firstName || !password) {
                throw new Error('Required fields missing');
            }

            const admi = new ADMIController(sdbName);
            const m81 = new M81Controller(sdbName);

            /* ==============================
               2️⃣ Corporate Validation
            ============================== */

            const corp = await PLRDBA01.findOne({
                where: { A01F03: corpId }
            });

            if (!corp)
                throw new Error('Corporate not found');

            /* ==============================
               3️⃣ Duplicate User Check
            ============================== */

            const allUsers = await admi.findAll(
                { ADMICORP: corp.A01F01 },
                [],
                null,
                transaction
            );

            for (let u of allUsers) {
                if (encryptor.decrypt(u.ADMIF01) === userId) {
                    throw new Error('User already exists');
                }
            }

            /* ==============================
               4️⃣ License Check (ACTIVE USERS ONLY)
            ============================== */

            const activeUserCount = await admi.count(
                {
                    ADMICORP: corp.A01F01,
                    ADMIF08: 1
                },
                transaction
            );

            const userLimit = Number(corp.A01F10 || 0);

            if (userLimit > 0 && activeUserCount >= userLimit) {
                throw new Error(
                    `User limit exceeded. Plan allows only ${userLimit} active users.`
                );
            }

            /* ==============================
               5️⃣ Create ADMI Record
            ============================== */

            /* ==============================
   5️⃣ Create ADMI Record
============================== */

            const encryptedUserId = encryptor.encrypt(userId);
            const encryptedPassword = encryptor.encrypt(password);

            const newUser = await admi.create(
                encryptedUserId,                  // ADMIF01
                firstName,                        // ADMIF02
                '',                               // ADMIF03 (middle name)
                lastName,                         // ADMIF04
                encryptedPassword,                // ADMIF05
                // roleId,      
                3,                   // ADMIF06
                email,                            // ADMIF07
                dob || null,                      // ADMIF09
                gender || null,                   // ADMIF10
                '',                               // ADMIF12 address
                '',                               // ADMIF13 phone
                '',                               // ADMIF14 image
                BrcList || '',                    // ADMIBRC
                CmpList || '',                    // ADMICOMP
                '',                               // ADMIMOD
                cusRole || '',                    // ADMIROL
                corp.A01F01                       // ADMICORP
            );
            // Generate next system user code
            let lastUser = await m81.findOne(
                {
                    M81F01: {
                        [Op.like]: 'U%'
                    }
                },
                [['M81F01', 'DESC']],
                ['M81F01']
            );

            let systemUserCode = 'U0000000';

            if (lastUser && lastUser.M81F01) {

                const lastCode = lastUser.M81F01;

                const number = parseInt(lastCode.substring(1), 10);

                const nextNumber = number + 1;

                systemUserCode = 'U' + nextNumber.toString().padStart(7, '0');
            }
            /* ==============================
               6️⃣ Create M81 Record
            ============================== */
            // await m81.create(
            //     'U',                                  // M81F00
            //     systemUserCode,                               // M81F01
            //     firstName + ' ' + lastName,            // M81F02
            //     userId,                               // M81F03
            //     password,
            //     systemUserCode,                           // M81F04
            //     userId,                               // M81F05
            //     // roleId == 3 ? 'Admin' : 'User',   
            //     'User',                                // M81F06
            //     '',                                    // M81F07
            //     email,                                 // M81F08
            //     '',                                    // M81IMG
            //     'U',                                   // M81RTY
            //     'A',                                   // M81ADA
            //     '',                                    // M81CHLD  (⚠ required)
            //     newUser.ADMIF00,                       // M81UNQ   (⚠ required)
            //     ''                                     // M81SID
            // );
            await m81.create(
                'U',                               // M81F00
                systemUserCode,                    // M81F01  ✅
                firstName + ' ' + lastName,        // M81F02
                userId,                            // M81F03  (login id)
                password,                          // M81F04
                systemUserCode,                    // M81F05  (system code again)
                'User',                            // M81F06
                '',                                 // M81F07
                email,                             // M81F08
                '',                                 // M81IMG
                'U',                                // M81RTY
                'A',                                // M81ADA
                '',                                 // M81CHLD
                newUser.ADMIF00,                   // M81UNQ
                ''                                  // M81SID
            );

            /* ==============================
               7️⃣ Commit
            ============================== */

            await transaction.commit();
            response.status = 'SUCCESS';
            response.message = 'User created successfully';

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            await transaction.rollback();

            response.status = 'FAIL';
            response.message = err.message;

            return res.status(400).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }
    /* ===================================================== */
    /* UPDATE USER                                           */
    /* ===================================================== */
    // static async updateUser(pa, sdbName, res) {

    //     let response = { status: 'SUCCESS', message: '', data: null };

    //     const {
    //         userId,
    //         firstName,
    //         lastName,
    //         password,
    //         email,
    //         CmpList,
    //         BrcList,
    //         cusRole,
    //         status
    //     } = pa;

    //     const sequelize = db.getConnection(sdbName);
    //     const transaction = await sequelize.transaction();

    //     try {

    //         if (!userId) {
    //             throw new Error('userId is required');
    //         }

    //         const admi = new ADMIController(sdbName);
    //         const m81 = new M81Controller(sdbName);

    //         /* ==============================
    //            1️⃣ Find Existing User
    //         ============================== */

    //         let existingUser;
    //         const users = await admi.findAll({}, [], null, transaction);

    //         for (let u of users) {
    //             try {
    //                 if (encryptor.decrypt(u.ADMIF01) === userId) {
    //                     existingUser = u;
    //                     break;
    //                 }
    //             } catch { }
    //         }

    //         if (!existingUser) {
    //             throw new Error('User not found');
    //         }

    //         /* ==============================
    //            2️⃣ Optional License Check (if activating)
    //         ============================== */

    //         if (status == 1 && existingUser.ADMIF08 == 0) {

    //             const corpUnq = existingUser.ADMICORP;

    //             const corp = await PLRDBA01.findOne({
    //                 where: { A01F01: corpUnq }
    //             });

    //             const activeCount = await admi.count({
    //                 ADMICORP: corpUnq,
    //                 ADMIF08: 1
    //             }, transaction);

    //             const userLimit = Number(corp?.A01F10 || 0);

    //             if (userLimit > 0 && activeCount >= userLimit) {
    //                 throw new Error(
    //                     `User limit exceeded. Plan allows only ${userLimit} active users.`
    //                 );
    //             }
    //         }

    //         /* ==============================
    //            3️⃣ Prepare Update Data
    //         ============================== */

    //         const finalFirstName = firstName ?? existingUser.ADMIF02;
    //         const finalLastName = lastName ?? existingUser.ADMIF04;

    //         const updateData = {
    //             ADMIF02: finalFirstName,
    //             ADMIF04: finalLastName,
    //             ADMIF07: email ?? existingUser.ADMIF07,
    //             ADMICOMP: CmpList ?? existingUser.ADMICOMP,
    //             ADMIBRC: BrcList ?? existingUser.ADMIBRC,
    //             ADMIROL: cusRole ?? existingUser.ADMIROL
    //         };

    //         // 🚫 Prevent system role escalation
    //         // ADMIF06 intentionally NOT updated

    //         if (password) {
    //             updateData.ADMIF05 = encryptor.encrypt(password);
    //         }

    //         // if (status !== undefined) {
    //         //     updateData.ADMIF08 = status == 1 ? 1 : 0;
    //         // }
    //         if (status !== undefined) {
    //             await m81.update(
    //                 { M81ADA: status == 1 ? 'A' : 'D' },
    //                 { M81UNQ: existingUser.ADMIF00 }
    //             );
    //         }

    //         /* ==============================
    //            4️⃣ Update ADMI
    //         ============================== */

    //         await admi.update(updateData, {
    //             ADMIF00: existingUser.ADMIF00
    //         });

    //         /* ==============================
    //            5️⃣ Sync M81
    //         ============================== */

    //         const m81UpdateData = {
    //             M81F02: `${finalFirstName}`
    //         };

    //         if (email) {
    //             m81UpdateData.M81F08 = email;
    //         }

    //         if (password) {
    //             m81UpdateData.M81F04 = password; // (same as your current design)
    //         }

    //         await m81.update(
    //             m81UpdateData,
    //             { M81UNQ: existingUser.ADMIF00 }
    //         );

    //         /* ==============================
    //            6️⃣ Commit
    //         ============================== */

    //         await transaction.commit();
    //         response.status = 'SUCCESS';
    //         response.message = 'User updated successfully';

    //         return res.status(200).json({
    //             encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //         });

    //     } catch (err) {

    //         await transaction.rollback();

    //         response.status = 'FAIL';
    //         response.message = err.message;

    //         return res.status(400).json({
    //             encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //         });
    //     }
    // }
    static async updateUser(pa, sdbName, res) {

        let response = { status: 'SUCCESS', message: '', data: null };

        const {
            userId,
            firstName,
            lastName,
            password,
            email,
            CmpList,
            BrcList,
            cusRole,
            status
        } = pa;

        const sequelize = db.getConnection(sdbName);
        const transaction = await sequelize.transaction();

        try {

            if (!userId) {
                throw new Error('userId is required');
            }

            const admi = new ADMIController(sdbName);
            const m81 = new M81Controller(sdbName);

            /* ==============================
               1️⃣ Find Existing User
            ============================== */

            let existingUser;
            const users = await admi.findAll({}, [], null, transaction);

            for (let u of users) {
                try {
                    if (encryptor.decrypt(u.ADMIF01) === userId) {
                        existingUser = u;
                        break;
                    }
                } catch { }
            }

            if (!existingUser) {
                throw new Error('User not found');
            }

            /* ==============================
               2️⃣ License Check (If Activating)
            ============================== */

            if (status == 1 && existingUser.ADMIF08 == 0) {

                const corpUnq = existingUser.ADMICORP;

                const corp = await PLRDBA01.findOne({
                    where: { A01F01: corpUnq }
                });

                const activeCount = await admi.count({
                    ADMICORP: corpUnq,
                    ADMIF08: 1
                }, transaction);

                const userLimit = Number(corp?.A01F10 || 0);

                if (userLimit > 0 && activeCount >= userLimit) {
                    throw new Error(
                        `User limit exceeded. Plan allows only ${userLimit} active users.`
                    );
                }
            }

            /* ==============================
               3️⃣ Prepare ADMI Update
            ============================== */

            const finalFirstName = firstName ?? existingUser.ADMIF02;
            const finalLastName = lastName ?? existingUser.ADMIF04;

            const updateData = {
                ADMIF02: finalFirstName,
                ADMIF04: finalLastName,
                ADMIF07: email ?? existingUser.ADMIF07,
                ADMICOMP: CmpList ?? existingUser.ADMICOMP,
                ADMIBRC: BrcList ?? existingUser.ADMIBRC,
                ADMIROL: cusRole ?? existingUser.ADMIROL
            };

            // 🔐 Password update
            if (password) {
                updateData.ADMIF05 = encryptor.encrypt(password);
            }

            // 🔄 Status sync in ADMI
            if (status !== undefined) {
                updateData.ADMIF08 = status == 1 ? 1 : 0;
            }

            /* ==============================
               4️⃣ Update ADMI
            ============================== */

            await admi.update(updateData, {
                ADMIF00: existingUser.ADMIF00
            }, transaction);

            /* ==============================
               5️⃣ Sync M81
            ============================== */

            const m81UpdateData = {
                M81F02: `${finalFirstName} ${finalLastName}`
            };

            if (email) {
                m81UpdateData.M81F08 = email;
            }

            if (password) {
                m81UpdateData.M81F04 = password;
            }

            if (status !== undefined) {
                m81UpdateData.M81ADA = status == 1 ? 'A' : 'D';
            }

            await m81.update(
                m81UpdateData,
                { M81UNQ: existingUser.ADMIF00 },
                transaction
            );

            /* ==============================
               6️⃣ Commit
            ============================== */

            await transaction.commit();

            response.status = 'SUCCESS';
            response.message = 'User updated successfully';

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            await transaction.rollback();

            response.status = 'FAIL';
            response.message = err.message;

            return res.status(400).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }
    /* ===================================================== */
    /* DEACTIVATE USER                                       */
    /* ===================================================== */
    // static async deleteUser(pa, sdbName, res) {

    //     let response = { status: 'SUCCESS', message: '', data: null };

    //     const { userId } = pa;

    //     const sequelize = db.getConnection(sdbName);
    //     const transaction = await sequelize.transaction();

    //     try {

    //         if (!userId) {
    //             throw new Error('userId is required');
    //         }

    //         const admi = new ADMIController(sdbName);
    //         const m81 = new M81Controller(sdbName);

    //         /* ==============================
    //            1️⃣ Find User
    //         ============================== */

    //         let existingUser;
    //         const users = await admi.findAll({}, [], null, transaction);

    //         for (let u of users) {
    //             try {
    //                 if (encryptor.decrypt(u.ADMIF01) === userId) {
    //                     existingUser = u;
    //                     break;
    //                 }
    //             } catch { }
    //         }

    //         if (!existingUser) {
    //             throw new Error('User not found');
    //         }

    //         /* ==============================
    //            2️⃣ Prevent Owner Deactivation
    //         ============================== */

    //         if (existingUser.ADMIF06 == 1) {
    //             throw new Error('Company Owner cannot be deactivated');
    //         }

    //         /* ==============================
    //            3️⃣ Already Inactive Check
    //         ============================== */

    //         if (existingUser.ADMIF08 == 0) {
    //             throw new Error('User already deactivated');
    //         }

    //         /* ==============================
    //            4️⃣ Soft Delete (Deactivate)
    //         ============================== */

    //         await admi.update(
    //             { ADMIF08: 0 },
    //             { ADMIF00: existingUser.ADMIF00 }
    //         );

    //         /* ==============================
    //            5️⃣ Sync M81 Status
    //         ============================== */

    //         await m81.update(
    //             { M81ADA: 'D' },   // Mark as Deactivated
    //             { M81UNQ: existingUser.ADMIF00 }
    //         );

    //         /* ==============================
    //            6️⃣ Commit
    //         ============================== */

    //         await transaction.commit();

    //         response.message = 'User deactivated successfully';

    //         return res.status(200).json({
    //             encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //         });

    //     } catch (err) {

    //         await transaction.rollback();

    //         response.status = 'FAIL';
    //         response.message = err.message;

    //         return res.status(400).json({
    //             encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    //         });
    //     }
    // }
    static async deleteUser(pa, sdbName, res) {

        let response = { status: 'SUCCESS', message: '', data: null };

        const { userId } = pa;

        const sequelize = db.getConnection(sdbName);
        const transaction = await sequelize.transaction();

        try {

            if (!userId) {
                throw new Error('userId is required');
            }

            const admi = new ADMIController(sdbName);
            const m81 = new M81Controller(sdbName);

            /* ==============================
               1️⃣ Find User
            ============================== */

            let existingUser;
            const users = await admi.findAll({}, [], null, transaction);

            for (let u of users) {
                try {
                    if (encryptor.decrypt(u.ADMIF01) === userId) {
                        existingUser = u;
                        break;
                    }
                } catch { }
            }

            if (!existingUser) {
                throw new Error('User not found');
            }

            /* ==============================
               2️⃣ Prevent Owner / Admin
            ============================== */

            if (existingUser.ADMIF06 == 1) {
                throw new Error('Company Owner cannot be deactivated');
            }

            if (existingUser.ADMIF06 == 2) {
                throw new Error('Admin user cannot be deactivated');
            }

            /* ==============================
               3️⃣ Already Inactive Check
            ============================== */

            if (existingUser.ADMIF08 == 0) {
                throw new Error('User already deactivated');
            }

            /* ==============================
               4️⃣ Soft Deactivate
            ============================== */

            await admi.update(
                { ADMIF08: 0 },
                { ADMIF00: existingUser.ADMIF00 },
                transaction
            );

            await m81.update(
                { M81ADA: 'D' },
                { M81UNQ: existingUser.ADMIF00 },
                transaction
            );

            await transaction.commit();
            response.status = 'SUCCESS';
            response.message = 'User deactivated successfully';

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            await transaction.rollback();

            response.status = 'FAIL';
            response.message = err.message;

            return res.status(400).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }

    /* ===================================================== */
    /* GET ALL USERS                                         */
    /* ===================================================== */
    static async getAllUsers(sdbName, res) {

        let response = { status: 'SUCCESS', message: '', data: null };

        try {

            const admi = new ADMIController(sdbName);
            const users = await admi.findAll();

            response.data = users.map(u => ({
                userId: encryptor.decrypt(u.ADMIF01),
                name: u.ADMIF02 + ' ' + u.ADMIF04,
                roleId: u.ADMIF06,
                email: u.ADMIF07,
                companies: u.ADMICOMP,
                branches: u.ADMIBRC,
                isActive: u.ADMIF08 == 1
            }));

            response.message = 'Users fetched successfully';

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            console.error(err);

            response.status = 'FAIL';
            response.message = 'Failed to fetch users';

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }

    /* ===================================================== */
    /* ACTIVATE / DEACTIVATE USER                            */
    /* ===================================================== */
    static async toggleStatus(pa, sdbName, res) {

        let response = { status: 'SUCCESS', message: '', data: null };

        const { userId, status } = pa;

        try {

            const admi = new ADMIController(sdbName);

            let existingUser;
            const users = await admi.findAll();

            for (let u of users) {
                if (encryptor.decrypt(u.ADMIF01) === userId) {
                    existingUser = u;
                }
            }

            if (!existingUser) {
                response.status = 'FAIL';
                response.message = 'User not found';
                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            await admi.update(
                { ADMIF08: status == 1 ? 1 : 0 },
                { ADMIF00: existingUser.ADMIF00 }
            );

            response.message =
                status == 1
                    ? 'User activated successfully'
                    : 'User deactivated successfully';

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            console.error(err);

            response.status = 'FAIL';
            response.message = 'Status update failed';

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }

    /* ===================================================== */
    /* GET CURRENT USER + PLAN LIMIT DETAILS                */
    /* ===================================================== */
    static async getCurrentLimits(corporateId, sdbName, res) {

        let response = { status: 'SUCCESS', message: '', data: null };

        try {

            /* 1️⃣ Get Corporate Master (Plan Limits) */
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

            /* 2️⃣ Get All Users from SDB */
            const admi = new ADMIController(sdbName);

            const allUsers = await admi.findAll({
                ADMICORP: corp.A01F01
            });

            const totalUsersCreated = allUsers.length;

            const activeUsers = allUsers.filter(u => u.ADMIF08 == 1).length;
            const inactiveUsers = allUsers.filter(u => u.ADMIF08 == 0).length;

            const totalUsersAllowed = Number(corp.A01F10 || 0);

            const remainingSlots =
                totalUsersAllowed > 0
                    ? totalUsersAllowed - activeUsers
                    : 0;

            /* 3️⃣ Company-wise Limits */
            const definePLRDBGAO = require('../Models/RDB/PLRDBGAO');
            const PLRDBGAO = definePLRDBGAO(sequelizeRDB);

            const gaoRows = await PLRDBGAO.findAll({
                where: { GAOF01: corporateId },
                order: [['GAOF02', 'ASC']]
            });

            response.status = 'SUCCESS';
            response.message = 'User & plan limits fetched successfully';
            response.data = {

                corporateLimits: {
                    totalUsersAllowed,
                    totalUsersCreated,
                    activeUsers,
                    inactiveUsers,
                    remainingSlots,
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

            console.error(err);

            response.status = 'FAIL';
            response.message = 'Failed to fetch limits';

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }

    /* ===================================================== */
    /* GET ALL CUSTOM ROLES AND COMPANY AND BRANCHES FOR CORPORATE                   */
    /* ===================================================== */

    static async getCustomRoles(corporateId, sdbName, res) {

        let response = { status: 'SUCCESS', message: '', data: null };

        try {

            const sdb = db.getConnection(sdbName);
            const crole = new CROLEController(sdbName);

            /* =========================
             * 1️⃣ CUSTOM ROLES
             * ========================= */
            const roles = await crole.findAll(
                { CROLF02: corporateId },
                [['CROLF01', 'ASC']],
                ['CROLF00', 'CROLF01']
            );

            const roleList = roles.map(r => ({
                roleId: r.CROLF00,
                roleName: r.CROLF01
            }));

            /* =========================
             * 2️⃣ COMPANIES
             * ========================= */
            const companies = await sdb.query(`
            SELECT CMPF01, CMPF02
            FROM PLSDBCMP
            WHERE CMPDEL IS NULL
            ORDER BY CMPF02 ASC
        `, {
                type: require('sequelize').QueryTypes.SELECT
            });

            const companyList = companies.map(c => ({
                companyId: String(c.CMPF01),
                companyName: c.CMPF02
            }));

            /* =========================
             * 3️⃣ BRANCHES (WITH COMPANY MAPPING)
             * ========================= */
            const branches = await sdb.query(`
            SELECT BRID, BRCODE, BRNAME, BRCCOMP
            FROM PLSDBBRC
        `, {
                type: require('sequelize').QueryTypes.SELECT
            });

            const branchList = branches.map(b => ({
                branchId: b.BRID,
                branchCode: b.BRCODE,
                branchName: b.BRNAME,
                companyIds: b.BRCCOMP
                    ? b.BRCCOMP.split(',').map(c => c.trim())
                    : []
            }));

            /* =========================
             * 4️⃣ FINAL RESPONSE
             * ========================= */
            response.data = {
                roles: roleList,
                companies: companyList,
                branches: branchList
            };

            response.message = 'Roles, companies and branches fetched successfully';

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });

        } catch (err) {

            console.error(err);

            response.status = 'FAIL';
            response.message = 'Failed to load user creation data';

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }
    /* ===================================================== */
    /* HELPERS                                               */
    /* ===================================================== */
    static getSDBName(corpId) {

        const parts = corpId.split('-');

        let sdbName = parts.length === 3
            ? `${parts[0]}${parts[1]}${parts[2]}SDB`
            : `${parts[0]}${parts[1]}SDB`;

        if (sdbName === 'PLP00001SDB')
            sdbName = 'A00001SDB';

        return sdbName;
    }
}

module.exports = CAdminUserController;