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
const Year = require('../PlusData/Class/CmpYrCls/Year');
const Company = require('../PlusData/Class/CmpYrCls/Company');
const queryService = require('../Services/queryService');
const sequelizeIDB = db.getConnection('IDBAPI');
const sequelizeA00001SDB = db.getConnection('A00001SDB');
const PLSYSF02 = definePLSYSF02(sequelizeIDB);
const PLSDBADMI = definePLSDBADMI(sequelizeA00001SDB);
const PLSDBCMP = definePLSDBCMP(sequelizeA00001SDB);
const PLSDBM81 = definePLSDBM81(sequelizeA00001SDB);
const PLSDBM82 = definePLSDBM82(sequelizeA00001SDB);

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
        try {
            console.log(typeof pa);
            let cAction = pa.action
            let CmpNo = pa.CmpNo
            let cErr = "";
            let oUser = {};
            oUser.lCode = LangType.English;
            let qS = queryService.generateDatabaseName(decoded.corpId);
            let isComapny = false;
            let userInfo = {};
            let admin;
            let adminId = encryptor.decrypt(decoded.userId);
            const existingAdmin = await PLSDBADMI.findAll();
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
            let M81Info = await PLSDBM81.findOne({
                where: { M81CHLD: admin.ADMIF00 }
            });

            let cUserID = M81Info.M81F01;

            let M82 = await PLSDBM82.findOne({
                where: {
                    M82F02: CmpNo,
                    M82F01: cUserID
                }
            });
            if (cAction == 'E' && CmpNo) {
                if (M82) {
                    if (M82.M82ADA == 'A') {
                        let dbCmp = await PLSDBCMP.findOne({
                            where: {
                                CMPF11: M82.M82F01,
                                CMPF01: M82.M82F02
                            }
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
            if ((cAction == "E" && isComapny) || cAction == "G" || cAction == "D") {
                let oCmp = new Company(qS, CmpNo);
                let oYear = oUser.oYear;


                //M00Table oM00 = new M00Table(oCmp);
                console.log('CmpMaster class:', CmpMaster); // Log to confirm the class
                let oM00 = new CmpMaster(cUserID, decoded.corpId, LangType, cAction);
                oM00.oCmp = oCmp;
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
                            let dynamicDB = db.createPool(qS);
                            let cmpRow = await dynamicDB.query("SELECT TOP 1 * FROM CMPM00", {
                                type: sequelizeIDB.QueryTypes.SELECT
                            });
                            let yrRow = await dynamicDB.query("SELECT TOP 1 * FROM CMPF01 ORDER BY FIELD01", {
                                type: sequelizeIDB.QueryTypes.SELECT
                            });
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
                            console.log(cmpRow);
                            oM00.oEntDict["M00"] = cmpRow[0];
                            oM00.oEntDict["M00"].DSDATE = startDate; //MApp.DTOS(startDate, true);    // Financial year start date
                            oM00.oEntDict["M00"].DEDATE = endDate; //MApp.DTOS(endDate, true);   // Financial year end date
                            oDic = await oM00.GetDictionary(decoded, qS, oUser.lCode);
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
                        response.status = "SUCCESS";
                        response.data = oDic;
                        let encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        res.status(200).json({ encryptedResponse })
                        break;
                    case "D":
                        let isComapny = false;
                        let updtToDel;
                        let updtToDelM82;
                        if (M82) {
                            if (M82.M82ADA == 'A') {
                                let dbCmp = await PLSDBCMP.findOne({
                                    where: {
                                        CMPF11: M82.M82F01,
                                        CMPF01: M82.M82F02
                                    }
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
                            let dtobj = Date.now();
                            let dateString = MApp.DTOS(dtobj);
                            updtToDel = await PLSDBCMP.update({
                                CMPDEL: dateString
                            }, {
                                where: {
                                    CMPF01: CmpNo,
                                    CMPF11: cUserID
                                }
                            });
                            updtToDelM82 = await PLSDBM82.update({
                                M82ADA: 'D',
                            }, {
                                where: {
                                    M82F01: cUserID,
                                    M82F02: CmpNo
                                }
                            })
                        }
                        if (updtToDel) {
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
}

module.exports = handleCompany