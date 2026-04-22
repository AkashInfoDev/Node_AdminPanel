const querystring = require('querystring');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('../Config/config');
const definePLSTATE = require('../Models/IDB/PLSTATE');


// 🔥 MODEL FACTORY
// const defineUserTable = require('../Models/RDB/UserTable');
const defineEPUser = require('../Models/RDB/EP_USER');
const defineEPBank = require('../Models/RDB/EP_BANK');

const Encryptor = require('../Services/encryptor');

const { Op } = require('sequelize');
const sequelizeIDB = db.getConnection('IDBAPI');

const TokenService = require('../Services/tokenServices');
// const PLSTATE = require('../Models/IDB/PLSTATE');
const PLSTATE = definePLSTATE(sequelizeIDB);


// 🔗 CONNECT RDB
const sequelizeRDB = db.getConnection('RDB');
const EPBank = defineEPBank(sequelizeRDB);

const defineUserTypes = require('../Models/RDB/EP_USERTPYES');
const UserTypes = defineUserTypes(sequelizeRDB, require('sequelize').DataTypes);
// 🔥 DEFINE MODEL (IMPORTANT)
// const UserTable = defineUserTable(sequelizeRDB);
const EPUser = defineEPUser(sequelizeRDB);

const encryptor = new Encryptor();




class RDBUserController {
    static cachedRoles = null;

static async checkRoleAccess(roleId) {

    if (!this.cachedRoles) {
        const roles = await UserTypes.findAll({
            attributes: ['ID'],
            raw: true
        });

        this.cachedRoles = roles.map(r => Number(r.ID));
    }

    return this.cachedRoles.includes(Number(roleId));
}

    // 🔥 MAIN ENTRY (same pattern as your system)

    static async manageUser(req, res) {

        let response = { status: 'SUCCESS', message: '', data: null };

        try {

            const token = req.headers['authorization']?.split(' ')[1];
            if (!token) {
                response.status = 'FAIL';
                response.message = 'Authorization token missing';
                return res.status(401).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }
            const decoded = await TokenService.validateToken(token);

            // const roleId = Number(decoded.roleId);

            // if (![1, 2, 3, 4,5].includes(roleId)) {
            //     response.status = 'FAIL';
            //     response.message = 'Access denied';
            //     return res.status(403).json({
            //         encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            //     });
            // }
            const roleId = Number(decoded.roleId);

const isAllowed = await RDBUserController.checkRoleAccess(roleId);

if (!isAllowed) {
    response.status = 'FAIL';
    response.message = 'Access denied';
    return res.status(403).json({
        encryptedResponse: encryptor.encrypt(JSON.stringify(response))
    });
}


            // const decoded1 = await TokenService.validateToken(token);
            if (!req.query.pa) {
                response.status = 'FAIL';
                response.message = 'Encrypted parameter missing';

                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            // const parameterString = encryptor.decrypt(req.query.pa);
            // const decoded = decodeURIComponent(parameterString);
            // const pa = querystring.parse(decoded);


            const decrypted = encryptor.decrypt(req.query.pa);
            const pa = querystring.parse(decodeURIComponent(decrypted));
            // ✅ KEEP FRONTEND SAME
            // const {
            //     User_Id,
            //     action,
            //     userId,
            //     userName,
            //     password,
            //     userType,
            //     email,
            //     dealerCode,
            //     userMobile,
            //     fbtokenapp,
            //     commission,
            //     address,
            //     city,
            //     state,
            //     pincode,
            //     gstin,
            //     isActive
            // } = pa;
            const {
                User_Id,
                action,
                userId,
                userName,
                password,
                userType,
                email,
                dealerCode,
                userMobile,
                fbtokenapp,
                commission,
                address,
                city,
                state,
                pincode,
                gstin,
                isActive,

                // 💰 NEW BANK FIELDS
                accountHolderName,
                bankName,
                accountNumber,
                ifscCode,
                upiId

            } = pa;

            // 🔥 NORMALIZE TYPE (IMPORTANT)
            const normalizedUserType = String(userType);

            if (!action) {
                response.status = 'FAIL';
                response.message = 'Action is required';

                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            switch (action) {

                case 'R':

                    if (!normalizedUserType) {
                        return res.status(400).json({
                            encryptedResponse: encryptor.encrypt(JSON.stringify({
                                status: 'FAIL',
                                message: 'userType required'
                            }))
                        });
                    }

                    // 👉 reseller-safe validation
                    if (normalizedUserType !== '4' && (!userId || !password)) {
                        return res.status(400).json({
                            encryptedResponse: encryptor.encrypt(JSON.stringify({
                                status: 'FAIL',
                                message: 'userId and password required'
                            }))
                        });
                    }

                    // return RDBUserController.createUser({
                    //     userId,
                    //     userName,
                    //     password,
                    //     userType: normalizedUserType, // 🔥 FIXED
                    //     email,
                    //     dealerCode,
                    //     userMobile,
                    //     fbtokenapp,
                    //     commission,
                    //     address,
                    //     city,
                    //     state,
                    //     pincode,
                    //     gstin
                    // }, res);
                    return RDBUserController.createUser({
                        // newId,
                        userId,
                        userName,
                        password,
                        userType: normalizedUserType,
                        email,
                        dealerCode,
                        userMobile,
                        fbtokenapp,
                        commission,
                        address,
                        city,
                        state,
                        pincode,
                        gstin,

                        // 💰 BANK DATA
                        accountHolderName,
                        bankName,
                        accountNumber,
                        ifscCode,
                        upiId

                    }, res);

                case 'E':
                    return RDBUserController.updateUser({
                        User_Id,
                        userId,
                        userName,
                        password,
                        userType: normalizedUserType,
                        email,
                        dealerCode,
                        userMobile,
                        fbtokenapp,
                        commission,
                        address,
                        city,
                        state,
                        pincode,
                        gstin,
                        isActive,

                        // 💰 BANK DATA
                        accountHolderName,
                        bankName,
                        accountNumber,
                        ifscCode,
                        upiId

                    }, res);

                case 'D':
                    return RDBUserController.deleteUser(User_Id, res); // keep same

                case 'G':
                    return RDBUserController.getUsers(res);



                // case 'G':
                //     return RDBUserController.getUsers1(req, res);

                case 'T':
                    return RDBUserController.toggleUserStatus(User_Id, res);

                case 'DB':   // 🔥 NEW ACTION
                    return RDBUserController.handleGetDatabases(pa, res, decoded);

                case 'W': // Withdraw Request
                    return RDBUserController.requestWithdraw(pa, res, decoded);

                default:
                    return res.status(400).json({
                        encryptedResponse: encryptor.encrypt(JSON.stringify({
                            status: 'FAIL',
                            message: 'Invalid action parameter'
                        }))
                    });
            }

        } catch (error) {

            console.error("manageUser Error:", error.message);

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: 'Server error'
                }))
            });
        }
    }

    // 🟢 CREATE USER

    static async createUser(data, res) {

        function generateResellerId() {
            const chars = '0123456789';
            let code = '';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return `RES_${code}`;
        }

        async function generateUniqueResellerId() {
            let id;
            let exists = true;

            while (exists) {
                id = generateResellerId();

                const existing = await EPUser.findOne({
                    where: { UTF04: encryptor.encrypt(id) }
                });

                if (!existing) exists = false;
            }

            return id;
        }

        function generateDealerCode() {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let code = '';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
        }

        async function generateUniqueDealerCode() {
            let code;
            let exists = true;

            while (exists) {
                code = generateDealerCode();

                const existing = await EPUser.findOne({
                    where: { UTF08: code }
                });

                if (!existing) exists = false;
            }

            return code;
        }

        try {

            const userType = String(data.userType);

            if (!userType) {
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        status: 'FAIL',
                        message: 'userType is required'
                    }))
                });
            }

            // 🔐 login validation
            if (userType !== '4' && (!data.userId || !data.password)) {
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        status: 'FAIL',
                        message: 'userId and password required'
                    }))
                });
            }

            // 💰 BANK VALIDATION (Dealer + Reseller)
            if (['3', '4'].includes(userType)) {
                if (
                    !data.upiId &&
                    (!data.accountNumber || !data.ifscCode)
                ) {
                    return res.status(400).json({
                        encryptedResponse: encryptor.encrypt(JSON.stringify({
                            status: 'FAIL',
                            message: 'Provide UPI or Bank details'
                        }))
                    });
                }
            }

            // 🔍 duplicate check (non reseller)
            if (userType !== '4') {

                const users = await EPUser.findAll();

                for (let u of users) {

                    let decryptedId;

                    try {
                        decryptedId = encryptor.decrypt(u.UTF04);
                    } catch {
                        decryptedId = u.UTF04;
                    }

                    if (decryptedId === data.userId) {
                        return res.status(400).json({
                            encryptedResponse: encryptor.encrypt(JSON.stringify({
                                status: 'FAIL',
                                message: 'UserID already exists'
                            }))
                        });
                    }
                }
            }

            const encryptedPassword = data.password
                ? encryptor.encrypt(data.password)
                : null;

            const dealerCode = await generateUniqueDealerCode();

            // 🔐 USER ID LOGIC
            let finalUserId = null;

            if (userType === '4') {
                const resellerId = await generateUniqueResellerId();
                finalUserId = encryptor.encrypt(resellerId);
            } else {
                finalUserId = encryptor.encrypt(data.userId);
            }

            /* =========================
               💾 CREATE USER
            ========================= */
            const lastUser = await EPUser.findOne({
                order: [['UTF01', 'DESC']]
            });

            const newId = lastUser ? lastUser.UTF01 + 1 : 1;

            const newUser = await EPUser.create({
                // UTF01: newId,
                UTF02: data.userName,
                UTF03: userType,

                UTF04: finalUserId,
                UTF05: userType === '4' ? null : encryptedPassword,

                UTF10: data.email,
                UTF08: dealerCode,
                UTF09: data.userMobile ? Number(data.userMobile) : null,
                UTF11: data.fbtokenapp,
                UTF12: data.commission ? Number(data.commission) : null,
                UTF13: data.address,
                UTF14: data.city,
                UTF15: data.state,
                UTF16: data.pincode ? Number(data.pincode) : null,
                UTF17: data.gstin,

                UTF06: 'Y',
                UTF07: 'N'
            });

            /* =========================
               💰 CREATE BANK ENTRY
            ========================= */

            if (['3', '4'].includes(userType)) {

                await EPBank.create({
                    BNK02: newUser.UTF01,   // 🔥 LINK

                    BNK03: data.accountHolderName || null,
                    BNK04: data.bankName || null,
                    BNK05: data.accountNumber || null,
                    BNK06: data.ifscCode || null,
                    BNK07: data.upiId || null,

                    BNK08: 'Y',
                    BNK09: 'N'
                });
            }

            /* =========================
               📦 RESPONSE
            ========================= */

            return res.status(201).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    message: 'User + Bank created successfully',
                    data: newUser
                }))
            });

        } catch (error) {

            console.error("CreateUser Error:", error);

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: 'Create failed'
                }))
            });
        }
    }


    static async updateUser(data, res) {


        try {

            /* =========================
               🔍 FIND USER
            ========================= */

            const user = await EPUser.findOne({
                where: {
                    UTF01: data.User_Id,
                    UTF07: 'N'
                }
            });

            if (!user) {
                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        status: 'FAIL',
                        message: 'User not found'
                    }))
                });
            }

            const currentUserType = String(user.UTF03);
            const incomingUserType = String(data.userType || currentUserType);

            /* =========================
               🔁 DUPLICATE CHECK
            ========================= */

            if (data.newUserId && incomingUserType !== '4') {

                const users = await EPUser.findAll({
                    where: { UTF07: 'N' }
                });

                for (let u of users) {

                    let decryptedId;

                    try {
                        decryptedId = encryptor.decrypt(u.UTF04);
                    } catch {
                        decryptedId = u.UTF04;
                    }

                    if (
                        decryptedId === data.newUserId &&
                        u.UTF01 !== user.UTF01
                    ) {
                        return res.status(400).json({
                            encryptedResponse: encryptor.encrypt(JSON.stringify({
                                status: 'FAIL',
                                message: 'UserID already exists'
                            }))
                        });
                    }
                }
            }

            /* =========================
               🧱 BUILD UPDATE OBJECT
            ========================= */

            const updateData = {};

            if (data.userName !== undefined)
                updateData.UTF02 = data.userName;

            if (data.email !== undefined)
                updateData.UTF10 = data.email;

            if (data.dealerCode !== undefined)
                updateData.UTF08 = data.dealerCode;

            if (data.fbtokenapp !== undefined)
                updateData.UTF11 = data.fbtokenapp;

            if (data.address !== undefined)
                updateData.UTF13 = data.address;

            if (data.city !== undefined)
                updateData.UTF14 = data.city;

            if (data.state !== undefined)
                updateData.UTF15 = data.state;

            if (data.gstin !== undefined)
                updateData.UTF17 = data.gstin;

            if (data.isActive !== undefined)
                updateData.UTF06 = data.isActive;

            /* =========================
               📱 VALIDATIONS
            ========================= */

            if (data.userMobile !== undefined) {

                if (isNaN(Number(data.userMobile))) {
                    return res.status(400).json({
                        encryptedResponse: encryptor.encrypt(JSON.stringify({
                            status: 'FAIL',
                            message: 'Invalid mobile number'
                        }))
                    });
                }

                updateData.UTF09 = Number(data.userMobile);
            }

            if (data.pincode !== undefined) {

                if (isNaN(Number(data.pincode))) {
                    return res.status(400).json({
                        encryptedResponse: encryptor.encrypt(JSON.stringify({
                            status: 'FAIL',
                            message: 'Invalid pincode'
                        }))
                    });
                }

                updateData.UTF16 = Number(data.pincode);
            }

            if (data.commission !== undefined) {

                if (isNaN(Number(data.commission))) {
                    return res.status(400).json({
                        encryptedResponse: encryptor.encrypt(JSON.stringify({
                            status: 'FAIL',
                            message: 'Invalid commission'
                        }))
                    });
                }

                updateData.UTF12 = Number(data.commission);
            }

            /* =========================
               🔐 USERID + PASSWORD
            ========================= */

            if (incomingUserType !== '4') {

                if (data.newUserId) {
                    updateData.UTF04 = encryptor.encrypt(data.newUserId);
                }

                if (data.password) {
                    updateData.UTF05 = encryptor.encrypt(data.password);
                }

            } else {
                updateData.UTF05 = null; // reseller no password
            }

            /* =========================
               🔄 USER TYPE CHANGE
            ========================= */

            if (data.userType !== undefined) {
                updateData.UTF03 = incomingUserType;
            }

            /* =========================
               💾 UPDATE USER
            ========================= */

            await user.update(updateData);

            /* =========================
               💰 BANK SYNC (IMPORTANT)
            ========================= */

            if (['3', '4'].includes(incomingUserType)) {

                // 🔍 find existing bank
                let bank = await EPBank.findOne({
                    where: {
                        BNK02: user.UTF01,
                        BNK09: 'N'
                    }
                });

                // 🧠 VALIDATION
                if (
                    data.accountHolderName ||
                    data.bankName ||
                    data.accountNumber ||
                    data.ifscCode ||
                    data.upiId
                ) {

                    if (
                        !data.upiId &&
                        (!data.accountNumber || !data.ifscCode)
                    ) {
                        return res.status(400).json({
                            encryptedResponse: encryptor.encrypt(JSON.stringify({
                                status: 'FAIL',
                                message: 'Provide UPI or Bank details'
                            }))
                        });
                    }
                }

                if (bank) {

                    // 🔄 UPDATE BANK
                    await bank.update({
                        BNK03: data.accountHolderName ?? bank.BNK03,
                        BNK04: data.bankName ?? bank.BNK04,
                        BNK05: data.accountNumber ?? bank.BNK05,
                        BNK06: data.ifscCode ?? bank.BNK06,
                        BNK07: data.upiId ?? bank.BNK07
                    });

                } else {

                    // 🆕 CREATE BANK IF NOT EXIST
                    await EPBank.create({
                        BNK02: user.UTF01,

                        BNK03: data.accountHolderName || null,
                        BNK04: data.bankName || null,
                        BNK05: data.accountNumber || null,
                        BNK06: data.ifscCode || null,
                        BNK07: data.upiId || null,

                        BNK08: 'Y',
                        BNK09: 'N'
                    });
                }
            }

            /* =========================
               📦 RESPONSE
            ========================= */

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    message: 'User + Bank updated successfully'
                }))
            });

        } catch (error) {

            console.error("UpdateUser Error:", error);

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: error.message
                }))
            });
        }
    }


    static async deleteUser(User_Id, res) {



        try {

            /* =========================
               🔍 FIND USER
            ========================= */

            const user = await EPUser.findOne({
                where: {
                    UTF01: User_Id,
                    UTF07: 'N'
                }
            });

            if (!user) {
                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        status: 'FAIL',
                        message: 'User not found or already deleted'
                    }))
                });
            }

            const userType = String(user.UTF03);

            /* =========================
               🗑️ SOFT DELETE USER
            ========================= */

            await user.update({
                UTF07: 'Y'
            });

            /* =========================
               💰 SOFT DELETE BANK (Dealer/Reseller)
            ========================= */

            if (['3', '4'].includes(userType)) {

                await EPBank.update(
                    { BNK09: 'Y' },
                    {
                        where: {
                            BNK02: User_Id
                        }
                    }
                );
            }

            /* =========================
               📦 RESPONSE
            ========================= */

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    message: 'User + Bank deleted successfully'
                }))
            });

        } catch (error) {

            console.error("DeleteUser Error:", error);

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: 'Delete failed'
                }))
            });
        }
    }


    // static async getUsers(res) {


    //     let response = { status: 'SUCCESS', message: '', data: null };

    //     try {

    //         /* =========================
    //            🔍 FETCH USERS
    //         ========================= */

    //         const users = await EPUser.findAll({
    //             where: { UTF07: 'N' }
    //         });

    //         /* =========================
    //            🔍 FETCH BANK DATA
    //         ========================= */

    //         const banks = await EPBank.findAll({
    //             where: { BNK09: 'N' }
    //         });

    //         // 🔁 Create map for fast lookup
    //         const bankMap = {};
    //         banks.forEach(b => {
    //             bankMap[b.BNK02] = b;
    //         });

    //         /* =========================
    //            🔄 MAP RESPONSE
    //         ========================= */

    //         const formattedUsers = users.map(u => {

    //             const userType = String(u.UTF03);
    //             const bank = bankMap[u.UTF01];

    //             return {

    //                 User_Id: u.UTF01,
    //                 User_Name: u.UTF02,
    //                 User_Type: u.UTF03,

    //                 UserID: u.UTF04,
    //                 Password: u.UTF05,

    //                 User_IsActive: u.UTF06,
    //                 User_IsDeleted: u.UTF07,

    //                 Dealer_Code: u.UTF08,
    //                 User_Mobile: u.UTF09,
    //                 user_email: u.UTF10,
    //                 fbtokenapp: u.UTF11,
    //                 commission: u.UTF12,
    //                 address: u.UTF13,
    //                 city: u.UTF14,
    //                 state: u.UTF15,
    //                 pincode: u.UTF16,
    //                 gstin: u.UTF17,

    //                 /* =========================
    //                    💰 BANK DATA
    //                 ========================= */

    //                 accountHolderName:
    //                     (['3', '4'].includes(userType) && bank) ? bank.BNK03 : null,

    //                 bankName:
    //                     (['3', '4'].includes(userType) && bank) ? bank.BNK04 : null,

    //                 accountNumber:
    //                     (['3', '4'].includes(userType) && bank) ? bank.BNK05 : null,

    //                 ifscCode:
    //                     (['3', '4'].includes(userType) && bank) ? bank.BNK06 : null,

    //                 upiId:
    //                     (['3', '4'].includes(userType) && bank) ? bank.BNK07 : null
    //             };
    //         });

    //         /* =========================
    //            📦 RESPONSE
    //         ========================= */

    //         return res.status(200).json({
    //             encryptedResponse: encryptor.encrypt(JSON.stringify({
    //                 status: 'SUCCESS',
    //                 message: 'Users + Bank fetched successfully',
    //                 data: formattedUsers
    //             }))
    //         });

    //     } catch (error) {

    //         console.error("GetUsers Error:", error.message);

    //         return res.status(500).json({
    //             encryptedResponse: encryptor.encrypt(JSON.stringify({
    //                 status: 'FAIL',
    //                 message: 'Fetch failed'
    //             }))
    //         });
    //     }
    // }
    static async getUsers(res) {

        let response = { status: 'SUCCESS', message: '', data: null };

        try {

            /* =========================
               🔍 FETCH USERS
            ========================= */

            const users = await EPUser.findAll({
                where: { UTF07: 'N' }
            });

            /* =========================
               🔍 FETCH BANK DATA
            ========================= */

            const banks = await EPBank.findAll({
                where: { BNK09: 'N' }
            });

            const bankMap = {};
            banks.forEach(b => {
                bankMap[b.BNK02] = b;
            });

            /* =========================
               🌍 FETCH STATES
            ========================= */

            const statesRaw = await PLSTATE.findAll({ raw: true });

            const states = statesRaw.map(s => ({
                stateCode: s.PLSF01,
                stateName: s.PLSF02
            }));

            const defineUserTypes = require('../Models/RDB/EP_USERTPYES');
            const UserTypes = defineUserTypes(sequelizeRDB, require('sequelize').DataTypes);

            const rolesRaw = await UserTypes.findAll({ raw: true });

            const roles = rolesRaw.map(r => ({
                roleId: r.ID,
                roleName: r.Type
            }));

            /* =========================
               🔄 MAP USERS
            ========================= */

            const formattedUsers = users.map(u => {

                const userType = String(u.UTF03);
                const bank = bankMap[u.UTF01];

                return {

                    User_Id: u.UTF01,
                    User_Name: u.UTF02,
                    User_Type: u.UTF03,

                    UserID: u.UTF04,
                    Password: u.UTF05,

                    User_IsActive: u.UTF06,
                    User_IsDeleted: u.UTF07,

                    Dealer_Code: u.UTF08,
                    User_Mobile: u.UTF09,
                    user_email: u.UTF10,
                    fbtokenapp: u.UTF11,
                    commission: u.UTF12,
                    address: u.UTF13,
                    city: u.UTF14,
                    state: u.UTF15,
                    pincode: u.UTF16,
                    gstin: u.UTF17,

                    /* 💰 BANK DATA */

                    accountHolderName:
                        (['3', '4'].includes(userType) && bank) ? bank.BNK03 : null,

                    bankName:
                        (['3', '4'].includes(userType) && bank) ? bank.BNK04 : null,

                    accountNumber:
                        (['3', '4'].includes(userType) && bank) ? bank.BNK05 : null,

                    ifscCode:
                        (['3', '4'].includes(userType) && bank) ? bank.BNK06 : null,

                    upiId:
                        (['3', '4'].includes(userType) && bank) ? bank.BNK07 : null
                };
            });

            /* =========================
               📦 FINAL RESPONSE
            ========================= */

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    message: 'Users + Bank + States fetched successfully',
                    data: {
                        users: formattedUsers,
                        states: states,
                        roles: roles
                    }
                }))
            });

        } catch (error) {

            console.error("GetUsers Error:", error.message);

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: 'Fetch failed'
                }))
            });
        }
    }

    static async toggleUserStatus(User_Id, res) {


        try {

            /* =========================
               🔍 FIND USER
            ========================= */

            const user = await EPUser.findOne({
                where: {
                    UTF01: User_Id,
                    UTF07: 'N'
                }
            });

            if (!user) {
                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        status: 'FAIL',
                        message: 'User not found or already deleted'
                    }))
                });
            }

            const userType = String(user.UTF03);

            /* =========================
               🔄 TOGGLE STATUS
            ========================= */

            const newStatus = user.UTF06 === 'Y' ? 'N' : 'Y';

            await user.update({
                UTF06: newStatus
            });

            /* =========================
               💰 SYNC BANK STATUS
            ========================= */

            if (['3', '4'].includes(userType)) {

                await EPBank.update(
                    { BNK08: newStatus },   // 🔥 ACTIVE FLAG SYNC
                    {
                        where: {
                            BNK02: User_Id,
                            BNK09: 'N'
                        }
                    }
                );
            }

            /* =========================
               📦 RESPONSE
            ========================= */

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    message: newStatus === 'Y'
                        ? 'User activated successfully'
                        : 'User deactivated successfully',
                    data: {
                        userId: user.UTF01,
                        status: newStatus
                    }
                }))
            });

        } catch (error) {

            console.error("ToggleUserStatus Error:", error);

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: 'Toggle status failed',
                }))
            });

        }
    }
    static async getCorporateDatabases(corporateID) {
        try {

            if (!corporateID) {
                throw new Error("corporateID is required");
            }

            /* =========================
               🔹 1. BUILD SDB NAME
            ========================= */
            const parts = corporateID.split('-');

            let sdbName =
                parts.length === 3
                    ? `${parts[0]}${parts[1]}${parts[2]}SDB`
                    : `${parts[0]}${parts[1]}SDB`;

            // 🔥 special case fix
            if (sdbName === 'PLP00001SDB') {
                sdbName = 'A00001SDB';
            }

            /* =========================
               🔹 2. CONNECT SDB
            ========================= */
            const sequelizeSDB = db.getConnection(sdbName);

            /* =========================
               🔹 3. GET COMPANY IDS
            ========================= */
            const companies = await sequelizeSDB.query(`
            SELECT CMPF01 
            FROM PLSDBCMP
            ORDER BY CMPF01
        `, {
                type: require('sequelize').QueryTypes.SELECT
            });

            /* =========================
               🔹 4. BUILD CMP DB NAMES
            ========================= */
            const corpSuffix = corporateID.slice(-5); // 00085

            const cmpDatabases = companies.map(c => {
                const companyID = Number(c.CMPF01);

                return `A${corpSuffix}CMP${companyID
                    .toString()
                    .padStart(4, '0')}`;
            });

            /* =========================
               🔹 5. RETURN STRUCTURE
            ========================= */
            return {
                corporateID,
                sdbDatabase: sdbName,
                cmpDatabases
            };

        } catch (error) {
            console.error("getCorporateDatabases Error:", error);
            throw error;
        }
    }
    static async handleGetDatabases(pa, res, decoded) {
        try {

            // 🔥 USE pa OR fallback to token
            const corporateID = pa.corporateID || decoded.corpId;

            const result = await RDBUserController.getCorporateDatabases(corporateID);

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    message: 'Databases fetched successfully',
                    data: result
                }))
            });

        } catch (error) {
            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: error.message
                }))
            });
        }
    }
    static async requestWithdraw(pa, res, decoded) {
        try {

            const dealerId = decoded.userId; // 🔥 from token
            const amount = Number(pa.amount);
            const method = pa.method;

            if (!amount || amount <= 0) {
                throw new Error("Invalid amount");
            }

            const txn = await EP_TRNS.create({
                TRN02: dealerId,
                TRN03: amount,
                TRN04: method || 'UPI',
                TRN05: 'PENDING',
                TRN07: new Date(),
                TRN15: 'WITHDRAW_REQUEST'
            });

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    message: 'Withdraw request submitted',
                    data: txn
                }))
            });

        } catch (err) {
            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: err.message
                }))
            });
        }
    }


}

module.exports = { RDBUserController };