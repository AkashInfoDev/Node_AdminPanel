// CompanyService.js
const querystring = require('querystring');
const TokenService = require('../Services/tokenServices');
const Encryptor = require('../Services/encryptor');
const CmpMaster = require('../PlusData/Class/CmpYrCls/CmpMaster');
const encryptor = new Encryptor();
// const { evlStr, evlSTU, dtSeekFld } = require('./utils');
const F02Table = require('../PlusData/Class/MTableCls/F02Table'); // You need to implement similar functionality
const db = require('../Config/config'); // Your Database class
const { MApp, LangType } = require('../PlusData/commonClass/plusCommon');
const definePLSYSF02 = require('../Models/IDB/PLSYSF02');
const definePLSDBADMI = require('../Models/SDB/PLSDBADMI');
const definePLSDBCMP = require('../Models/SDB/PLSDBCMP');
const definePLSDBM81 = require('../Models/SDB/PLSDBM81');
const definePLSDBM82 = require('../Models/SDB/PLSDBM82');
const definePLRDBGAO = require('../Models/RDB/PLRDBGAO');
const defineCRONLOGS = require('../Models/SDB/CRONLOGS');
const definePLRDBA01 = require('../Models/RDB/PLRDBA01');
const Year = require('../PlusData/Class/CmpYrCls/Year');
const Company = require('../PlusData/Class/CmpYrCls/Company');
const queryService = require('../Services/queryService');
const { error } = require('console');
const { formatDate } = require('../Services/customServices');
const BranchController = require('./branchController');
const FTPService = require('../Services/FTPServices');
const ADMIController = require('./ADMIController');
const M81Controller = require('./M81Controller');
const CMPController = require('./CMPController');
const M82Controller = require('./M82Controller');
const RELController = require('./RELController');
const { QueryTypes, Op } = require('sequelize');
const BRCController = require('./BRCController');
const sequelizeIDB = db.getConnection('IDBAPI');
const sequelizeA00001SDB = db.getConnection('A00001SDB');
const sequelizeRDB = db.getConnection('RDB');
const CRONLOGS = defineCRONLOGS(sequelizeA00001SDB);
const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const PLRDBGAO = definePLRDBGAO(sequelizeRDB);

class handleCompany {
    constructor({ year, oCmp, oEntDict, dbName, databaseName }) {
        this.year = year;
        this.oCmp = oCmp ? oCmp : null;
        this.oEntDict = oEntDict;
        this.dbName = dbName;
        this.databaseName = databaseName;
    }
    static async GetM00Ent(req, res) {
        const parameterString = encryptor.decrypt(req.query.pa);
        let decodedParam = decodeURIComponent(parameterString);
        let pa = querystring.parse(decodedParam);
        let response = { data: null, status: 'SUCCESS', message: '' }
        const token = req.headers['authorization']?.split(' ')[1]; // 'Bearer <token>'
        let decoded;
        if (!token) {
            response.message = 'No token provided, authorization denied.'
            response.status = 'FAIL'
            const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(401).json({ encryptedResponse });
        } else {
            decoded = await TokenService.validateToken(token);
        }
        let sdbSeq = (decoded.corpId).split('-');
        let sdbdbname = sdbSeq.length == 3 ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB' : sdbSeq[0] + sdbSeq[1] + 'SDB';
        let m82 = new M82Controller(sdbdbname);
        let cmp = new CMPController(sdbdbname);
        let admi = new ADMIController(sdbdbname);
        let m81 = new M81Controller(sdbdbname);
        let brc = new BRCController(sdbdbname);
        try {
            let cAction = pa.action
            let CmpNo = pa.CmpNo
            let cErr = "";
            let oUser = {};
            oUser.lCode = LangType.English;
            let qS = CmpNo ? queryService.generateDatabaseName(decoded.corpId, CmpNo) : '';
            let isComapny = false;
            let userInfo = {};
            let admin;
            let adminId = encryptor.decrypt(decoded.userId);
            const existingAdmin = await admi.findAll();
            for (let i of existingAdmin) {
                const decrypted = encryptor.decrypt(i.ADMIF01)
                if (decrypted == adminId) {
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
                let encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                return res.status(400).json({ encryptedResponse: encryptedResponse });
            }
            let M81Info
            if (decoded.corpId == 'PL-P-00001') {
                M81Info = await m81.findOne({
                    M81CHLD: admin.ADMIF00
                });
            } else {
                M81Info = await m81.findOne({
                    M81UNQ: admin.ADMIF00
                });
            }
            let cUserID = M81Info.M81F01;

            let M82;
            if ((cAction == 'E' || cAction == 'D') && CmpNo) {
                M82 = await m82.findOne({
                    M82F02: CmpNo,
                    M82F01: cUserID
                });
                oUser.YrNo = M82.M82YRN;
                if (M82) {
                    if (M82.M82ADA == 'A') {
                        let dbCmp = await cmp.findOne({
                            CMPF11: M82.M82F01,
                            CMPF01: M82.M82F02
                        });
                        if (dbCmp) {
                            isComapny = true
                        };
                    }
                    if (cAction == 'D') {
                        let crnum = (decoded.corpId).split('-')
                        let SDBdbname = crnum.length == 3 ? crnum[0] + crnum[1] + crnum[2] + 'SDB' : crnum[0] + crnum[1] + 'SDB';
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
                                connectedRows = await dbConn.query(`SELECT * FROM YR${ly.FIELD01}T41`, {
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
                } else {
                    response = {
                        message: 'Company Does not Exists'
                    }
                }
            }
            if ((cAction == "E" && isComapny) || cAction == "G" || cAction == "D") {
                let oCmp = (qS && CmpNo) ? new Company(qS, CmpNo) : null;
                let oYear = oUser.YrNo;


                //M00Table oM00 = new M00Table(oCmp);
                let oM00
                if (cAction == 'E' || cAction == 'G') {
                    let sdbSeq = (decoded.corpId).split('-');
                    let sdbdbname = sdbSeq.length == 3 ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB' : sdbSeq[0] + sdbSeq[1] + 'SDB';
                    oM00 = new CmpMaster(cUserID, decoded.corpId, LangType, cAction, [], decoded, sdbdbname);
                } else {
                    oM00 = new CmpMaster(cUserID, decoded.corpId, LangType, cAction);
                }
                CmpMaster.oCmp = oCmp;
                oM00.oYear = oYear;
                let cWhere = "";
                switch (cAction) {
                    case "G":
                    case "E":
                        let oDic = {};
                        let startDate;
                        let endDate;
                        oM00.cAction = cAction;
                        if (cAction == "G") {
                            oCmp = new Company();
                            oYear = new Year(oCmp);
                            oDic = await oM00.GetDictionary(decoded);
                        } else if (cAction == 'E') {
                            CmpMaster.newDatabase = qS;
                            let dynamicDB = db.createPool(qS);
                            let cmpRow = await dynamicDB.query("SELECT TOP 1 * FROM CMPM00", {
                                type: sequelizeIDB.QueryTypes.SELECT
                            });
                            let yrRow = await dynamicDB.query("SELECT TOP 1 * FROM CMPF01 ORDER BY FIELD01", {
                                type: sequelizeIDB.QueryTypes.SELECT
                            });
                            // dynamicDB.close().then(() => {
                            // }).catch((err) => {
                            //     console.error('Error closing SQL Server pool:', err);
                            // });
                            if (yrRow.length > 1) {
                                for (let yr of yrRow) {
                                    if (yr.FIELD01 == M82.M82YRN) {
                                        startDate = yr.FIELD02;
                                        endDate = yr.FIELD03
                                    }
                                }
                            } else {
                                startDate = yrRow[0].FIELD02;
                                endDate = yrRow[0].FIELD03
                            }
                            // DSDATE, DEDATE, _ADDRESS_1, _ADDRESS_2, _ADDRESS_3, _CITY, _PINCODE, _PHONE1, _PHONE2, _MOBILE1, _MOBILE2, _FAX1, _FAX2, _EMAIL, _WEB, _STATE, _COUNTRY, _STCD, _RPTHD1, _RPTHD2, _RPTFT1, _RPTFT2, _CMPLOGO, _PHONE3, _SYNCID, _BSYNCID, _01, _02, _03, _05, _06, _07, _08, _16, _17, _09, _10, _11, _12, _13, _14, _15
                            if (oM00.oEntDict.length == 0) {
                                oM00.oEntDict["M00"] = {};  // Initialize M00 if it doesn't exist
                            }
                            oM00.oEntDict["M00"] = cmpRow[0];
                            oM00.oEntDict["M00"].DSDATE = startDate; //MApp.DTOS(startDate, true);    // Financial year start date
                            oM00.oEntDict["M00"].DEDATE = endDate; //MApp.DTOS(endDate, true);   // Financial year end date
                            oDic = await oM00.GetDictionary(decoded, qS, oUser.lCode);
                            let path = await PLRDBA01.findOne({
                                A01F03: decoded.corpId
                            })
                            let formattedCmpNo = CmpNo.toString().padStart(4, '0');
                            oDic["M00"]._CMPLOGO = `${path.FTPPATH}${decoded.corpId}/${formattedCmpNo}/images/${oDic["M00"]._CMPLOGO}`;
                        }
                        //M00 Entry

                        //Country
                        // let oTM = new TMApi();
                        oDic["P_CONT"] = "P_COUNTRY~C~TFORM0000001";
                        oDic["P_CONTDT"] = await sequelizeIDB.query("SELECT PLCF01, PLCF02 FROM COUNTRY", {
                            type: sequelizeIDB.QueryTypes.SELECT
                        });
                        //oDic.Add("P_CONTDT", oTM.GetpopupData(oYear, oUser, "P_COUNTRY", "TFORM0000001"));

                        //State
                        oDic["P_STATE"] = "P_PLSTATE~C~TFORM0000001";
                        oDic["P_STATEDT"] = await sequelizeIDB.query("SELECT PLSF01, PLSF02, PLSF06 FROM PLSTATE", {
                            type: sequelizeIDB.QueryTypes.SELECT
                        });
                        //oDic.Add("P_STATEDT", oTM.GetpopupData(oYear, oUser, "P_PLSTATE", "TFORM0000001"));

                        //Language
                        oDic["CBOLAN"] = [
                            { DisplayMember: "Gujarati", ValueMember: "01" },
                            { DisplayMember: "English", ValueMember: "02" },
                            { DisplayMember: "Hindi", ValueMember: "03" }
                        ]

                        //Category
                        oDic["P_PLCAT"] = "P_PLCAT~C~TFORM0000001";
                        oDic["P_PLCATDT"] = await sequelizeIDB.query("SELECT CATF01, CATF02, CATF03 FROM PLSYSCAT", {
                            type: sequelizeIDB.QueryTypes.SELECT
                        });
                        //oDic.Add("P_PLCATDT", oTM.GetpopupData(oYear, oUser, "P_PLSTATE", "TFORM0000001"));

                        oDic["P_GRPDT"] = await oM00.dtM00Grp(cUserID);
                        if (cAction == 'E') {
                            oDic["P_YRDT"] = await oCmp.GetYearJSon();
                        }
                        if (cAction == 'E') {
                            let brcList = await brc.findAll({
                                BRCCOMP: {
                                    [Op.or]: [
                                        { [Op.like]: `%,${CmpNo},%` },  // Number 0 in the middle
                                        { [Op.like]: `${CmpNo},%` },     // Number 0 at the start
                                        { [Op.like]: `%,${CmpNo}` },     // Number 0 at the end
                                        { [Op.eq]: `${CmpNo}` }          // Exact match '0'
                                    ]
                                }
                            }, [], ['BRCODE']);
                            let FLDBRC = []
                            if (brcList.length > 1) {
                                for (const bl of brcList) {
                                    FLDBRC.push(bl.BRCODE.toString());
                                }
                            } else {
                                FLDBRC.push(brcList[0]?.BRCODE)
                            }
                            oDic["P_BRC"] = FLDBRC;
                        }
                        oDic.FLDBRC = '';
                        response.status = "SUCCESS";
                        response.data = { ...oDic };

                        let encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        res.status(200).json({ encryptedResponse })
                        break;
                    case "D":
                        let branch = await brc.findOne({
                            BRCCOMP: CmpNo
                        })
                        if (branch?.BRCCOMP) {
                            let cmplist = (branch.BRCCOMP).split(',');
                            for (const cl of cmplist) {
                                let existingCmp = (branch.BRCCOMP).split(',');
                                if (existingCmp.includes(cl))
                                    continue;
                            }
                        }
                        let isComapny = false;
                        let updtToDel;
                        let updtToDelM82;
                        if (M82) {
                            if (M82.M82ADA == 'A') {
                                let dbCmp = await cmp.findOne({
                                    CMPF11: M82.M82F01,
                                    CMPF01: M82.M82F02
                                });
                                if (dbCmp) {
                                    isComapny = true
                                };
                            }
                        } else {
                            response = {
                                message: 'Company Does not Exists'
                            }
                        }
                        if (isComapny) {
                            let dtobj = new Date();
                            let dateString = MApp.DTOS(dtobj);
                            updtToDel = await cmp.update({
                                CMPDEL: dateString
                            }, {
                                CMPF01: CmpNo,
                                CMPF11: cUserID
                            });
                            updtToDelM82 = await m82.update({
                                M82ADA: 'D',
                            }, {
                                M82F01: cUserID,
                                M82F02: CmpNo
                            });
                            await CRONLOGS.create({
                                CRONF02: decoded.corpId,
                                CRONF03: CmpNo,
                                CRONF04: MApp.DTOS(dtobj),
                                CRONF05: '',
                                CRONF07: 'Y',
                            });
                        }
                        if (updtToDel) {
                            response.data = null;
                            response.status = "SUCCESS";
                            response.message = "The Company And Database will be deleted in next 30 days";
                            let encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                            res.status(200).json({ encryptedResponse })
                        } else {
                            response.status = "FAIL";
                            response.message = 'cErr';
                            let encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                            res.status(200).json({ encryptedResponse })
                        }
                        break;
                }

            }
            else {
                response.message = cErr;
                response.status = "FAIL";
            }
        }
        catch (ex) {
            console.error(ex);
            return res.status(500).json(ex)
        }
    }

    static async PostM00Ent(req, res) {
        const parameterString = encryptor.decrypt(req.body.pa);
        let decodedParam = decodeURIComponent(parameterString);
        let pa = JSON.parse(decodedParam);
        let response = { data: null, status: 'SUCCESS', message: '' }
        const token = req.headers['authorization']?.split(' ')[1]; // 'Bearer <token>'

        let decoded;
        if (!token) {
            response.message = 'No token provided, authorization denied.'
            response.status = 'FAIL'
            const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(401).json({ encryptedResponse });
        } else {
            decoded = await TokenService.validateToken(token);
        }
        let sdbSeq = (decoded.corpId).split('-');
        let sdbdbname = sdbSeq.length == 3 ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB' : sdbSeq[0] + sdbSeq[1] + 'SDB';
        let m82 = new M82Controller(sdbdbname);
        let cmp = new CMPController(sdbdbname);
        let admi = new ADMIController(sdbdbname);
        let m81 = new M81Controller(sdbdbname);
        let rel = new RELController(sdbdbname);
        let brc = new BRCController(sdbdbname);
        try {
            let cAction = pa.action
            let CmpNo = pa.CmpNo
            let cSData = pa.cSData
            let cErr = "";
            let oUser = {};
            oUser.lCode = LangType.English;
            let qS = CmpNo ? queryService.generateDatabaseName(decoded.corpId, CmpNo) : '';
            let oCmp = (qS && CmpNo) ? new Company(qS, CmpNo) : null;
            CmpMaster.oCmp = oCmp;
            let isComapny = false;
            let userInfo = {};
            let admin;
            let adminId = encryptor.decrypt(decoded.userId);
            const existingAdmin = await admi.findAll();
            for (let i of existingAdmin) {
                const decrypted = encryptor.decrypt(i.ADMIF01)
                if (decrypted == adminId) {
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
                let encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                return res.status(400).json({ encryptedResponse: encryptedResponse });
            }
            let M81Info
            if (decoded.corpId == 'PL-P-00001') {
                M81Info = await m81.findOne({
                    M81CHLD: admin.ADMIF00
                });
            } else {
                M81Info = await m81.findOne({
                    M81UNQ: admin.ADMIF00
                });
            }
            let cUserID = M81Info.M81F01;

            let M82;
            if (cAction == 'E' && CmpNo) {
                M82 = await m82.findOne({
                    M82F02: CmpNo,
                    M82F01: cUserID
                });
                if (M82) {
                    if (M82.M82ADA == 'A') {
                        let dbCmp = await cmp.findOne({
                            CMPF11: M82.M82F01,
                            CMPF01: M82.M82F02
                        });
                        if (dbCmp) {
                            isComapny = true
                        };
                    }
                } else {
                    response = {
                        message: 'Company Does not Exists'
                    }
                }
            }
            if (cSData) {
                // cSData["M00"]._CMPLOGO = req.body.img
                let cMaster = new CmpMaster(decoded.userId, decoded.corpId, LangType, cAction, JSON.parse(cSData), decoded, sdbdbname);
                let jsonData = JSON.parse(cSData);
                CmpMaster.oEntDict = jsonData
                CmpMaster.cUserID = decoded.userId;
                if (cAction == "E" && isComapny) {
                    CmpMaster.newDatabase = qS;
                    let saveCmp = await cMaster.SaveCompany(decoded.corpId, '', '', false, '', true);
                    if (!saveCmp.result) {
                        if (req.files[0]?.originalname) {
                            let uploadFile = new FTPService(decoded, req.files[0].originalname, saveCmp.CmpNum);
                            let upFile = await uploadFile.uploadFile(req);
                        }
                        let findAllBrc = await brc.findAll({
                            BRCCOMP: {
                                [Op.or]: [
                                    { [Op.like]: `%,${CmpNo},%` },  // Number 0 in the middle
                                    { [Op.like]: `${CmpNo},%` },     // Number 0 at the start
                                    { [Op.like]: `%,${CmpNo}` },     // Number 0 at the end
                                    { [Op.eq]: `${CmpNo}` }          // Exact match '0'
                                ]
                            }
                        }, [], ['BRCODE']);
                        if (jsonData.FLDBRC) {
                            console.log(jsonData.FLDBRC);
                            let brcIdList = jsonData.FLDBRC.split(',').map(id => id.trim());

                            // Extract only BRCODE values from DB result
                            let dbBrcCodes = findAllBrc.map(item => item.BRCODE.toString());

                            // Check if ANY db code exists in brcIdList
                            let missingCodes = dbBrcCodes.filter(code => !brcIdList.includes(code))

                            if (missingCodes.length > 0) {
                                let dbName = queryService.generateDatabaseName(decoded.corpId, parseInt(saveCmp.CmpNum));
                                let dbConn = db.createPool(dbName);
                                let listOfYr = await dbConn.query('SELECT FIELD01 FROM CMPF01', {
                                    type: QueryTypes.SELECT
                                });
                                let connectedRows;
                                if (listOfYr) {
                                    for (const ly of listOfYr) {
                                        connectedRows = await dbConn.query(`SELECT * 
                                            FROM YR${ly.FIELD01}T41 
                                            WHERE FLDBRC IN (:codes)`,
                                            {
                                                replacements: { codes: missingCodes },
                                                type: QueryTypes.SELECT
                                            });
                                        if (connectedRows.length > 0) {
                                            response.message = 'This branch cannot be removed because it contains associated transactions.';
                                            response.status = 'FAIL'
                                            let encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                                            return res.status(200).json({ encryptedResponse });
                                        }
                                    }
                                }
                            }
                        }
                        if ((jsonData.FLDBRC)) {
                            let findAllBrc = await brc.findAll({
                                BRCCOMP: {
                                    [Op.or]: [
                                        { [Op.like]: `%,${CmpNo},%` },  // Number 0 in the middle
                                        { [Op.like]: `${CmpNo},%` },     // Number 0 at the start
                                        { [Op.like]: `%,${CmpNo}` },     // Number 0 at the end
                                        { [Op.eq]: `${CmpNo}` }          // Exact match '0'
                                    ]
                                }
                            }, [], ['BRCODE']);
                            let brcIdList = (jsonData.FLDBRC).split(',').map(id => id.trim());

                            // Extract only BRCODE values from DB result
                            let dbBrcCodes = findAllBrc.map(item => item.BRCODE.toString());

                            // Check if ANY db code exists in brcIdList
                            let missingCodes = dbBrcCodes.filter(code => !brcIdList.includes(code))

                            for (const br of missingCodes) {
                                let existingBrc = await brc.findOne({
                                    BRCODE: br
                                }, [], ['BRCCOMP']);

                                let brListarray = (existingBrc.BRCCOMP).split(',');
                                let newCmpLst = []; // Use an array to collect values

                                for (const bry of brListarray) {
                                    if (parseInt(bry) !== parseInt(saveCmp.CmpNum)) {
                                        newCmpLst.push(bry); // Push to array instead of concatenating directly
                                    }
                                }

                                // Join the array into a string, using a comma as separator
                                newCmpLst = newCmpLst.join(',');
                                await brc.update({
                                    BRCCOMP: newCmpLst
                                }, {
                                    BRCODE: br
                                })
                            }
                        }
                        // else {
                        //     let brcIdList = jsonData.FLDBRC
                        //     let existingBrc = await brc.findOne({
                        //         BRCODE: brcIdList
                        //     });
                        //     let newCmpLst = (existingBrc.BRCCOMP.includes(',') && !existingBrc.BRCCOMP.includes(CmpNo.toString()))
                        //         ? `${existingBrc.BRCCOMP},${CmpNo}`
                        //         : existingBrc.BRCCOMP.includes(CmpNo.toString())
                        //             ? existingBrc.BRCCOMP
                        //             : CmpNo.toString();
                        //     await brc.update({
                        //         BRCCOMP: newCmpLst
                        //     }, {
                        //         BRCODE: brcIdList
                        //     })
                        // }
                        response.status = 'SUCCESS';
                        response.message = '';
                        let encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(201).json({ encryptedResponse: encryptedResponse });
                    }
                } else if (cAction == "A") {
                    if (decoded.corpId != 'PL-P-00001') {
                        let totCMP = await m82.findAll({
                            M82ADA: 'A'
                        });
                        let purchasedCmp = await PLRDBA01.findOne({
                            where: {
                                A01F03: decoded.corpId
                            }
                        });

                        if (purchasedCmp.A01CMP <= totCMP.length) {
                            response.status = 'Fail'
                            response.message = "Need to Purchase More Companies to Create One";
                            let encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                            return res.status(400).json({ encryptedResponse: encryptedResponse });
                        }
                    }
                    let saveCmp = await cMaster.SaveCompany(decoded.corpId, '', '', false, '');
                    cSData = JSON.parse(cSData);
                    if (!saveCmp.result) {
                        // let BRCOntroller = new BranchController(false, 'A', '', `${saveCmp.CmpNum}-HOME-BRC`, cSData["M00"]._16, '', decoded.corpId, 'Y', saveCmp.CmpNum)
                        // let AddHomeBrc = await BRCOntroller.handleAction(req, res, true);
                        let cnum = parseInt(saveCmp.CmpNum);
                        if ((cSData.FLDBRC).includes(',')) {
                            let brcIdList = (cSData.FLDBRC).split(',');
                            for (const br of brcIdList) {
                                let existingBrc = await brc.findOne({
                                    BRCODE: br
                                });
                                let newCmpLst = (existingBrc.BRCCOMP.includes(',') && !existingBrc.BRCCOMP.includes(cnum.toString()))
                                    ? `${existingBrc.BRCCOMP},${cnum}`
                                    : existingBrc.BRCCOMP.includes(cnum.toString())
                                        ? existingBrc.BRCCOMP
                                        : cnum.toString();

                                await brc.update({
                                    BRCCOMP: newCmpLst
                                }, {
                                    BRCODE: br
                                })
                            }
                        } else {
                            let brcIdList = cSData.FLDBRC
                            let existingBrc = await brc.findOne({
                                BRCODE: brcIdList
                            });
                            let newCmpLst = (existingBrc.BRCCOMP.includes(',') && !existingBrc.BRCCOMP.includes(cnum.toString()))
                                ? `${existingBrc.BRCCOMP},${cnum}`
                                : existingBrc.BRCCOMP.includes(cnum.toString())
                                    ? existingBrc.BRCCOMP
                                    : cnum.toString();
                            await brc.update({
                                BRCCOMP: newCmpLst
                            }, {
                                BRCODE: brcIdList
                            })
                        }
                        await rel.create(admin.ADMICORP, admin.ADMIF01, parseInt(saveCmp.CmpNum), '');
                        await m82.create(cUserID, parseInt(saveCmp.CmpNum), '', '', '', '', '', '', '', 'N', (new Date().getFullYear() % 100).toString(), 'A'
                        );
                        await cmp.create(parseInt(saveCmp.CmpNum), cSData['M00'].FIELD02, 'SQL', cSData['M00'].FIELD11, cUserID, formatDate(new Date()), '94.176.235.105', 'aipharma_aakash', 'Aipharma@360', 'DATA', null
                        );
                        await PLRDBGAO.create({
                            GAOF01: decoded.corpId,
                            GAOF02: parseInt(saveCmp.CmpNum),
                            GAOF03: 2, //Customized Bill Print(Formate Wise) Free
                            GAOF04: 0,
                            GAOF05: 5, // Customized Report Setup(Report Wise) Free
                            GAOF06: 0,
                            GAOF07: 50, // User Field(Limit Wise) Free
                            GAOF08: 0,
                            GAOF09: 5, // User Master(Limit Wise) Free
                            GAOF10: 0
                        });
                        response.status = 'SUCCESS';
                        response.message = '';
                        let encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(201).json({ encryptedResponse: encryptedResponse });
                    } else {
                        console.error("Some error occured");
                        response.message = "Some error occured";
                        let encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(500).json({ encryptedResponse: encryptedResponse });
                    }
                }
            } else {
                console.error("No company details provided");
            }
        } catch (error) {
            console.error(error);
        }
    }
}

module.exports = handleCompany