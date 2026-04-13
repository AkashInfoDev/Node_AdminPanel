const querystring = require('querystring');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('../Config/config');

// 🔥 MODEL FACTORY
// const defineUserTable = require('../Models/RDB/UserTable');
const defineEPUser = require('../Models/RDB/EP_USER');

const Encryptor = require('../Services/encryptor');

const { Op } = require('sequelize');
const TokenService = require('../Services/tokenServices');

// 🔗 CONNECT RDB
const sequelizeRDB = db.getConnection('RDB');

// 🔥 DEFINE MODEL (IMPORTANT)
// const UserTable = defineUserTable(sequelizeRDB);
const EPUser = defineEPUser(sequelizeRDB);

const encryptor = new Encryptor();




class RDBUserController {

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

            const roleId = Number(decoded.roleId);

            if (![1, 2, 3, 4].includes(roleId)) {
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
                isActive
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

                    return RDBUserController.createUser({
                        userId,
                        userName,
                        password,
                        userType: normalizedUserType, // 🔥 FIXED
                        email,
                        dealerCode,
                        userMobile,
                        fbtokenapp,
                        commission,
                        address,
                        city,
                        state,
                        pincode,
                        gstin
                    }, res);

                case 'E':
                    return RDBUserController.updateUser({
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
                        isActive
                    }, res);

                case 'D':
                    return RDBUserController.deleteUser(User_Id, res); // keep same

                case 'G':
                    return RDBUserController.getUsers(res);


                case 'F':
                    return RDBUserController.getUsers1(req, res);

                // case 'G':
                //     return RDBUserController.getUsers1(req, res);

                case 'T':
                    return RDBUserController.toggleUserStatus(User_Id, res);

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

        let response = { status: 'SUCCESS', message: '', data: null };

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
                    where: { UTF08: code } // ✅ fixed
                });

                if (!existing) exists = false;
            }

            return code;
        }

        try {

            /* =========================
               🔐 VALIDATION
            ========================= */

            const userType = String(data.userType); // 🔥 normalize

            if (!userType) {
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        status: 'FAIL',
                        message: 'userType is required'
                    }))
                });
            }

            // 👉 Only for NON-reseller
            if (userType !== '4' && (!data.userId || !data.password)) {
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        status: 'FAIL',
                        message: 'userId and password required'
                    }))
                });
            }

            /* =========================
               🔍 DUPLICATE CHECK
            ========================= */

            if (userType !== '4') {

                const users = await EPUser.findAll();

                for (let u of users) {

                    let decryptedId;

                    try {
                        decryptedId = encryptor.decrypt(u.UTF04);
                    } catch {
                        decryptedId = u.UTF04; // fallback
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

            /* =========================
               🔐 PREPARE DATA
            ========================= */

            const encryptedPassword = data.password
                ? encryptor.encrypt(data.password)
                : null;

            const dealerCode = await generateUniqueDealerCode();

            /* =========================
               💾 CREATE USER (UTF MAP)
            ========================= */

            const newUser = await EPUser.create({

                UTF02: data.userName,
                UTF03: userType,

                // 🔐 Login fields
                UTF04: userType === '4' ? null : encryptor.encrypt(data.userId),
                UTF05: userType === '4' ? null : encryptedPassword,

                // 📧 Contact
                UTF10: data.email,

                // 🏷 Dealer / reseller
                UTF08: dealerCode,
                UTF09: data.userMobile ? Number(data.userMobile) : null,

                // 🔔 Meta
                UTF11: data.fbtokenapp,
                UTF12: data.commission ? Number(data.commission) : null,

                // 📍 Address
                UTF13: data.address,
                UTF14: data.city,
                UTF15: data.state,
                UTF16: data.pincode ? Number(data.pincode) : null,
                UTF17: data.gstin,

                // 🔐 Flags
                UTF06: 'Y',
                UTF07: 'N'
            });

            /* =========================
               📦 RESPONSE
            ========================= */

            return res.status(201).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    message: 'User created successfully',
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

        let response = { status: 'SUCCESS', message: '', data: null };

        try {

            /* =========================
               🔍 FIND USER (BY USERID)
            ========================= */

            const users = await EPUser.findAll({
                where: { UTF07: 'N' } // not deleted
            });

            let user = null;

            for (let u of users) {

                let decryptedId;

                try {
                    decryptedId = encryptor.decrypt(u.UTF04);
                } catch {
                    decryptedId = u.UTF04; // fallback
                }

                if (decryptedId === data.userId) {
                    user = u;
                    break;
                }
            }

            if (!user) {
                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        status: 'FAIL',
                        message: 'User not found'
                    }))
                });
            }

            /* =========================
               🔁 DUPLICATE CHECK (NEW USERID)
            ========================= */

            if (data.newUserId) {

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

            if (data.userType !== undefined)
                updateData.UTF03 = String(data.userType);

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
               🔐 USERID UPDATE
            ========================= */

            if (data.newUserId) {
                updateData.UTF04 = encryptor.encrypt(data.newUserId);
            }

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
               🔐 PASSWORD UPDATE
            ========================= */

            if (data.password) {
                updateData.UTF05 = encryptor.encrypt(data.password);
            }

            /* =========================
               💾 UPDATE DB
            ========================= */

            await user.update(updateData);

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    message: 'User updated successfully'
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
               🔍 FIND USER (NOT DELETED)
            ========================= */

            const user = await EPUser.findOne({
                where: {
                    UTF01: User_Id,   // ✅ primary key
                    UTF07: 'N'        // ✅ not deleted
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

            /* =========================
               🗑️ SOFT DELETE
            ========================= */

            await user.update({
                UTF07: 'Y' // ✅ mark deleted
            });

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    message: 'User deleted successfully'
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


    static async getUsers(res) {

        let response = { status: 'SUCCESS', message: '', data: null };

        try {
            const users = await EPUser.findAll({
                where: { UTF07: 'N' } // ✅ not deleted
            });

            /* =========================
               🔄 MAP RESPONSE (IMPORTANT)
               👉 keep frontend same
            ========================= */

            const formattedUsers = users.map(u => ({

                User_Id: u.UTF01,
                User_Name: u.UTF02,
                User_Type: u.UTF03,


                UserID: u.UTF04,

                Password: u.UTF05, // usually not needed but kept same

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
                gstin: u.UTF17
            }));

            /* =========================
               📦 RESPONSE
            ========================= */

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    message: 'Users fetched successfully',
                    data: formattedUsers
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
               🔍 FIND USER (NOT DELETED)
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

            /* =========================
               🔄 TOGGLE STATUS
            ========================= */

            const newStatus = user.UTF06 === 'Y' ? 'N' : 'Y';

            await user.update({
                UTF06: newStatus
            });

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    message: newStatus === 'Y'
                        ? 'User activated successfully'
                        : 'User deactivated successfully',
                    data: {
                        userId: user.UTF01, // keep same structure
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

    static async getUsers1(req, res) {
        let response = { status: 'SUCCESS', message: '', data: null };

        try {

            /* =========================
               🔐 TOKEN VALIDATION
            ========================= */

            const token = req.headers['authorization']?.split(' ')[1];

            if (!token) {
                return res.status(401).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        status: 'FAIL',
                        message: 'Authorization token missing'
                    }))
                });
            }

            const decoded = await TokenService.validateToken(token);

            const roleId = Number(decoded.roleId);
            const loginUserId = decoded.Id;

            /* =========================
               🔍 FETCH LOGIN USER
            ========================= */

            const loginUser = await EPUser.findOne({
                where: { UTF01: loginUserId, UTF07: 'N' }
            });

            if (!loginUser) {
                return res.status(404).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        status: 'FAIL',
                        message: 'Login user not found'
                    }))
                });
            }

            let formattedUsers = [];

            /* =========================
                ADMIN / USER (1,2)
                self + dealer + reseller
            ========================= */

            if ([1, 2].includes(roleId)) {

                const allDealersAndResellers = await EPUser.findAll({
                    where: {
                        UTF07: 'N',
                        UTF03: [3, 4]
                    }
                });

                formattedUsers = [
                    {
                        User_Id: loginUser.UTF01,
                        User_Name: loginUser.UTF02,
                        User_Type: loginUser.UTF03,


                        UserID: loginUser.UTF04,

                        Password: loginUser.UTF05, // usually not needed but kept same

                        User_IsActive: loginUser.UTF06,
                        User_IsDeleted: loginUser.UTF07,

                        Dealer_Code: loginUser.UTF08,
                        User_Mobile: loginUser.UTF09,
                        user_email: loginUser.UTF10,
                        fbtokenapp: loginUser.UTF11,
                        commission: loginUser.UTF12,
                        address: loginUser.UTF13,
                        city: loginUser.UTF14,
                        state: loginUser.UTF15,
                        pincode: loginUser.UTF16,
                        gstin: loginUser.UTF17
                    },
                    ...allDealersAndResellers.map(u => ({
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
                        gstin: u.UTF17
                    }))
                ];
            }

            /* =========================
               🧑‍💻 DEALER / RESELLER (3,4)
               👉 only self
            ========================= */

            else if ([3, 4].includes(roleId)) {

                formattedUsers = [{
                    User_Id: loginUser.UTF01,
                    User_Name: loginUser.UTF02,
                    User_Type: loginUser.UTF03,


                    UserID: loginUser.UTF04,

                    Password: loginUser.UTF05, // usually not needed but kept same

                    User_IsActive: loginUser.UTF06,
                    User_IsDeleted: loginUser.UTF07,

                    Dealer_Code: loginUser.UTF08,
                    User_Mobile: loginUser.UTF09,
                    user_email: loginUser.UTF10,
                    fbtokenapp: loginUser.UTF11,
                    commission: loginUser.UTF12,
                    address: loginUser.UTF13,
                    city: loginUser.UTF14,
                    state: loginUser.UTF15,
                    pincode: loginUser.UTF16,
                    gstin: loginUser.UTF17
                }];
            }

            /* =========================
               🚫 INVALID ROLE
            ========================= */

            else {
                return res.status(403).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        status: 'FAIL',
                        message: 'Access denied'
                    }))
                });
            }

            /* =========================
               📦 RESPONSE
            ========================= */

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    message: 'Users fetched successfully',
                    data: formattedUsers
                }))
            });

        } catch (error) {

            console.error("getUsers1 Error:", error.message);

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: 'Fetch failed'
                }))
            });
        }
    }
}

module.exports = { RDBUserController };