const querystring = require('querystring');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const axios = require('axios');

const db = require('../Config/config'); // Your Database class
const definePLSDBADMI = require('../Models/SDB/PLSDBADMI'); // Model factory
// const definePLSDBADMI = require('../Models/SDB/PLSDBADMI'); // Model factory
const definePLRDBA01 = require('../Models/RDB/PLRDBA01'); // Model factory
const definePLRDBA02 = require('../Models/RDB/PLRDBA02'); // Model factory
const definePLRDBOTP = require('../Models/RDB/PLRDBOTP');
const definePLRDBGAO = require('../Models/RDB/PLRDBGAO');
const Encryptor = require('../Services/encryptor');
const { Op, QueryTypes, Sequelize } = require('sequelize');
// const PLRDBA01 = require('../Models/RDB/PLRDBA01');
const TokenService = require('../Services/tokenServices');
const CompanyService = require('../Controller/companyController');
const AuthenticationService = require('../Services/loginServices');
const { formatDate } = require('../Services/customServices');
const Company = require('../PlusData/Class/CmpYrCls/Company');
const Year = require('../PlusData/Class/CmpYrCls/Year');
const CmpMaster = require('../PlusData/Class/CmpYrCls/CmpMaster');
const { LangType } = require('../PlusData/commonClass/plusCommon');
const ADMIController = require('./ADMIController');
const RELController = require('./RELController');
const M81Controller = require('./M81Controller');
const M82Controller = require('./M82Controller');
const CMPController = require('./CMPController');
const queryService = require('../Services/queryService');
const { sendAccountInfoMail, sendResetMail, sendLogOutMail } = require('../Services/mailServices');
const M83Controller = require('./M83Controller');
const { response } = require('express');

// Get Sequelize instance for 'SDB' or your specific DB name
const sequelizeSDB = db.getConnection('A00001SDB');
const sequelizeRDB = db.getConnection('RDB');

// Initialize model using the Sequelize instance
const PLSDBADMI = definePLSDBADMI(sequelizeSDB);
const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const PLRDBA02 = definePLRDBA02(sequelizeRDB);
const PLRDBOTP = definePLRDBOTP(sequelizeRDB);
const PLRDBGAO = definePLRDBGAO(sequelizeRDB);
const encryptor = new Encryptor();
// let response = { data: null, Status: "SUCCESS", message: null }

class AdminController {
    // Perform actions based on the operation type (A - Register, E - Edit, L - Login)
    static async manageAdmin(req, res) {
        const parameterString = encryptor.decrypt(req.query.pa);
        let decoded = decodeURIComponent(parameterString);

        let pa = querystring.parse(decoded);
        const action = pa.action;
        const userId = pa.userId;
        const firstName = pa.firstName;
        const middleName = pa.middleName;
        const lastName = pa.lastName;
        const dob = pa.dob;
        const gender = pa.gender;
        const email = pa.email;
        const password = pa.password;
        const roleId = pa.roleId;
        const address = pa.address;
        const phoneNumber = pa.phoneNumber;
        const base64Image = pa.base64Image;



        try {
            if (action === 'R') {
                if (userId || firstName || lastName || dob || gender || password || roleId || phoneNumber) {
                    return AdminController.registerAdmin(userId, firstName, middleName, lastName, dob, gender, email, password, parseInt(roleId), address, phoneNumber, base64Image, res);
                } else {
                    return res.status(500).json({ message: 'userId || firstName || lastName || dob || gender || password || roleId || phoneNumber not provided' });
                }
            }

            if (action === 'E') {
                return AdminController.editAdmin(userId, firstName, middleName, lastName, dob, gender, email, password, parseInt(roleId), address, phoneNumber, base64Image, res);
            }

            if (action === 'L') {
                return AdminController.loginAdmin(userId, password, res);
            }

            return res.status(400).json({ message: 'Invalid action parameter' });

        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: 'Server error' });
        }
    }

    static async registerAdmin(userId, firstName, middleName, lastName, dob, gender, email, password, roleId, address, phoneNumber, base64Image, res) {
        try {
            let response = {
                status: 'SUCCESS',
                message: null
            }
            const encrypted = encryptor.encrypt(userId);
            const existingAdmin = await PLSDBADMI.findAll({
                attributes: ['ADMIF01']
                // where: { ADMIF01: encrypted } 
            });
            for (let i of existingAdmin) {
                const decrypted = encryptor.decrypt(i.ADMIF01)
                if (decrypted == userId) {
                    response = {
                        message: 'User ID is already registered'
                    }
                    let encryptedResponse = encryptor.encrypt(JSON.stringify({ response }));
                    return res.status(400).json({ encryptedResponse: encryptedResponse });
                }
            }

            const hashedPassword = encryptor.encrypt(password);

            const newAdmin = await PLSDBADMI.create({
                ADMIF01: encrypted,
                ADMIF02: firstName,
                ADMIF03: middleName,
                ADMIF04: lastName,
                ADMIF05: hashedPassword,
                ADMIF06: roleId,
                ADMIF07: email,
                ADMIF09: (dob.toString()) ? dob.toString() : null,
                ADMIF10: gender,
                ADMIF12: address,
                ADMIF13: phoneNumber,
                ADMIF14: base64Image,
                // isActive will be 1 when new use registered
            });
            const admin = await PLSDBADMI.findOne({ where: { ADMIF01: encrypted } });

            const token = jwt.sign(
                {
                    adminId: admin.ADMIF01,
                    password: newAdmin.ADMIF05,
                    roleId: newAdmin.ADMIF06
                },
                process.env.JWT_SECRET_KEY,
                { expiresIn: process.env.JWT_EXPIRATION }
            );

            response = {
                message: 'Admin registered successfully',
                adminId: newAdmin.ADMIF01,
                token: token
            }

            let encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))

            return res.status(201).json({
                encryptedResponse
            });
        } catch (error) {
            console.error(error);
            let encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
            return res.status(500).json({ encryptedResponse: encryptedResponse });
        }
    }

    static async editAdmin(userId, firstName, middleName, lastName, dob, gender, email, password, roleId, address, phoneNumber, base64Image, res) {
        try {
            let response = {
                status: 'SUCCESS',
                message: null
            }
            const admin = await PLSDBADMI.findOne({ where: { ADMIF01: userId } });
            if (!admin) {
                let response = {
                    status: 'FAIL',
                    message: 'Admin not found'
                }
                let encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                return res.status(404).json({ encryptedResponse: encryptedResponse });
            }

            const hashedPassword = encryptor.encrypt(password);

            const updatedData = {};
            if (firstName) updatedData.ADMIF02 = firstName;
            if (middleName) updatedData.ADMIF03 = middleName;
            if (lastName) updatedData.ADMIF04 = lastName;
            if (password) updatedData.ADMIF05 = hashedPassword;
            if (roleId) updatedData.ADMIF06 = roleId;
            if (email) updatedData.ADMIF07 = email;
            if (isActive) updatedData.ADMIF08 = isActive;
            if (dob) updatedData.ADMIF09 = (dob.toString()) ? dob.toString() : null;
            if (gender) updatedData.ADMIF10 = gender;
            if (address) updatedData.ADMIF12 = address;
            if (phoneNumber) updatedData.ADMIF13 = phoneNumber;
            if (base64Image) updatedData.ADMIF14 = base64Image;

            await admin.update(updatedData);

            response = {
                message: 'Admin details updated successfully'
            }
            let encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
            return res.status(200).json({ encryptedResponse: encryptedResponse });
        } catch (error) {
            console.error(error);
            response = {
                message: 'Failed to update admin'
            }
            let encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
            return res.status(500).json({ encryptedResponse: encryptedResponse });
        }
    }

    static async loginAdmin(userId, password, res) {
        try {
            let response = {
                status: 'SUCCESS',
                message: null
            }
            let admin = encryptor.encrypt(userId);
            const existingAdmin = await PLSDBADMI.findAll({
                attributes: ['ADMIF01', 'ADMIF05', 'ADMIF06']
                // where: { ADMIF01: encrypted } 
            });
            for (let i of existingAdmin) {
                const decrypted = encryptor.decrypt(i.ADMIF01)
                if (decrypted == userId) {
                    admin = i;
                    response = {
                        message: 'User ID valid'
                    }
                }
            }
            if (!admin) {
                response = {
                    message: 'Invalid UserId'
                }
                let encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                return res.status(400).json({ encryptedResponse: encryptedResponse });
            }

            let pwd = encryptor.decrypt(admin.ADMIF05);
            const isPasswordValid = pwd == password;
            if (!isPasswordValid) {
                response = {
                    message: 'Invalid Credentials'
                }
                let encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                return res.status(400).json({ encryptedResponse: encryptedResponse });
            }

            let planInfo = await PLRDBA02.findAll({
                where: {
                    A02F13: 1
                }
            });

            let oCmp = new Company();
            CmpMaster.oYear = new Year(oCmp);
            let dbconn = db.createPool('A00001CMP0031');
            let oDic = await dbconn.query('SELECT * FROM CMPM00', {
                type: QueryTypes.SELECT
            });
            let oEntD = {};
            oEntD["M00"] = oDic[0]
            let oM00 = new CmpMaster('', '', LangType, 'G', oEntD);
            oDic = await oM00.GetDictionary(null, 'A00001CMP0031', LangType, '0000');

            const token = jwt.sign(
                { adminId: admin.ADMIF01, password: admin.ADMIF05, roleId: admin.ADMIF06, corpId: 'A0-0-001' },
                process.env.JWT_SECRET_KEY,
                { expiresIn: process.env.JWT_EXPIRATION }
            );

            response = {
                data: { planInfo, csData: oDic["M00"] },
                message: 'Login successful',
                token
            }
            let encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
            return res.status(200).json({ encryptedResponse: encryptedResponse });
        } catch (error) {
            console.error(error);
            let response = {
                status: 'FAIL',
                message: 'Invalid Credentials'
            }
            let encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
            return res.status(500).json({ encryptedResponse: encryptedResponse });
        }
    }
}

class UserController {
    // Handle user actions: Register (R), Edit (E), Login (L)
    static async manageUser(req, res) {
        const parameterString = encryptor.decrypt(req.query.pa);
        let decodedParam = decodeURIComponent(parameterString);
        let pa = querystring.parse(decodedParam);
        let response = { data: null, status: "SUCCESS", message: '' };

        pa.isPassword = pa.isPassword === "true";
        let { action, corpId, userId, firstName, middleName, lastName, dob, gender, email, password, roleId, address, phoneNumber, base64Image, GUaction, grpname, companyName, isPassword, cusRole, CmpList, BrcList, cAction
            // , companyName, softSubType, softType, dbVersion, webVer, noOfUser, regDate, subStrtDate, subEndDate, cancelDate, subDomainDelDate, cnclRes, SBDdbType, srverIP, serverUserName, serverPassword, A02id 
        } = pa;


        const token = req.headers['authorization']?.split(' ')[1]; // 'Bearer <token>'

        let decoded;
        if (action != 'L' && action != 'O') {
            if (!token) {
                response.message = 'No token provided, authorization denied.'
                response.status = 'FAIL'
                const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                return res.status(401).json({ encryptedResponse });
            } else {
                decoded = await TokenService.validateToken(token, false, true);
                if (!decoded) {
                    response.message = 'Token is Expired'
                    response.status = 'FAIL'
                    const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                    return res.status(401).json({ encryptedResponse });
                }
            }
        }
        if (roleId && roleId != '2') {
            if (!token) {
                response.message = 'No token provided, authorization denied.'
                response.status = 'FAIL'
                const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                return res.status(401).json({ encryptedResponse });
            } else {
                decoded = await TokenService.validateToken(token);
            }
        }


        try {
            if (action === 'A') {
                return UserController.registerUser({
                    userId, firstName, middleName, lastName, dob, gender,
                    email, password, roleId, address, phoneNumber, base64Image, GUaction, grpname, companyName, corpId, cusRole, decoded, req, CmpList, BrcList
                }, res);
            } else if (action === 'E') {
                return UserController.updateUser({
                    userId, firstName, middleName, lastName, dob, gender,
                    email, password, isPassword, roleId, address, phoneNumber, base64Image, cusRole, CmpList, BrcList, decoded
                }, res);
            } else if (action === 'L') {
                return UserController.loginUser(corpId, userId, password, res, req);
            } else if (action === 'U') {
                return UserController.userInfo(decoded, res, req);
            } else if (action === 'D') {
                return UserController.deleteUser(decoded, userId, res);
            } else if (action === 'O') {
                return UserController.logoutUser(userId, corpId, res, cAction, req);
            }

            return res.status(400).json({ message: 'Invalid action parameter' });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: 'Server error' });
        }
    }

    static async registerUser({
        userId, firstName, middleName, lastName, dob, gender,
        email, password, roleId, address, phoneNumber, base64Image, GUaction, grpname, companyName, corpId, cusRole, req, decoded, CmpList, BrcList
    }, res) {
        try {
            if (roleId == '2') {
                let response = { status: 'SUCCESS', message: null };
                const encryptedUserId = encryptor.encrypt(userId);

                const existing = await PLSDBADMI.findAll();
                for (let i of existing) {
                    const decrypted = encryptor.decrypt(i.ADMIF01);
                    if (decrypted === userId) {
                        response.status = 'FAIL';
                        response.message = 'User ID is already registered';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                        return res.status(400).json({ encryptedResponse: encryptedResponse });
                    }
                }

                // const hashedPassword = encryptor.encrypt(password);
                // let SDBdbname = 'A' + corpNum + "SDB"
                // let admi = new ADMIController(SDBdbname);
                // const newUser = await admi.create(encryptedUserId, firstName, middleName, lastName, hashedPassword, roleId, email, dob, gender, address, phoneNumber, base64Image, BrcList, CmpList);

                // let rel = new RELController(SDBdbname)
                // if (newUser) {
                //     const newUser = await rel.create("", encryptedUserId, "", "");
                // }
                let GU = 'U';  // Default value for GU
                let GUID = '0000000';  // GUID initialization (without prefix initially)
                let usrCodeList;
                let nextNumber = 0;

                const companyResult = await CompanyService.createCompany(req, res, true);
                if (!this.existingCorpId) {
                    if (GUaction == 'G') {
                        GU = 'G';  // Change prefix to 'G'

                        // If the list is empty, start from 'G0000000'
                        if (grpCodeList.length === 0) {
                            GUID = 'G0000000';  // Initialize GUID for 'G'
                        } else {
                            // Extract the numeric part and increment it
                            let numericPart = parseInt(GUID.slice(1));  // Remove 'G' and get the number
                            GUID = GU + (numericPart + 1).toString().padStart(7, '0');  // Add 'G' and pad with zeros
                        }
                    }

                    let m81 = new M81Controller(companyResult.SDBdbname);
                    // Fetch all records for M81F05
                    let grpCodeList = await m81.findAll({},
                        ['M81F05']
                    );

                    usrCodeList = await m81.findAll({
                        M81F01: {
                            [Op.like]: 'U%'  // This will match strings that start with 'U'
                        }
                    });

                    do {
                        // Check if a user with the same GUID exists
                        usrCodeList = await m81.findAll({
                            M81F01: GUID
                        });

                        // If a user exists with that GUID, generate a new GUID
                        if (usrCodeList.length > 0) {
                            // Increment GUID by 1
                            let numericPart = parseInt(GUID.slice(1));  // Get the numeric part of GUID
                            GUID = GU + (numericPart + 1).toString().padStart(7, '0');  // Update GUID
                        } else {
                            GUID = GU + '0000000';  // Reset GUID to the default value if no user is found
                        }

                        usrCodeList = await m81.findAll(
                            { M81F01: GUID }
                        );

                    } while (usrCodeList.length > 0);  // Keep checking until GUID is unique

                    // If grpCodeList is empty, start from 'G0000000'
                    if (grpCodeList.length === 0) {
                        GUID = 'G0000000';
                    } else {
                        // Extract the numeric part and find the highest number
                        const numbers = grpCodeList
                            .map(item => {
                                const numberPart = item.M81F05.slice(1); // Remove 'G' and get the numeric part
                                return parseInt(numberPart, 10);  // Convert to integer
                            })
                            .filter(num => !isNaN(num));  // Remove NaN values

                        // Now find the maximum number and increment it
                        const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;  // If numbers is empty, maxNumber is 0
                        nextNumber = GU + (maxNumber + 1).toString().padStart(7, '0');  // Pad with zeros to maintain the format
                    }
                }

                // let cmpServ = new CompanyService()

                // Handle success or failure of company creation
                if (!companyResult.status) {
                    let admi = new ADMIController(companyResult.SDBdbname);
                    let m81 = new M81Controller(companyResult.SDBdbname);
                    const existingUser = await admi.findAll();
                    for (let i of existingUser) {
                        const decrypted = encryptor.decrypt(i.ADMIF01);
                        if (decrypted === userId) {
                            await admi.destroy({
                                ADMIF01: i.ADMIF01
                            });
                        }
                    }
                    await m81.destroy({
                        M81F01: GUID
                    });
                    return res.status(500).json(companyResult); // Make sure the response is returned here
                } else {
                    try {
                        let admin;
                        let adminId = userId;
                        let admi = new ADMIController(companyResult.SDBdbname);
                        const existingAdmin = await admi.findAll();
                        for (let i of existingAdmin) {
                            const decrypted = encryptor.decrypt(i.ADMIF01)
                            if (decrypted == adminId) {
                                admin = i;
                            }
                        }
                        let m81 = new M81Controller(companyResult.SDBdbname);
                        let M81Info = await m81.findOne({ M81UNQ: admin.ADMIF00 });

                        let cUserID = M81Info.M81F01;
                        let m82 = new M82Controller(companyResult.SDBdbname);
                        await m82.create(cUserID, parseInt(companyResult.CmpNum), '', '', '', '', '', '', '', 'Y', (new Date().getFullYear() % 100).toString(), 'A');
                        let cmp = new CMPController(companyResult.SDBdbname);
                        await cmp.create(parseInt(companyResult.CmpNum), companyName, 'SQL', 'No Group', cUserID, formatDate(new Date()), '94.176.235.105', 'aipharma_aakash', 'Aipharma@360', 'DATA', null);
                        // Fetch user info based on company name
                        let userInfo = await PLRDBA01.findOne({
                            where: { A01F02: companyName }
                        });

                        // Fetch all existing admin users
                        let existing = await admi.findAll();
                        let existingUser = null; // Variable to store the matched existing user

                        // Loop through existing users to find the one matching the userId
                        for (let i of existing) {
                            const decrypted = encryptor.decrypt(i.ADMIF01);
                            if (decrypted === userId) {
                                existingUser = i; // Set the existing user if match found
                                break; // Exit the loop once the user is found
                            }
                        }

                        if (!existingUser) {
                            return res.status(404).json({ message: 'User not found' });
                        }

                        if (userInfo) {
                            // Update the admin user if user info is found
                            await admi.update(
                                { ADMICORP: userInfo.A01F01 },
                                { ADMIF00: existingUser.ADMIF00 }
                            );
                        }
                        await PLRDBGAO.create({
                            GAOF01: companyResult.corpId,
                            GAOF02: parseInt(companyResult.CmpNum),
                            GAOF03: 2, // Customized Bill Print(Formate Wise) Free
                            GAOF04: 0,
                            GAOF05: 5, // Customized Report Setup(Report Wise) Free
                            GAOF06: 0,
                            GAOF07: 50, // User Field(Limit Wise) Free
                            GAOF08: 0,
                            GAOF09: 5, // User Master(Limit Wise) Free
                            GAOF10: 0
                        });
                        // Create a new JWT token
                        const updatedToken = jwt.sign(
                            { userId: admin.ADMIF01, corpId: companyResult.corpId },
                            process.env.JWT_SECRET_KEY,
                            { expiresIn: process.env.JWT_EXPIRATION }
                        );

                        // Prepare the success response
                        const response = {
                            status: 'SUCCESS',
                            message: 'User registered successfully And Mail Send to Registered MAIL id',
                            userId: encryptor.decrypt(admin.ADMIF01),
                            password: encryptor.decrypt(admin.ADMIF05),
                            corpId: companyResult.nextCorpId,
                            updatedToken: updatedToken
                        };

                        try {
                            const info = await sendAccountInfoMail({
                                to: admin.ADMIF07,
                                corpId: response.corpId,
                                userId: response.userId,
                                password1: response.password,
                            });
                        } catch (mailErr) {
                            console.error("❌ MAIL FAILED:", mailErr);
                        }

                        // Encrypt the response
                        const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))

                        // Return the response
                        return res.status(201).json({ encryptedResponse });

                    } catch (error) {
                        // Handle any errors that occur in the try block
                        console.error(error);
                        return res.status(500).json({ message: 'An error occurred', error: error.message });
                    }
                }
            } else if (roleId == '3') {
                let corpId = decoded.corpId;
                let sdbSeq = corpId.split('-');
                let sdbdbname = sdbSeq.length == 3 ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB' : sdbSeq[0] + sdbSeq[1] + 'SDB';
                let admi = new ADMIController(sdbdbname);
                let m81 = new M81Controller(sdbdbname);
                let m82 = new M82Controller(sdbdbname);
                let cmp = new CMPController(sdbdbname);
                let rel = new RELController(sdbdbname);
                let response = { status: 'SUCCESS', message: null };
                const encryptedUserId = encryptor.encrypt(userId);

                const existing = await admi.findAll();
                for (let i of existing) {
                    const decrypted = encryptor.decrypt(i.ADMIF01);
                    if (decrypted === userId) {
                        response.status = 'FAIL';
                        response.message = 'User ID is already registered';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                        return res.status(400).json({ encryptedResponse: encryptedResponse });
                    }
                }

                let userCorp = await PLRDBA01.findOne({
                    where: { A01F03: corpId }
                });

                let superUserDetails = await admi.findOne({
                    ADMICORP: userCorp.A01F01,
                    ADMIF06: [1, 2]
                });

                const hashedPassword = encryptor.encrypt(password);
                const newUser = await admi.create(encryptedUserId, firstName, middleName, lastName, hashedPassword, roleId, email, (dob.toString()) ? dob.toString() : null, gender, address, phoneNumber, base64Image, BrcList, CmpList, '', cusRole, superUserDetails.ADMICORP
                );

                let superUsrCorpDtl = await PLRDBA01.findOne({
                    where: { A01F01: superUserDetails.ADMICORP }
                });

                if (newUser) {
                    const newUser = await rel.create(
                        (superUserDetails.ADMICORP).trim(),
                        encryptedUserId,
                        "",
                        ""
                    );
                }
                let GU = 'U';  // Default value for GU
                let GUID = '0000000';  // GUID initialization (without prefix initially)
                let usrCodeList;
                let nextNumber = 0;

                if (!corpId) {
                    if (GUaction == 'G') {
                        GU = 'G';  // Change prefix to 'G'

                        // If the list is empty, start from 'G0000000'
                        if (grpCodeList.length === 0) {
                            GUID = 'G0000000';  // Initialize GUID for 'G'
                        } else {
                            // Extract the numeric part and increment it
                            let numericPart = parseInt(GUID.slice(1));  // Remove 'G' and get the number
                            GUID = GU + (numericPart + 1).toString().padStart(7, '0');  // Add 'G' and pad with zeros
                        }
                    }

                    // Fetch all records for M81F05
                    let grpCodeList = await m81.findAll({
                        attributes: ['M81F05']
                    });

                    usrCodeList = await m81.findAll({
                        M81F01: {
                            [Op.like]: 'U%'  // This will match strings that start with 'U'
                        }
                    });

                    do {
                        // Check if a user with the same GUID exists
                        usrCodeList = await m81.findAll({
                            where: { M81F01: GUID }
                        });

                        // If a user exists with that GUID, generate a new GUID
                        if (usrCodeList.length > 0) {
                            // Increment GUID by 1
                            let numericPart = parseInt(GUID.slice(1));  // Get the numeric part of GUID
                            GUID = GU + (numericPart + 1).toString().padStart(7, '0');  // Update GUID
                        } else {
                            GUID = GU + '0000000';  // Reset GUID to the default value if no user is found
                        }

                        usrCodeList = await m81.findAll({
                            where: { M81F01: GUID }
                        });

                    } while (usrCodeList.length > 0);  // Keep checking until GUID is unique

                    // If grpCodeList is empty, start from 'G0000000'
                    if (grpCodeList.length === 0) {
                        GUID = 'G0000000';
                    } else {
                        // Extract the numeric part and find the highest number
                        const numbers = grpCodeList
                            .map(item => {
                                const numberPart = item.M81F05.slice(1); // Remove 'G' and get the numeric part
                                return parseInt(numberPart, 10);  // Convert to integer
                            })
                            .filter(num => !isNaN(num));  // Remove NaN values

                        // Now find the maximum number and increment it
                        const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;  // If numbers is empty, maxNumber is 0
                        nextNumber = GU + (maxNumber + 1).toString().padStart(7, '0');  // Pad with zeros to maintain the format
                    }

                    await m81.create(GU, GUID, firstName + lastName, userId, password, nextNumber, grpname ? grpname : roleId == '1' ? 'Admin' : roleId == '2' || '3' ? 'User' : 'Employee', phoneNumber, email, '', '', 'A', newUser.ADMIF00, 'ABCD', usrCodeList[0].M81SID);
                } else {
                    if (GUaction == 'G') {
                        GU = 'G';  // Change prefix to 'G'

                        // If the list is empty, start from 'G0000000'
                        if (grpCodeList.length === 0) {
                            GUID = 'G0000000';  // Initialize GUID for 'G'
                        } else {
                            // Extract the numeric part and increment it
                            let numericPart = parseInt(GUID.slice(1));  // Remove 'G' and get the number
                            GUID = GU + (numericPart + 1).toString().padStart(7, '0');  // Add 'G' and pad with zeros
                        }
                    }

                    // Fetch all records for M81F05
                    let grpCodeList = await m81.findAll({}, [],
                        ['M81F05']
                    );

                    usrCodeList = await m81.findAll({
                        M81F01: {
                            [Op.like]: 'U%'  // This will match strings that start with 'U'
                        }
                    });

                    do {
                        // Check if a user with the same GUID exists
                        usrCodeList = await m81.findAll({
                            M81F01: GUID
                        });

                        // If a user exists with that GUID, generate a new GUID
                        if (usrCodeList.length > 0) {
                            // Increment GUID by 1
                            let numericPart = parseInt(GUID.slice(1));  // Get the numeric part of GUID
                            GUID = GU + (numericPart + 1).toString().padStart(7, '0');  // Update GUID
                        } else {
                            GUID = GU + '0000000';  // Reset GUID to the default value if no user is found
                        }

                        usrCodeList = await m81.findAll({
                            M81F01: GUID
                        });

                    } while (usrCodeList.length > 0);  // Keep checking until GUID is unique

                    // If grpCodeList is empty, start from 'G0000000'
                    if (grpCodeList.length === 0) {
                        GUID = 'G0000000';
                    } else {
                        // Extract the numeric part and find the highest number
                        const numbers = grpCodeList
                            .map(item => {
                                const numberPart = item.M81F05.slice(1); // Remove 'G' and get the numeric part
                                return parseInt(numberPart, 10);  // Convert to integer
                            })
                            .filter(num => !isNaN(num));  // Remove NaN values

                        // Now find the maximum number and increment it
                        const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;  // If numbers is empty, maxNumber is 0
                        nextNumber = GU + (maxNumber + 1).toString().padStart(7, '0');  // Pad with zeros to maintain the format
                    }

                    await m81.create(GU, GUID, firstName + lastName, userId, password, nextNumber, grpname ? grpname : roleId == '1' ? 'Admin' : roleId == '2' || '3' ? 'User' : 'Employee', phoneNumber, email, '', '', 'A', '', newUser.ADMIF00);
                }
                response.status = 'SUCCESS';
                const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                return res.status(201).json({ encryptedResponse: encryptedResponse })
            }
        }
        catch (error) {
            console.error(error);
            const encryptedResponse = encryptor.encrypt(JSON.stringify({ message: 'User registration failed' }));
            return res.status(500).json({ encryptedResponse: encryptedResponse });
        }
    }

    static async updateUser({
        userId, updatedUserId, firstName, middleName, lastName, dob, gender,
        email, password, isPassword, roleId, address, phoneNumber, base64Image, cusRole, CmpList, BrcList, decoded
    }, res) {
        try {
            let corpId = decoded.corpId.toUpperCase();
            let sdbSeq = corpId.split('-');
            let sdbdbname = sdbSeq.length == 3 ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB' : sdbSeq[0] + sdbSeq[1] + 'SDB';
            let admi = new ADMIController(sdbdbname);
            let m81 = new M81Controller(sdbdbname);
            let response = { status: 'SUCCESS', message: null };
            const encryptedUserId = encryptor.encrypt(userId);
            let existingUser;

            const existing = await admi.findAll();
            // Check if the user exists in the database
            for (let i of existing) {
                const decrypted = encryptor.decrypt(i.ADMIF01)
                if (decrypted == userId) {
                    existingUser = i;
                }
            }

            if (!existingUser) {
                response.status = 'FAIL';
                response.message = 'User not found';
                const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }));
                return res.status(404).json({ encryptedResponse: encryptedResponse });
            }

            // if (existingUser.ADMIF06 == 2) {
            //     response.status = 'FAIL';
            //     response.message = 'Main User ';
            //     const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }));
            //     return res.status(404).json({ encryptedResponse: encryptedResponse });
            // }

            let updateData;
            if (isPassword) {

                let hashedPassword = encryptor.encrypt(password);

                // Prepare updated fields
                updateData = {
                    ADMIF02: firstName || existingUser.ADMIF02, // First Name
                    ADMIF03: middleName || existingUser.ADMIF03, // Middle Name
                    ADMIF04: lastName || existingUser.ADMIF04, // Last Name
                    ADMIF05: hashedPassword,
                    ADMIF06: roleId || existingUser.ADMIF06,
                    ADMIF07: email || existingUser.ADMIF07, // Email
                    ADMIF09: dob ? dob == 'null' ? null : dob.toString() : existingUser.ADMIF09, // Date of Birth
                    ADMIF10: gender || existingUser.ADMIF10, // Gender
                    ADMIF12: address || existingUser.ADMIF12, // Address
                    ADMIF13: phoneNumber || existingUser.ADMIF13, // Phone Number
                    ADMIF14: base64Image || existingUser.ADMIF14, // Base64 Image
                    ADMIROL: cusRole,
                    ADMIBRC: BrcList,
                    ADMICOMP: CmpList
                };
                await m81.update({
                    M81F04: password
                }, {
                    M81UNQ: existingUser.ADMIF00
                })
            } else {
                updateData = {
                    ADMIF02: firstName || existingUser.ADMIF02, // First Name
                    ADMIF03: middleName || existingUser.ADMIF03, // Middle Name
                    ADMIF04: lastName || existingUser.ADMIF04, // Last Name
                    ADMIF06: roleId || existingUser.ADMIF06,
                    ADMIF07: email || existingUser.ADMIF07, // Email
                    ADMIF09: dob ? dob == 'null' ? null : dob.toString() : existingUser.ADMIF09, // Date of Birth
                    ADMIF10: gender || existingUser.ADMIF10, // Gender
                    ADMIF12: address || existingUser.ADMIF12, // Address
                    ADMIF13: phoneNumber || existingUser.ADMIF13, // Phone Number
                    ADMIF14: base64Image || existingUser.ADMIF14, // Base64 Image
                    ADMIROL: cusRole,
                    ADMIBRC: BrcList,
                    ADMICOMP: CmpList
                };
            }

            // // If password is provided, hash and update it
            // if (password) {
            //     const hashedPassword = encryptor.encrypt(password);
            //     updateData.ADMIF05 = hashedPassword;
            // }

            // Update the user data in the database
            await admi.update(updateData, {
                ADMIF00: existingUser.ADMIF00
            });
            // if (cusRole) {
            //     await admi.update(
            //         {
            //             ADMIROL: cusRole
            //         }, {
            //         where: { ADMIF01: encryptedUserId }
            //     });
            // }

            response.message = 'User updated successfully';

            const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }));
            return res.status(200).json({ encryptedResponse: encryptedResponse });

        } catch (error) {
            console.error(error);
            const encryptedResponse = encryptor.encrypt(JSON.stringify({ message: 'User update failed' }));
            return res.status(500).json({ encryptedResponse: encryptedResponse });
        }
    }

    static async loginUser(corpId, userId, password, res, req) {
        try {
            let response = { status: 'SUCCESS', message: null };
            corpId = corpId.toUpperCase();
            let corpexi = await PLRDBA01.findAll({
                where: { A01F03: corpId }
            });
            if (corpexi.length == 0) {
                response.status = 'FAIL';
                response.message = 'Invalid Credentials';
                const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                return res.status(400).json({ encryptedResponse: encryptedResponse });
            }
            let sdbSeq = corpId.split('-');
            let sdbdbname = sdbSeq.length == 3 ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB' : sdbSeq[0] + sdbSeq[1] + 'SDB';
            if (sdbdbname) sdbdbname = sdbdbname == 'PLP00001SDB' ? 'A00001SDB' : sdbdbname
            let admi = new ADMIController(sdbdbname);
            let m81 = new M81Controller(sdbdbname);
            let m83 = new M83Controller(sdbdbname);
            const encryptedId = encryptor.encrypt(userId);
            let corpRow = null;
            let user = null
            const existing = await admi.findAll();
            for (let i of existing) {
                const decrypted = encryptor.decrypt(i.ADMIF01)
                if (decrypted == userId) {
                    user = i;
                    response = {
                        message: 'User ID valid'
                    }
                }
            }

            if (!user) {
                response.status = 'FAIL';
                response.message = 'Invalid Credentials';
                const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                return res.status(400).json({ encryptedResponse: encryptedResponse });
            }

            let loginExist = await m83.findAll();
            for (let i of loginExist) {
                if (userId == i.M83F01) {
                    let token = i.M83F07
                    let tokenLife = jwt.decode(token);
                    if (tokenLife) {
                        // Check if token has expired manually
                        const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
                        const isExpired = tokenLife.exp && tokenLife.exp < currentTime;

                        if (isExpired) {
                            await m83.destroy({
                                M83F01: userId
                            });
                        } else {
                            response.status = 'FAIL';
                            response.message = 'User already Logged in';
                            response.data = user;
                            let encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                            return res.status(200).json({ encryptedResponse: encryptedResponse });
                        }
                    } else {
                        console.log("Invalid token.");
                    }
                }
            }
            // if (loginExist.length > 0) {
            //     for (const row of loginExist) {

            //     }
            // }

            if (user.ADMIF06 == 2) {
                let corpUnq = user.ADMICORP
                let userM81Unq = user.ADMIF00

                let corpExist = await PLRDBA01.findAll({
                    where: { A01F01: corpUnq.trim() }
                });

                let M81Row
                if (corpUnq == 1) {
                    M81Row = await m81.findAll({
                        M81CHLD: userM81Unq
                    });
                } else {
                    M81Row = await m81.findAll({
                        M81UNQ: userM81Unq
                    });
                }

                let uM82Row = M81Row.length > 0 ? M81Row[0].M81F01 : null;

                if (!corpExist) {
                    response.status = 'FAIL';
                    response.message = 'Invalid Credentials';
                    const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                    return res.status(400).json({ encryptedResponse: encryptedResponse });
                } else {
                    for (const corp of corpExist) {
                        if (corp.A01F03.trim() == corpId) {
                            corpRow = corp
                        }
                    }
                    if (!corpRow) {
                        response.status = 'FAIL';
                        response.message = 'Invalid Credentials';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                        return res.status(400).json({ encryptedResponse: encryptedResponse });
                    }
                }
                let pwd = encryptor.decrypt(user.ADMIF05);
                const isPasswordValid = pwd == password;
                if (!isPasswordValid) {
                    response.status = 'FAIL';
                    response.message = 'Invalid Credentials';
                    let encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                    return res.status(400).json({ encryptedResponse: encryptedResponse });
                }

                // let userComp = new AuthenticationService(corpId, uM82Row, sdbdbname);
                // let cmplist = await userComp.authenticateUser();



                const token = jwt.sign({ userId: user.ADMIF01, roleId: user.ADMIF06, password: user.ADMIF05, corpId: corpId }, process.env.JWT_SECRET_KEY, { expiresIn: process.env.JWT_EXPIRATION });

                // response.data = {
                //     CustID: corpId,
                //     CustName: user.ADMIF02 + ' ' + user.ADMIF04,
                //     SubSDate: corpRow.A01F12,
                //     SubEDate: corpRow.A01F13,
                //     SoftVer: corpRow.A01F07,
                //     UserId: M81Row.M81F01,
                //     userNm: encryptor.decrypt(user.ADMIF01),
                //     DefCmp: cmplist.DefComp.cmpNo,
                //     cmpList: cmplist.CompList
                // };
                let currentTime = new Date();
                let newLogin = await m83.create(userId, formatDate(currentTime), '', '', '', token);
                response.message = 'Login successful';
                response.token = token;
                response.status = 'SUCCESS'
                const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                return res.status(200).json({ encryptedResponse: encryptedResponse });

            } else if (user.ADMIF06 == 3) {
                let corpUnq = user.ADMICORP

                let corpExist = await PLRDBA01.findAll({
                    where: { A01F01: corpUnq }
                });
                // let sprUsr;
                // for (let i of existing) {
                //     const decrypted = encryptor.decrypt(i.ADMIF01)
                //     if (i.ADMICORP == user.ADMICORP && i.ADMIF06 == 2) {
                //         sprUsr = i;
                //         response = {
                //             message: 'User ID valid'
                //         }
                //     }
                // }
                // let userM81Unq = sprUsr.ADMIF00

                // let M81Row = await m81.findAll({
                //     M81UNQ: userM81Unq.toString()
                // });

                // let uM82Row = M81Row.length > 0 ? M81Row[0].M81F01 : null;

                if (!corpExist) {
                    response.status = 'FAIL';
                    response.message = 'Invalid Credentials';
                    const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                    return res.status(400).json({ encryptedResponse: encryptedResponse });
                } else {
                    for (const corp of corpExist) {
                        if ((corp.A01F03).trim() == corpId) {
                            corpRow = corp
                        }
                    }
                    if (!corpRow) {
                        response.status = 'FAIL';
                        response.message = 'Invalid Credentials';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                        return res.status(400).json({ encryptedResponse: encryptedResponse });
                    }
                }
                let pwd = encryptor.decrypt(user.ADMIF05);
                const isPasswordValid = pwd == password;
                if (!isPasswordValid) {
                    response.status = 'FAIL';
                    response.message = 'Invalid Credentials';
                    let encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                    return res.status(400).json({ encryptedResponse: encryptedResponse });
                }

                // let userComp = new AuthenticationService(corpId, uM82Row, sdbdbname);
                // let cmplist = await userComp.authenticateUser();
                // let usrCompList = [];

                // if (user.ADMIROL != 2) {
                //     let assgncmpArray = user.ADMICOMP; // Assuming ADMICOMP is already an array or it's a string that's split elsewhere

                //     for (const cmp of cmplist.CompList) {
                //         if (assgncmpArray.includes(cmp.cmpNo)) {
                //             usrCompList.push(cmp); // Push the whole cmp object into the list
                //         }
                //     }
                // }

                // let modData = await admi.findOne({ ADMIF06: 2 }, [], ['ADMIMOD']);

                const token = jwt.sign({ userId: user.ADMIF01, roleId: user.ADMIF06, password: user.ADMIF05, corpId: corpId }, process.env.JWT_SECRET_KEY, { expiresIn: process.env.JWT_EXPIRATION });

                let currentTime = new Date();
                let newLogin = await m83.create(userId, formatDate(currentTime), '', '', '', token);

                // response.data = {
                //     CustID: corpId,
                //     CustName: user.ADMIF02 + ' ' + user.ADMIF04,
                //     SubSDate: corpRow.A01F12,
                //     SubEDate: corpRow.A01F13,
                //     SoftVer: corpRow.A01F07,
                //     UserId: M81Row.M81F01,
                //     userNm: encryptor.decrypt(user.ADMIF01),
                //     DefCmp: cmplist.DefComp.cmpNo,
                //     cmpList: usrCompList,
                //     userDetails: user,
                //     modData: modData
                // };
                response.message = 'Login successful';
                response.token = token;
                response.status = 'SUCCESS'
                const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                return res.status(200).json({ encryptedResponse: encryptedResponse });
            }
        } catch (error) {
            console.error(error);
            const encryptedResponse = encryptor.encrypt(JSON.stringify({ message: 'Login failed' }));
            return res.status(500).json({ encryptedResponse: encryptedResponse });
        }
    }

    static async userInfo(decoded, res, req) {
        try {
            let response = { status: 'SUCCESS', message: null };
            let corpId = decoded.corpId;
            let userId = decoded.userId;
            let password = decoded.password;
            corpId = corpId.toUpperCase();
            let corpexi = await PLRDBA01.findAll({
                where: { A01F03: corpId }
            });
            if (corpexi.length == 0) {
                response.status = 'FAIL';
                response.message = 'Invalid Credentials';
                const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                return res.status(400).json({ encryptedResponse: encryptedResponse });
            }
            let sdbSeq = corpId.split('-');
            let sdbdbname = sdbSeq.length == 3 ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB' : sdbSeq[0] + sdbSeq[1] + 'SDB';
            if (sdbdbname) sdbdbname = sdbdbname == 'PLP00001SDB' ? 'A00001SDB' : sdbdbname
            let admi = new ADMIController(sdbdbname);
            let m81 = new M81Controller(sdbdbname);
            let m83 = new M83Controller(sdbdbname);
            const encryptedId = encryptor.decrypt(userId);
            let corpRow = null;
            let user = null
            const existing = await admi.findAll();
            for (let i of existing) {
                const decrypted = encryptor.decrypt(i.ADMIF01)
                if (decrypted == encryptedId) {
                    user = i;
                    response = {
                        message: 'User ID valid'
                    }
                }
            }

            // if (!user) {
            //     response.status = 'FAIL';
            //     response.message = 'Invalid Credentials';
            //     const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
            //     return res.status(400).json({ encryptedResponse: encryptedResponse });
            // }

            // let loginExist = await m83.findAll();
            // for (let i of loginExist) {
            //     if (userId == i.M83F01) {
            //         let token = i.M83F07
            //         let tokenLife = jwt.decode(token);
            //         if (tokenLife) {
            //             // Check if token has expired manually
            //             const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
            //             const isExpired = tokenLife.exp && tokenLife.exp < currentTime;

            //             if (isExpired) {
            //                 await m83.destroy({
            //                     where: { M83F01: userId }
            //                 });
            //             } else {
            //                 response.status = 'FAIL';
            //                 response.message = 'User already Logged in'
            //                 let encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
            //                 return res.status(200).json({ encryptedResponse: encryptedResponse });
            //             }
            //         } else {
            //             console.log("Invalid token.");
            //         }
            //     }
            // }
            // if (loginExist.length > 0) {
            //     for (const row of loginExist) {

            //     }
            // }

            if (user.ADMIF06 == 2) {
                let corpUnq = user.ADMICORP
                let userM81Unq = user.ADMIF00

                let corpExist = await PLRDBA01.findAll({
                    where: { A01F01: corpUnq.trim() }
                });

                let M81Row
                if (corpUnq == 1) {
                    M81Row = await m81.findAll({
                        M81CHLD: userM81Unq
                    });
                } else {
                    M81Row = await m81.findAll({
                        M81UNQ: userM81Unq
                    });
                }

                let uM82Row = M81Row.length > 0 ? M81Row[0].M81F01 : null;

                if (!corpExist) {
                    response.status = 'FAIL';
                    response.message = 'Invalid Credentials';
                    const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                    return res.status(400).json({ encryptedResponse: encryptedResponse });
                } else {
                    for (const corp of corpExist) {
                        if (corp.A01F03.trim() == corpId) {
                            corpRow = corp
                        }
                    }
                    if (!corpRow) {
                        response.status = 'FAIL';
                        response.message = 'Invalid Credentials';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                        return res.status(400).json({ encryptedResponse: encryptedResponse });
                    }
                }
                // let pwd = encryptor.decrypt(user.ADMIF05);
                // const isPasswordValid = pwd == password;
                // if (!isPasswordValid) {
                //     response.status = 'FAIL';
                //     response.message = 'Invalid Credentials';
                //     let encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                //     return res.status(400).json({ encryptedResponse: encryptedResponse });
                // }

                let userComp = new AuthenticationService(corpId, uM82Row, sdbdbname);
                let cmplist = await userComp.authenticateUser();



                // const token = jwt.sign({ userId: user.ADMIF01, roleId: user.ADMIF06, password: user.ADMIF05, corpId: corpId }, process.env.JWT_SECRET_KEY, { expiresIn: process.env.JWT_EXPIRATION });

                response.data = {
                    CustID: corpId,
                    CustName: user.ADMIF02 + ' ' + user.ADMIF04,
                    SubSDate: corpRow.A01F12,
                    SubEDate: corpRow.A01F13,
                    SoftVer: corpRow.A01F07,
                    UserId: M81Row.M81F01,
                    userNm: encryptor.decrypt(user.ADMIF01),
                    DefCmp: cmplist.DefComp.cmpNo,
                    cmpList: cmplist.CompList,
                    purchasedSetUpIds: M81Row[0].M81SID
                };
                // let currentTime = new Date();
                // let newLogin = await m83.create(userId, formatDate(currentTime), '', '', '', token);
                response.message = 'Login successful';
                // response.token = token;
                response.status = 'SUCCESS'
                const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                return res.status(200).json({ encryptedResponse: encryptedResponse });

            } else if (user.ADMIF06 == 3) {
                let corpUnq = user.ADMICORP

                let corpExist = await PLRDBA01.findAll({
                    where: { A01F01: corpUnq }
                });
                let sprUsr;
                for (let i of existing) {
                    const decrypted = encryptor.decrypt(i.ADMIF01)
                    if (i.ADMICORP == user.ADMICORP && i.ADMIF06 == 2) {
                        sprUsr = i;
                        response = {
                            message: 'User ID valid'
                        }
                    }
                }
                let userM81Unq = sprUsr.ADMIF00

                let M81Row = await m81.findAll({
                    M81UNQ: userM81Unq.toString()
                });

                let uM82Row = M81Row.length > 0 ? M81Row[0].M81F01 : null;

                if (!corpExist) {
                    response.status = 'FAIL';
                    response.message = 'Invalid Credentials';
                    const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                    return res.status(400).json({ encryptedResponse: encryptedResponse });
                } else {
                    for (const corp of corpExist) {
                        if ((corp.A01F03).trim() == corpId) {
                            corpRow = corp
                        }
                    }
                    if (!corpRow) {
                        response.status = 'FAIL';
                        response.message = 'Invalid Credentials';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                        return res.status(400).json({ encryptedResponse: encryptedResponse });
                    }
                }
                // let pwd = encryptor.decrypt(user.ADMIF05);
                // const isPasswordValid = pwd == password;
                // if (!isPasswordValid) {
                //     response.status = 'FAIL';
                //     response.message = 'Invalid Credentials';
                //     let encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                //     return res.status(400).json({ encryptedResponse: encryptedResponse });
                // }

                let userComp = new AuthenticationService(corpId, uM82Row, sdbdbname);
                let cmplist = await userComp.authenticateUser();
                let usrCompList = [];

                if (user.ADMIROL != 2) {
                    let assgncmpArray = (user.ADMICOMP).split(','); // Assuming ADMICOMP is already an array or it's a string that's split elsewhere

                    for (const cmp of cmplist.CompList) {
                        if (assgncmpArray.includes(String(cmp.cmpNo))) {
                            usrCompList.push(cmp); // Push the whole cmp object into the list
                        }
                    }
                }

                let modData = await admi.findOne({ ADMIF06: 2 }, [], ['ADMIMOD']);

                // const token = jwt.sign({ userId: user.ADMIF01, roleId: user.ADMIF06, password: user.ADMIF05, corpId: corpId }, process.env.JWT_SECRET_KEY, { expiresIn: process.env.JWT_EXPIRATION });

                // let currentTime = new Date();
                // let newLogin = await m83.create(userId, formatDate(currentTime), '', '', '', token);

                response.data = {
                    CustID: corpId,
                    CustName: user.ADMIF02 + ' ' + user.ADMIF04,
                    SubSDate: corpRow.A01F12,
                    SubEDate: corpRow.A01F13,
                    SoftVer: corpRow.A01F07,
                    UserId: M81Row.M81F01,
                    userNm: encryptor.decrypt(user.ADMIF01),
                    DefCmp: cmplist.DefComp.cmpNo,
                    cmpList: usrCompList,
                    userDetails: user,
                    modData: modData,
                    purchasedSetUpIds: M81Row[0].M81SID
                };
                response.message = 'Login successful';
                // response.token = token;
                response.status = 'SUCCESS'
                const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                return res.status(200).json({ encryptedResponse: encryptedResponse });
            }
        } catch (error) {
            console.error(error);
            const encryptedResponse = encryptor.encrypt(JSON.stringify({ message: 'Login failed' }));
            return res.status(500).json({ encryptedResponse: encryptedResponse });
        }
    }

    static async logoutUser(userId, corpId, res, cAction, req) {
        try {
            let response = { status: 'SUCCESS', message: null };
            corpId = corpId.toUpperCase();
            let corpexi = await PLRDBA01.findAll({
                where: { A01F03: corpId }
            });
            if (corpexi.length == 0) {
                response.status = 'FAIL';
                response.message = 'Invalid Credentials';
                const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                return res.status(400).json({ encryptedResponse: encryptedResponse });
            }
            let sdbSeq = corpId.split('-');
            let sdbdbname = sdbSeq.length == 3 ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB' : sdbSeq[0] + sdbSeq[1] + 'SDB';
            if (sdbdbname) sdbdbname = sdbdbname == 'PLP00001SDB' ? 'A00001SDB' : sdbdbname
            let admi = new ADMIController(sdbdbname);
            let m81 = new M81Controller(sdbdbname);
            let m83 = new M83Controller(sdbdbname);
            let corpRow = null;
            let user = null
            const existing = await admi.findAll();
            // const decryptedUser = encryptor.decrypt(decoded.userId);
            for (let i of existing) {
                const decrypted = encryptor.decrypt(i.ADMIF01);
                if (decrypted == userId) {
                    user = i;
                    response = {
                        message: 'User ID valid'
                    }
                }
            }

            if (!user) {
                response.status = 'FAIL';
                response.message = 'Invalid Credentials';
                const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                return res.status(400).json({ encryptedResponse: encryptedResponse });
            }

            if (cAction) {
                if (cAction == 'L') {
                    let decPass = encryptor.decrypt(user.ADMIF05)
                    let paObj = { "CorpID": `${corpId}`, "cUser": `${userId}`, "cPass": `${decPass}`, "lForce": false }
                    let encodedUrl = encodeURIComponent(JSON.stringify(paObj));
                    let encUrl = encryptor.encrypt(encodedUrl);
                    let logOutReq = await axios.get(`https://kishanlive.in/eplus/api/User/LogoutNotify/?pa=${encUrl}`);
                    if (logOutReq) {
                        let resp = encryptor.decrypt(logOutReq.data);
                        resp = JSON.parse(resp);
                        if (resp.status == 'SUCCESS') {
                            response.message = 'Logout request sent Successfully, Please try again in few seconds';
                            response.status = 'SUCCESS';
                            const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                            return res.status(200).json({ encryptedResponse: encryptedResponse });
                        } else {
                            response.message = 'Logout request Error occured.';
                            response.status = 'FAIL';
                            const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                            return res.status(200).json({ encryptedResponse: encryptedResponse });
                        }
                    } else {
                        response.message = 'Error occured in Logout request';
                        response.status = 'FAIL';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                        return res.status(200).json({ encryptedResponse: encryptedResponse });
                    }
                } else if (cAction == 'F') {
                    let decPass = encryptor.decrypt(user.ADMIF05)
                    let paObj = { "CorpID": `${corpId}`, "cUser": `${userId}`, "cPass": `${decPass}`, "lForce": true }
                    let encodedUrl = encodeURIComponent(JSON.stringify(paObj))
                    let encUrl = encryptor.encrypt(encodedUrl);
                    let logOutReq = await axios.get(`https://kishanlive.in/eplus/api/User/LogoutNotify/?pa=${encUrl}`);
                    if (logOutReq) {
                        let resp = encryptor.decrypt(logOutReq.data);
                        resp = JSON.parse(resp);
                        await m83.destroy({
                            M83F01: userId
                        });
                        if (resp.status == 'SUCCESS') {
                            response.message = 'Logout request sent Successfully';
                            response.status = 'SUCCESS';
                            const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                            return res.status(200).json({ encryptedResponse: encryptedResponse });
                        } else {
                            response.message = 'Logout request Error occured.';
                            response.status = 'FAIL';
                            const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                            return res.status(200).json({ encryptedResponse: encryptedResponse });
                        }
                    } else {
                        response.message = 'Error occured in Logout request';
                        response.status = 'FAIL';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                        return res.status(200).json({ encryptedResponse: encryptedResponse });
                    }
                }
            }

            let loginExist = await m83.findAll();
            let lLog = null;
            for (let i of loginExist) {
                if (userId == i.M83F01) {
                    lLog = await m83.destroy({
                        M83F01: userId
                    });
                }
            }
            if (lLog != null) {
                response.message = 'Logout Successful';
                response.status = 'SUCCESS';
                const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                return res.status(200).json({ encryptedResponse: encryptedResponse });
            } else {
                response.message = 'User is not logged in';
                response.status = 'FAIL';
                const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                return res.status(200).json({ encryptedResponse: encryptedResponse });
            }
        } catch (error) {
            console.error(error);
            const encryptedResponse = encryptor.encrypt(JSON.stringify({ message: 'Login failed' }));
            return res.status(500).json({ encryptedResponse: encryptedResponse });
        }
    }

    static async deleteUser(decoded, userId, res) {

        let corpId = decoded.corpId.toUpperCase();
        let sdbSeq = corpId.split('-');
        let sdbdbname = sdbSeq.length == 3 ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB' : sdbSeq[0] + sdbSeq[1] + 'SDB';
        let admi = new ADMIController(sdbdbname);
        let m81 = new M81Controller(sdbdbname);
        let user;
        let response = { status: 'SUCCESS', message: null };

        const existing = await admi.findAll();
        for (let i of existing) {
            const decrypted = encryptor.decrypt(i.ADMIF01);
            if (decrypted === userId) {
                user = i;
            }
        }
        if (!user) {
            response.status = 'FAIL';
            response.message = 'User Does Not Exist';
            const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
            return res.status(400).json({ encryptedResponse: encryptedResponse });
        }
        let usrM81 = await m81.findOne({
            M81UNQ: user.ADMIF00
        })
        let crnum = (decoded.corpId).split('-')
        let SDBdbname = crnum[0] + crnum[1] + crnum[2] + "SDB";
        let cmplst = user.ADMICOMP;
        if (cmplst) {
            let cmpnumbers = cmplst.split(',')
            for (const cnum of cmpnumbers) {
                let CmpNo = cnum;
                let dbName = queryService.generateDatabaseName(decoded.corpId, CmpNo);
                let dbConn = db.createPool(dbName);
                let m82 = new M82Controller(SDBdbname);
                let cmpdet = await m82.findOne({ M82F02: parseInt(CmpNo) });
                let defYr = cmpdet.M82YRN;
                let listOfYr = await dbConn.query('SELECT FIELD01 FROM CMPF01', {
                    type: QueryTypes.SELECT
                });
                let connectedRows;
                if (listOfYr) {
                    for (const ly of listOfYr) {
                        connectedRows = await dbConn.query(`SELECT * FROM YR${ly.FIELD01}T82 WHERE FIELD02 = '${usrM81.M81F01}'`, {
                            type: QueryTypes.SELECT
                        });
                        if (connectedRows.length > 0) {
                            response.message = 'This Company Contains Transaction so it can not be deleted';
                            response.status = 'FAIL'
                            let encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                            return res.status(200).json({ encryptedResponse });
                        }
                    }
                }
            }
        }

        if (user.ADMIF06 == 2) {
            response.status = 'FAIL';
            response.message = 'Admin User Can Not be Deleted';
            const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
            return res.status(400).json({ encryptedResponse: encryptedResponse });
        }

        let deleteUsr = await m81.update({
            M81ADA: 'D'
        }, {
            M81UNQ: user.ADMIF00
        })

        if (deleteUsr) {
            response.status = 'SUCCESS';
            response.message = 'User ID Deleted Successfully';
            const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
            return res.status(200).json({ encryptedResponse: encryptedResponse });
        }
    }

    static async forgotPasswordByCorp(req, res) {
        try {
            let response = { status: 'SUCCESS', message: null };

            let { corpId } = req.body;

            if (!corpId || typeof corpId !== "string") {
                response.status = 'FAIL';
                response.message = 'Invalid Corporate ID';
                const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }));
                return res.status(400).json({ encryptedResponse });
            }

            corpId = corpId.toUpperCase();

            const corpRows = await PLRDBA01.findAll({
                where: { A01F03: corpId }
            });

            if (corpRows.length === 0) {
                response.status = 'FAIL';
                response.message = 'Corporate not found';
                const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }));
                return res.status(400).json({ encryptedResponse });
            }

            const corpUnq = corpRows[0].A01F01;

            const sdbSeq = corpId.split('-');
            let sdbdbname = sdbSeq.length == 3 ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB' : sdbSeq[0] + sdbSeq[1] + 'SDB';
            const admi = new ADMIController(sdbdbname);

            const admins = await admi.findAll({
                ADMICORP: corpUnq,
                ADMIF06: { [Op.in]: [1, 2] }
            });

            if (!admins || admins.length === 0) {
                response.status = 'FAIL';
                response.message = 'No admin found';
                const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }));
                return res.status(400).json({ encryptedResponse });
            }

            for (const admin of admins) {
                if (!admin.ADMIF07) continue;

                await sendAccountInfoMail({
                    to: admin.ADMIF07,
                    corpId,
                    userName: encryptor.decrypt(admin.ADMIF01),
                    password: encryptor.decrypt(admin.ADMIF05),
                });
            }

            response.message = "Account information sent to your email successfully";
            const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }));
            return res.status(200).json({ encryptedResponse });

        } catch (err) {
            console.error(err);
            const encryptedResponse = encryptor.encrypt(JSON.stringify({ message: "Forgot password failed" }));
            return res.status(500).json({ encryptedResponse });
        }
    }

    static async sendOtpByCorp(req, res) {
        const parameterString = encryptor.decrypt(req.body.pa);
        let decodedParam = decodeURIComponent(parameterString);
        let pa = JSON.parse(decodedParam);
        let response = { status: "SUCCESS", message: null };
        try {
            // let pa = querystring.parse(decodedParam);
            let { corpId, descType } = pa;

            if (!corpId) {
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        response: { status: "FAIL", code: "CORP_REQUIRED", message: "corpId is required" }
                    }))
                });
            }

            corpId = corpId.toUpperCase();

            const corp = await PLRDBA01.findOne({ where: { A01F03: corpId } });

            if (!corp) {
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        response: { status: "FAIL", code: "CORP_NOT_FOUND", message: "Corporate not found" }
                    }))
                });
            }

            const corpUnq = corp.A01F01.trim();
            const sdbSeq = corpId.split('-');
            let sdbdbname = sdbSeq.length == 3 ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB' : sdbSeq[0] + sdbSeq[1] + 'SDB';
            const admi = new ADMIController(sdbdbname);

            const admins = await admi.findAll({
                ADMICORP: corpUnq,
                ADMIF06: { [Op.in]: [1, 2] }
            });

            if (!admins.length) {
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        response: { status: "FAIL", code: "ADMIN_NOT_FOUND", message: "No admin found" }
                    }))
                });
            }

            const adminEmail = admins[0].ADMIF07;

            const otp = Math.floor(100000 + Math.random() * 900000).toString();

            if (descType == 'F') {
                await PLRDBOTP.create({
                    CORP_ID: corpId,
                    EMAIL: adminEmail,
                    OTP_CODE: otp,
                    OTP_EXPIRY: Sequelize.literal(`DATEADD(MINUTE, 10, GETDATE())`),
                    OTP_STATUS: 'PENDING',
                    OTP_DESC: 'FP'
                });
                await sendResetMail({ to: adminEmail, corpId, otp });
            } else if (descType == 'L') {
                await PLRDBOTP.create({
                    CORP_ID: corpId,
                    EMAIL: adminEmail,
                    OTP_CODE: otp,
                    OTP_EXPIRY: Sequelize.literal(`DATEADD(MINUTE, 10, GETDATE())`),
                    OTP_STATUS: 'PENDING',
                    OTP_DESC: 'LO'
                });
                await sendLogOutMail({ to: adminEmail, corpId, otp });
            } else {
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        response: { status: "FAIL", message: "Invalid Desc Type" }
                    }))
                })
            }

            let userId = encryptor.decrypt(admins[0].ADMIF01);
            let password = encryptor.decrypt(admins[0].ADMIF05);
            const token = jwt.sign({ corpId, userId, password }, process.env.JWT_SECRET_KEY, {
                expiresIn: process.env.JWT_EXPIRATION
            });

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    response: {
                        status: "SUCCESS",
                        code: "OTP_SENT",
                        message: "OTP sent successfully",
                        token
                    }
                }))
            });

        } catch (err) {
            console.error("SEND OTP ERROR:", err);
            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    response: { status: "FAIL", code: "SERVER_ERROR", message: "OTP sending failed" }
                }))
            });
        }
    }

    static async verifyOtp(req, res) {
        const parameterString = encryptor.decrypt(req.body.pa);
        let decodedParam = decodeURIComponent(parameterString);
        let pa = JSON.parse(decodedParam);
        try {
            const token = req.headers['authorization']?.split(' ')[1];

            if (!token) {
                return res.status(401).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        response: { status: "FAIL", code: "TOKEN_MISSING", message: "Token required" }
                    }))
                });
            }

            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
            } catch (err) {
                return res.status(401).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        response: { status: "FAIL", code: "TOKEN_INVALID", message: "Invalid or expired token" }
                    }))
                });
            }

            const corpId = decoded.corpId;
            const { otp } = pa;

            if (!otp) {
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        response: { status: "FAIL", code: "OTP_REQUIRED", message: "OTP is required" }
                    }))
                });
            }

            const otpRow = await PLRDBOTP.findOne({
                where: { CORP_ID: corpId, OTP_CODE: otp },
                order: [['OTPID', 'DESC']]
            });

            if (!otpRow) {
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        response: { status: "FAIL", code: "OTP_INVALID", message: "Invalid OTP" }
                    }))
                });
            }

            if (otpRow.OTP_STATUS === 'EXPIRED' || new Date(otpRow.OTP_EXPIRY) < new Date()) {
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        response: { status: "FAIL", code: "OTP_EXPIRED", message: "OTP expired" }
                    }))
                });
            }

            if (otpRow.OTP_STATUS === 'VERIFIED') {
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        response: { status: "FAIL", code: "OTP_USED", message: "OTP already used" }
                    }))
                });
            }

            if (otpRow.OTP_DESC == 'LO') {
                let sdbSeq = corpId.split('-');
                let sdbdbname = sdbSeq.length == 3 ? `${sdbSeq[0]}${sdbSeq[1]}${sdbSeq[2]}SDB` : `${sdbSeq[0]}${sdbSeq[1]}SDB`;
                let m83 = new M83Controller(sdbdbname);
                await m83.destroy({
                    M83F01: decoded.userId
                });
                let paObj = { "CorpID": `${decoded.corpId}`, "cUser": `${decoded.userId}`, "cPass": `${decoded.password}`, "lForce": true }
                let encodedUrl = encodeURIComponent(JSON.stringify(paObj))
                let encUrl = encryptor.encrypt(encodedUrl);
                let logOutReq = await axios.get(`https://kishanlive.in/eplus/api/User/LogoutNotify/?pa=${encUrl}`);
                if (logOutReq) {
                    let resp = encryptor.decrypt(logOutReq.data);
                    resp = JSON.parse(resp);
                    if (resp.status != 'SUCCESS') {
                        response.message = 'Logout request Error occured.';
                        response.status = 'FAIL';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                        return res.status(200).json({ encryptedResponse: encryptedResponse });
                    }
                }
                await otpRow.update({ OTP_STATUS: 'VERIFIED' });
                return res.status(200).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        response: {
                            status: "SUCCESS",
                            code: "OTP_VERIFIED",
                            message: "OTP for LOGOUT verified successfully"
                        }
                    }))
                });
            } else {
                await otpRow.update({ OTP_STATUS: 'VERIFIED' });
                return res.status(200).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        response: {
                            status: "SUCCESS",
                            code: "OTP_VERIFIED",
                            message: "OTP for FORGET PASSWORD verified successfully"
                        }
                    }))
                });
            }

        } catch (err) {
            console.error("VERIFY OTP ERROR:", err);
            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    response: { status: "FAIL", code: "SERVER_ERROR", message: "OTP verification failed" }
                }))
            });
        }
    }

    static async resetPassword(req, res) {
        const parameterString = encryptor.decrypt(req.body.pa);
        let decodedParam = decodeURIComponent(parameterString);
        let pa = JSON.parse(decodedParam);
        try {
            const token = req.headers['authorization']?.split(' ')[1];

            if (!token) {
                return res.status(401).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        response: { status: "FAIL", code: "TOKEN_MISSING", message: "Token required" }
                    }))
                });
            }

            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
            } catch (err) {
                return res.status(401).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        response: { status: "FAIL", code: "TOKEN_INVALID", message: "Invalid or expired token" }
                    }))
                });
            }

            // if (decoded.stage !== "OTP_VERIFIED") {
            //     return res.status(403).json({
            //         encryptedResponse: encryptor.encrypt(JSON.stringify({
            //             response: { status: "FAIL", code: "OTP_NOT_VERIFIED", message: "OTP not verified" }
            //         }))
            //     });
            // }

            const corpId = decoded.corpId;
            const { newPassword } = pa;

            if (!newPassword) {
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        response: { status: "FAIL", code: "PASSWORD_REQUIRED", message: "newPassword is required" }
                    }))
                });
            }

            const otpRow = await PLRDBOTP.findOne({
                where: { CORP_ID: corpId },
                order: [['OTPID', 'DESC']]
            });

            if (!otpRow || otpRow.OTP_STATUS !== 'VERIFIED') {
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        response: { status: "FAIL", code: "OTP_INVALID_STATE", message: "OTP not verified or expired" }
                    }))
                });
            }

            const sdbSeq = corpId.split('-');
            let sdbdbname = sdbSeq.length == 3 ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB' : sdbSeq[0] + sdbSeq[1] + 'SDB';
            const admi = new ADMIController(sdbdbname);
            const m81 = new M81Controller(sdbdbname);

            let admiRow = await admi.findOne({ ADMIF06: 2 });

            await m81.update(
                { M81F04: newPassword },
                { M81UNQ: admiRow.ADMIF00.toString() }
            );
            await admi.update(
                { ADMIF05: encryptor.encrypt(newPassword) },
                { ADMIF06: { [Op.in]: [2] } }
            );

            await otpRow.update({ OTP_STATUS: 'EXPIRED' });

            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    response: {
                        status: "SUCCESS",
                        code: "PASSWORD_RESET",
                        message: "Password reset successful"
                    }
                }))
            });

        } catch (err) {
            console.error("RESET PASSWORD ERROR:", err);
            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    response: { status: "FAIL", code: "SERVER_ERROR", message: "Password reset failed" }
                }))
            });
        }
    }
}


module.exports = { AdminController, UserController };