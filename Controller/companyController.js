const querystring = require('querystring');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('../Config/config'); // Your Database class
const definePLSDBADMI = require('../Models/SDB/PLSDBADMI'); // Model factory
const definePLSDBREL = require('../Models/SDB/PLSDBREL'); // Model factory
const definePLRDBA01 = require('../Models/RDB/PLRDBA01'); // Model factory
const definePLRDBA02 = require('../Models/RDB/PLRDBA02'); // Model factory
const Encryptor = require('../Services/encryptor');
const { Op, QueryTypes } = require('sequelize');
// const PLRDBA01 = require('../Models/RDB/PLRDBA01');
const TokenService = require('../Services/tokenServices');
const CmpMaster = require('../PlusData/Class/CmpYrCls/CmpMaster');
const BranchController = require('./branchController');
const { LangType } = require('../PlusData/commonClass/plusCommon');
const Company = require('../PlusData/Class/CmpYrCls/Company');
const dbCloneService = require('../Services/dbCloneService');
const ADMIController = require('./ADMIController');
const RELController = require('./RELController');
const M81Controller = require('./M81Controller');
const { formatDate } = require('../Services/customServices');

// Get Sequelize instance for 'SDB' or your specific DB name
const sequelizeSDB = db.getConnection('A00001SDB');
const sequelizeRDB = db.getConnection('RDB');
const sequelizeMASTER = db.getConnection('master');

// Initialize model using the Sequelize instance
const PLSDBADMI = definePLSDBADMI(sequelizeSDB);
const PLSDBREL = definePLSDBREL(sequelizeSDB);
const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const PLRDBA02 = definePLRDBA02(sequelizeRDB);
const encryptor = new Encryptor();
// let response = { data: null, Status: "SUCCESS", message: null }

class CompanyService {
    constructor(ExistingcorpId) {
        this.ExistingcorpId = ExistingcorpId;
    }
    static async createCompany(req, res, lbool) {
        const parameterString = encryptor.decrypt(req.query.pa);
        let decodedParam = decodeURIComponent(parameterString);
        let pa = querystring.parse(decodedParam);
        let { firstName, middleName, lastName, dob, gender, email, password, roleId, address, base64Image, GUaction, rpname, corpId, cusRole, CmpList, BrcList, userId, companyName, softSubType, softType, dbVersion, webVer, noOfUser, regDate, subStrtDate, subEndDate, cancelDate, subDomainDelDate, cnclRes, SBDdbType, srverIP, serverUserName, serverPassword, A02id, phoneNumber, cSData, ExistingcorpId, GSTNumber } = pa
        let response = {
            status: true,
            message: '',
            corpId: ''
        }
        const today = new Date();
        regDate = formatDate(today);
        subStrtDate = formatDate(today);
        const endDate = new Date(today);
        endDate.setFullYear(endDate.getFullYear() + 1);
        subEndDate = formatDate(endDate);

        const token = req.headers['authorization']?.split(' ')[1]; // 'Bearer <token>'

        if (!token) {
            response.message = 'No token provided, authorization denied.'
            response.status = 'FAIL'
            const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(401).json({ encryptedResponse });
        }

        const decoded = await TokenService.validateToken(token);

        try {
            let existingCompName = await PLRDBA01.findAll();
            for (let i of existingCompName) {
                const decrypted = i.A01F02;
                if (decrypted === companyName) {
                    if (!lbool) {
                        // return res.status(500).json({ message: 'Company Name is Already Registered' })
                    } else {
                        response.status = false;
                        response.message = 'Company Name is Already Registered';
                        return response
                    }
                }
            }
            // Generate new company ID (A01F01)
            const existingSub = await PLRDBA01.findAll({
                attributes: ['A01F01'],
                where: { A01F01: { [Op.like]: 'E%' } },
                order: ['A01F01']
            });

            const validIds = existingSub
                .map(item => item.A01F01)
                .filter(id => typeof id === 'string' && /^E\d+$/.test(id.trim()))
                .map(id => parseInt(id.slice(1), 10));

            const nextNum = (validIds.length > 0 ? Math.max(...validIds) : 0) + 1;
            const nextId = 'E' + nextNum.toString().padStart(6, '0');

            // Generate company code (A01F03)
            const corpIds = await PLRDBA01.findAll({
                attributes: ['A01F03'],
                where: { A01F03: { [Op.like]: 'PL-P-%' } }
            });

            let corpNumbers;
            let nextCorpNum;
            let nextCorpId;

            if (lbool) {
                const corpIds = await PLRDBA01.findAll({
                attributes: ['A01F03'],
                where: { A01F03: { [Op.like]: 'EP-%' } }
            });
                corpNumbers = corpIds.map(item => parseInt(item.A01F03.slice(5))).filter(Number.isFinite);
                nextCorpNum = (corpNumbers.length > 0 ? Math.max(...corpNumbers) : 0) + 1;
                nextCorpId = 'EP-' + nextCorpNum.toString().padStart(5, '0');
                response.corpId = nextCorpId;
            } else {

            }

            let crnum = nextCorpId.split('-')
            let SDBdbname = crnum.length == 3 ? crnum[0] + crnum[1] + crnum[2] + "SDB" : crnum[0] + crnum[1] + "SDB";
            await dbCloneService.usrSDB(SDBdbname);
            let admi = new ADMIController(SDBdbname);
            const encryptedUserId = encryptor.encrypt(userId);
            const hashedPassword = encryptor.encrypt(password);
            A02id
            const newUser = await admi.create(encryptedUserId, firstName, middleName, lastName, hashedPassword, roleId, email, dob, gender, address, phoneNumber, base64Image, BrcList, CmpList);
            let m81 = new M81Controller(SDBdbname)
            let m81row = await m81.create('U', 'U0000000', firstName + lastName, userId, password, '', 'ADMIN', phoneNumber, '', '', '', 'A', '', newUser.ADMIF00);
            let rel = new RELController(SDBdbname)
            if (newUser) {
                const newUser = await rel.create("", encryptedUserId, "", "");
            }

            let user = await admi.findOne({ ADMICORP: nextId });
            if (!user) {
                const existing = await admi.findAll();
                for (let i of existing) {
                    const decrypted = encryptor.decrypt(i.ADMIF01);
                    if (decrypted === userId) {
                        await admi.update(
                            { ADMICORP: nextId },
                            { ADMIF01: i.ADMIF01 });
                    }
                }
            }
            user = await admi.findOne({ ADMICORP: nextId });

            // Create company record
            const createCMP = await PLRDBA01.create({
                A01F01: nextId,
                A01F02: companyName,
                A01F03: nextCorpId,
                A01F04: softType ? softType : 'PL',
                A01F05: softSubType ? softSubType : 'P',
                A01F06: dbVersion,
                A01F07: webVer,
                A01F08: 'A',
                A01F09: user.ADMIF02 + user.ADMIF04,
                A01F10: noOfUser,
                A01F11: regDate,
                A01F12: subStrtDate,
                A01F13: subEndDate,
                A01F14: cancelDate,
                A01F15: subDomainDelDate,
                A01F16: cnclRes,
                A01F17: phoneNumber ? phoneNumber : user.ADMIF13,
                A01F51: SBDdbType ? SBDdbType : 'SQL',
                A01F52: srverIP ? srverIP : '94.176.235.105',
                A01F53: serverUserName ? serverUserName : 'aipharma_aakash',
                A01F54: serverPassword ? serverPassword : 'Aipharma@360',
                FTPURL: 's01.lyfexplore.com',
                FTPUID: 'ftpuser',
                FTPPWD: 'ftp@3360',
                FTPDIR: '/html/eplus/',
                FTPPATH: 'https://s01.lyfexplore.com/eplus/',
                A02F01: A02id,
                A01CHLD: '',
            });

            if (createCMP) {
                const relMng = await rel.create(nextId, userId, A02id ? A02id : '', "");
                if (A02id) {
                    let planDetail = await PLRDBA02.findOne({
                        where: { A02F01: A02id }
                    });
                    await PLRDBA01.update({
                        A01F10: planDetail.A02F07,
                        A01CMP: planDetail.A02F08,
                        A01BRC: planDetail.A02F11
                    }, {
                        where: {
                            A01F01: nextId
                        }
                    });
                    const modList = await admi.update({
                        ADMIMOD: planDetail.A02F12
                    }, { ADMICORP: nextId }
                    );
                }
            }

            // Update user to attach company
            const existing = await admi.findAll({}, [], ['ADMIF01', 'ADMIF05']);
            let encryuser = userId.includes(':') ? userId : encryptor.encrypt(userId);
            let cMaster = new CmpMaster(encryuser, ExistingcorpId, LangType, 'A', null, null, SDBdbname);
            if (!cSData) {
                // CmpMaster.oCmp = new Company('A00001CMP0031');
                let compCon = db.createPool('A00001CMP0031');
                let oent = await compCon.query(`SELECT TOP 1 * FROM CMPM00`, { type: QueryTypes.SELECT })
                cMaster.oEntDict["M00"] = oent[0];
            } else {
                cMaster.oEntDict["M00"] = JSON.parse(cSData);
            }
            // CmpMaster.oEntDict = JSON.parse(cSData);
            CmpMaster.cAction = 'A';
            CmpMaster.cUserID = userId;
            // console.log(typeof(CmpMaster.oEntDict));

            let BRcode;
            let brGst = GSTNumber ? GSTNumber : '';
            let saveCmp = await cMaster.SaveCompany(nextCorpId, '', '', false, '', false)
            if (!lbool) {
                if (!saveCmp.result) {
                    return res.status(201).json(message = 'error');
                }
            } else {
                if (!saveCmp.result) {
                    let BRCOntroller = new BranchController(false, 'A', BRcode, '0001-HOME-BRC', brGst, '', saveCmp.nextCorpId, 'Y', saveCmp.CmpNum); //000
                    let AddHomeBrc = await BRCOntroller.handleAction(req, res, true);
                    return { status: true, CmpNum: saveCmp.CmpNum, cSdata: saveCmp.cSdata, nextCorpId: saveCmp.nextCorpId, SDBdbname }
                }
            }

            // Return response
            const updatedToken = {
                ...decoded,
                nextCorpId,
                // databasename
            };

            const newToken = jwt.sign(updatedToken, process.env.JWT_SECRET_KEY);
            const responsePayload = {
                message: 'Company created successfully',
                corpId: nextCorpId,
                // dbName: targetDbName,
                newToken
            };

            if (!GSTNumber) {
                brGst = '';
                BRcode = ''
            }

            let BRCOntroller = new BranchController(false, 'A', BRcode, 'HOME-BRC', brGst, '', nextCorpId, 'Y', '0000')
            let AddHomeBrc = await BRCOntroller.handleAction(req, res, true);

            if (!lbool) {
                const encryptedResponse = encryptor.encrypt(JSON.stringify(responsePayload));
                return res.status(201).json({ encryptedResponse });
            } else {
                response.status = true;
                return response;
            }

        } catch (error) {
            console.error(error);
            sequelizeMASTER.query(`DROP DATABASE ${this.targ}`, { type: QueryTypes.RAW });
            const encryptedResponse = encryptor.encrypt(JSON.stringify({ message: 'Company creation failed' }));
            return res.status(500).json({ encryptedResponse });
        }
    }
}

module.exports = CompanyService;