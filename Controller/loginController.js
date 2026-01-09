const querystring = require('querystring');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('../Config/config'); // Your Database class
const definePLSDBADMI = require('../Models/SDB/PLSDBADMI'); // Model factory
// const definePLSDBADMI = require('../Models/SDB/PLSDBADMI'); // Model factory
const definePLSDBREL = require('../Models/SDB/PLSDBREL'); // Model factory
const definePLRDBA01 = require('../Models/RDB/PLRDBA01'); // Model factory
const definePLRDBA02 = require('../Models/RDB/PLRDBA02'); // Model factory
const definePLSDBM81 = require('../Models/SDB/PLSDBM81');
const definePLSDBM82 = require('../Models/SDB/PLSDBM82');
const definePLSDBCMP = require('../Models/SDB/PLSDBCMP');
const Encryptor = require('../Services/encryptor');
const { Op, QueryTypes } = require('sequelize');
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

// Get Sequelize instance for 'SDB' or your specific DB name
const sequelizeSDB = db.getConnection('A00001SDB');
const sequelizeRDB = db.getConnection('RDB');

// Initialize model using the Sequelize instance
const PLSDBADMI = definePLSDBADMI(sequelizeSDB);
const PLSDBREL = definePLSDBREL(sequelizeSDB);
const PLSDBM81 = definePLSDBM81(sequelizeSDB);
const PLSDBM82 = definePLSDBM82(sequelizeSDB);
const PLSDBCMP = definePLSDBCMP(sequelizeSDB);
const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const PLRDBA02 = definePLRDBA02(sequelizeRDB);
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
            response = {
                message: 'Login failed'
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

        pa.isPassword = pa.isPassword === "true";
        let { action, corpId, userId, firstName, middleName, lastName, dob, gender, email, password, roleId, address, phoneNumber, base64Image, GUaction, grpname, companyName, isPassword, cusRole, CmpList, BrcList
            // , companyName, softSubType, softType, dbVersion, webVer, noOfUser, regDate, subStrtDate, subEndDate, cancelDate, subDomainDelDate, cnclRes, SBDdbType, srverIP, serverUserName, serverPassword, A02id 
        } = pa;


        const token = req.headers['authorization']?.split(' ')[1]; // 'Bearer <token>'

        let decoded;
        if (action != 'L' && roleId != '2') {
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
                return UserController.loginUser(corpId, userId, password, res);
            } else if (action === 'D') {
                return UserController.deleteUser(decoded, userId, res);
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
                    const existingUser = await PLSDBADMI.findAll();
                    for (let i of existingUser) {
                        const decrypted = encryptor.decrypt(i.ADMIF01);
                        if (decrypted === userId) {
                            await PLSDBADMI.destroy({
                                where: { ADMIF01: i.ADMIF01 }
                            });
                        }
                    }
                    await PLSDBM81.destroy({
                        where: { M81F01: GUID }
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

                        // Create a new JWT token
                        const updatedToken = jwt.sign(
                            { userId: admin.ADMIF01, corpId: companyResult.corpId },
                            process.env.JWT_SECRET_KEY,
                            { expiresIn: process.env.JWT_EXPIRATION }
                        );

                        // Prepare the success response
                        const response = {
                            status: 'SUCCESS',
                            message: 'User registered successfully',
                            userId: encryptor.decrypt(admin.ADMIF01),
                            password: encryptor.decrypt(admin.ADMIF05),
                            corpId: companyResult.nextCorpId,
                            updatedToken: updatedToken
                        };

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
                let corpId = decoded.corpId
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

                let userCorp = await PLRDBA01.findOne({
                    where: { A01F03: corpId }
                });

                let superUserDetails = await PLSDBADMI.findOne({
                    where: {
                        ADMICORP: userCorp.A01F01,
                        ADMIF06: [1, 2]
                    }
                });

                const hashedPassword = encryptor.encrypt(password);
                const newUser = await PLSDBADMI.create({
                    ADMIF01: encryptedUserId,
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
                    ADMICORP: superUserDetails.ADMICORP,
                    ADMIROL: cusRole,
                    ADMIBRC: BrcList,
                    ADMICOMP: CmpList
                });

                let superUsrCorpDtl = await PLRDBA01.findOne({
                    where: { A01F01: superUserDetails.ADMICORP }
                });

                if (newUser) {
                    const newUser = await PLSDBREL.create({
                        M00F01: superUserDetails.ADMICORP,
                        M00F02: encryptedUserId,
                        M00F03: "",
                        M00F04: ""

                    });
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
                    let grpCodeList = await PLSDBM81.findAll({
                        attributes: ['M81F05']
                    });

                    usrCodeList = await PLSDBM81.findAll({
                        M81F01: {
                            [Op.like]: 'U%'  // This will match strings that start with 'U'
                        }
                    });

                    do {
                        // Check if a user with the same GUID exists
                        usrCodeList = await PLSDBM81.findAll({
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

                        usrCodeList = await PLSDBM81.findAll({
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

                    await PLSDBM81.create({
                        M81F00: GU,
                        M81F01: GUID,
                        M81F02: firstName + lastName,
                        M81F03: userId,
                        M81F04: password,
                        M81F05: nextNumber,
                        M81F06: grpname ? grpname : roleId == '1' ? 'Admin' : roleId == '2' || '3' ? 'User' : 'Employee',
                        M81F07: phoneNumber,
                        M81F08: email,
                        M81IMG: '',
                        M81RTY: '',
                        M81ADA: 'A',
                        M81CHLD: newUser.ADMIF00,
                        M81UNQ: 'ABCD'
                    });
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
            corpId = decoded.corpId.toUpperCase();
            let sdbSeq = corpId.split('-');
            let sdbdbname = sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB';
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
            if (cusRole) {
                await admi.update(
                    {
                        ADMIROL: cusRole
                    }, {
                    where: { ADMIF01: encryptedUserId }
                });
            }

            response.message = 'User updated successfully';

            const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }));
            return res.status(200).json({ encryptedResponse: encryptedResponse });

        } catch (error) {
            console.error(error);
            const encryptedResponse = encryptor.encrypt(JSON.stringify({ message: 'User update failed' }));
            return res.status(500).json({ encryptedResponse: encryptedResponse });
        }
    }

    static async loginUser(corpId, userId, password, res) {
        try {
            corpId = corpId.toUpperCase();
            let sdbSeq = corpId.split('-');
            let sdbdbname = sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB';
            if (sdbdbname) sdbdbname = sdbdbname == 'PLP00001SDB' ? 'A00001SDB' : sdbdbname
            let admi = new ADMIController(sdbdbname);
            let m81 = new M81Controller(sdbdbname);
            let response = { status: 'SUCCESS', message: null };
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

            if (user.ADMIF06 == 2) {
                let corpUnq = user.ADMICORP
                let userM81Unq = user.ADMIF00

                let corpExist = await PLRDBA01.findAll({
                    where: { A01F01: corpUnq }
                });

                let M81Row
                if (corpUnq == 1) {
                    M81Row = await m81.findAll({
                        M81CHLD: userM81Unq
                    });
                }else{
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
                        if (corp.A01F03 == corpId) {
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

                let userComp = new AuthenticationService(corpId, uM82Row, sdbdbname);
                let cmplist = await userComp.authenticateUser();



                const token = jwt.sign({ userId: user.ADMIF01, roleId: user.ADMIF06, password: user.ADMIF05, corpId: corpId }, process.env.JWT_SECRET_KEY, { expiresIn: process.env.JWT_EXPIRATION });

                response.data = {
                    CustID: corpId,
                    CustName: user.ADMIF02 + ' ' + user.ADMIF04,
                    SubSDate: corpRow.A01F12,
                    SubEDate: corpRow.A01F13,
                    SoftVer: corpRow.A01F07,
                    UserId: M81Row.M81F01,
                    userNm: encryptor.decrypt(user.ADMIF01),
                    DefCmp: cmplist.DefComp.cmpNo,
                    cmpList: cmplist.CompList
                };
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
                    M81UNQ: userM81Unq
                });

                let uM82Row = M81Row.length > 0 ? M81Row[0].M81F01 : null;

                if (!corpExist) {
                    response.status = 'FAIL';
                    response.message = 'Invalid Credentials';
                    const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
                    return res.status(400).json({ encryptedResponse: encryptedResponse });
                } else {
                    for (const corp of corpExist) {
                        if (corp.A01F03 == corpId) {
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

                let userComp = new AuthenticationService(corpId, uM82Row);
                let cmplist = await userComp.authenticateUser();
                let usrCompList = [];

                if (user.ADMIROL != 2) {
                    let assgncmpArray = user.ADMICOMP; // Assuming ADMICOMP is already an array or it's a string that's split elsewhere

                    for (const cmp of cmplist.CompList) {
                        if (assgncmpArray.includes(cmp.cmpNo)) {
                            usrCompList.push(cmp); // Push the whole cmp object into the list
                        }
                    }
                }


                const token = jwt.sign({ userId: user.ADMIF01, roleId: user.ADMIF06, password: user.ADMIF05, corpId: corpId }, process.env.JWT_SECRET_KEY, { expiresIn: process.env.JWT_EXPIRATION });

                response.data = {
                    CustID: corpId,
                    CustName: user.ADMIF02 + ' ' + user.ADMIF04,
                    SubSDate: corpRow.A01F12,
                    SubEDate: corpRow.A01F13,
                    SoftVer: corpRow.A01F07,
                    UserId: M81Row.M81F01,
                    userNm: encryptor.decrypt(user.ADMIF01),
                    DefCmp: cmplist.DefComp.cmpNo,
                    cmpList: usrCompList
                };
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

    static async deleteUser(decoded, userId, res) {

        corpId = decoded.corpId.toUpperCase();
        let sdbSeq = corpId.split('-');
        let sdbdbname = sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB';
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

        if (user.ADMIF06 == 2) {
            response.status = 'FAIL';
            response.message = 'Admin User Can Not be Deleted';
            const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
            return res.status(400).json({ encryptedResponse: encryptedResponse });
        }

        if (!user) {
            response.status = 'FAIL';
            response.message = 'User Does Not Exist';
            const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
            return res.status(400).json({ encryptedResponse: encryptedResponse });
        }

        let deleteUsr = await admi.destroy({
            where: { ADMIF01: user.ADMIF01 }
        })

        if (deleteUsr) {
            response.status = 'SUCCESS';
            response.message = 'User ID Deleted Successfully';
            const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
            return res.status(200).json({ encryptedResponse: encryptedResponse });
        }
    }
}


module.exports = { AdminController, UserController };