const querystring = require('querystring');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const db = require('../Config/config'); // Your Database class
const definePLSDBADMI = require('../Models/SDB/PLSDBADMI'); // Model factory
const definePLSDBREL = require('../Models/SDB/PLSDBREL'); // Model factory
const definePLRDBA01 = require('../Models/RDB/PLRDBA01'); // Model factory
const Encryptor = require('../Services/encryptor');
const { Op, QueryTypes } = require('sequelize');
// const PLRDBA01 = require('../Models/RDB/PLRDBA01');
const TokenService = require('../Services/tokenServices');
const CmpMaster = require('../PlusData/Class/CmpYrCls/CmpMaster');
const BranchController = require('./branchController');

// Get Sequelize instance for 'SDB' or your specific DB name
const sequelizeSDB = db.getConnection('A00001SDB');
const sequelizeRDB = db.getConnection('RDB');
const sequelizeMASTER = db.getConnection('master');

// Initialize model using the Sequelize instance
const PLSDBADMI = definePLSDBADMI(sequelizeSDB);
const PLSDBREL = definePLSDBREL(sequelizeSDB);
const PLRDBA01 = definePLRDBA01(sequelizeRDB);
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
        const {
            userId, companyName, softSubType, softType, dbVersion, webVer,
            noOfUser, regDate, subStrtDate, subEndDate, cancelDate,
            subDomainDelDate, cnclRes, SBDdbType, srverIP, serverUserName,
            serverPassword, A02id, phoneNumber, cSData, ExistingcorpId, GSTNumber
        } = pa
        let response = {
            status: true,
            message: '',
            corpId: ''
        }

        const token = req.headers['authorization']?.split(' ')[1]; // 'Bearer <token>'

        if (!token) {
            response.message = 'No token provided, authorization denied.'
            response.status = 'FAIL'
            const encryptresponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(401).json({ encryptresponse });
        }

        const decoded = await TokenService.validateToken(token);

        if (!userId || !companyName || !regDate || !subStrtDate || !subEndDate || !cancelDate || !cSData) {
            if (!lbool) {
                return res.status(500).json({ message: 'Provide valid data for company' })
            } else {
                response.status = false;
                response.message = 'Provide valid data for company';
                return response
            }
        }

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
                where: { A01F01: { [Op.like]: 'E%' } }
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

            let corpNumbers
            let nextCorpNum
            let nextCorpId

            if (lbool) {
                corpNumbers = corpIds.map(item => parseInt(item.A01F03.slice(5))).filter(Number.isFinite);
                nextCorpNum = (corpNumbers.length > 0 ? Math.max(...corpNumbers) : 0) + 1;
                nextCorpId = 'PL-P-' + nextCorpNum.toString().padStart(5, '0');
                response.corpId = nextCorpId;
            } else {

            }

            // Create company record
            const createCMP = await PLRDBA01.create({
                A01F01: nextId,
                A01F02: companyName,
                A01F03: nextCorpId,
                A01F04: softType,
                A01F05: softSubType,
                A01F06: dbVersion,
                A01F07: webVer,
                A01F08: 'A',
                A01F09: '',
                A01F10: noOfUser,
                A01F11: regDate,
                A01F12: subStrtDate,
                A01F13: subEndDate,
                A01F14: cancelDate,
                A01F15: subDomainDelDate,
                A01F16: cnclRes,
                A01F17: phoneNumber,
                A01F51: SBDdbType,
                A01F52: srverIP,
                A01F53: serverUserName,
                A01F54: serverPassword,
                A02F01: A02id,
                A01CHLD: '',
            });

            if (createCMP) {
                const relMng = await PLSDBREL.create({
                    M00F01: nextId,
                    M00F02: userId,
                    M00F03: A02id,
                    M00F04: ""
                });
                if (A02id) {
                    let planDetail = await PLRDBA01.findOne({
                        where: { A02F01: A02id }
                    });
                    const modList = await PLSDBADMI.update({
                        ADMIMOD: planDetail.A02id
                    }, {
                        where: { ADMICORP: nextId }
                    });
                }
            }

            // Update user to attach company
            const existing = await PLSDBADMI.findAll({ attributes: ['ADMIF01', 'ADMIF05'] });
            let decryuser = userId.includes(':') ? encryptor.decrypt(userId) : userId;
            // let update = await PLSDBADMI.update({ ADMICORP: nextId }, { where: { ADMIF01: encryptedUserId } });

            // // Clone DB
            // const sourceDbName = 'A00001CMP0031';
            // const corpNum = parseInt(nextCorpId.split('-')[2]);
            // const targetDbName = 'A' + corpNum.toString().padStart(5, '0') + 'CMP0001';
            // const replaceSuffix = 'YR29';

            // await dbCloneService.createCloneProcedure();
            // await dbCloneService.cloneDatabase(sourceDbName, targetDbName, replaceSuffix);

            // const newDb = db.getConnection(targetDbName);

            let cmpmstr = CmpMaster.oEntDict
            // console.log(typeof(cSData));
            // console.log(cSData);
            CmpMaster.oEntDict = JSON.parse(cSData);
            CmpMaster.cAction = 'A';
            let cMaster = new CmpMaster(userId, ExistingcorpId);
            CmpMaster.cUserID = userId;
            // console.log(typeof(CmpMaster.oEntDict));

            if (!await cMaster.SaveCompany(nextCorpId, '')) {
                return res.status(201).json(message = 'error');
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
            let BRcode;
            let brGst;
            if (!GSTNumber) {
                brGst = '';
                BRcode = ''
            }

            let BRCOntroller = new BranchController(false, 'A', BRcode, 'HOME-BRC', brGst, '', nextCorpId)
            let AddHomeBrc = await BRCOntroller.handleAction(req, res, true);

            if (!lbool) {
                const encryptresponse = encryptor.encrypt(JSON.stringify(responsePayload));
                return res.status(201).json({ encryptresponse });
            } else {
                response.status = true;
                return response;
            }

        } catch (error) {
            console.error(error);
            sequelizeMASTER.query(`DROP DATABASE ${this.targ}`, { type: QueryTypes.RAW });
            const encryptresponse = encryptor.encrypt(JSON.stringify({ message: 'Company creation failed' }));
            return res.status(500).json({ encryptresponse });
        }
    }
}

module.exports = CompanyService;

