const CompanyService = require("../../../Controller/companySetupController");
// const Encryptor = require("../../../Services/encryptor");
// const { DcDefine } = require("../../../DataClass/Class/DcDefine");
// const dbCloneService = require("../../../Services/dbCloneService");
// const Define = require("../../commonClass/define");
// const { MApp, LangType } = require("../../commonClass/plusCommon");
// const PlusInfo = require("../AppCls/PlusInfo");
// const db = require('../../../Config/config'); // Your Database class
// const sequelizeSDB = db.getConnection('A00001SDB');
// const sequelizeRDB = db.getConnection('RDB');
// const sequelizeIDB = db.getConnection('IDBAPI');
// const sequelizeMaster = db.getConnection('master');
// const definePLSDBADMI = require('../../../Models/SDB/PLSDBADMI');
// const definePLSDBM81 = require('../../../Models/SDB/PLSDBM81');
// const definePLSDBM82 = require('../../../Models/SDB/PLSDBM82');
// const definePLRDBA01 = require('../../../Models/RDB/PLRDBA01'); // Model factory
// const definePLSYS13 = require('../../../Models/IDB/PLSYS13'); // Model factory
// const definePLSYSF02 = require('../../../Models/IDB/PLSYSF02'); // Model factory
// const PLSDBM82 = definePLSDBM82(sequelizeSDB);
// const PLSDBM81 = definePLSDBM81(sequelizeSDB);
// const PLSDBADMI = definePLSDBADMI(sequelizeSDB);
// const PLRDBA01 = definePLRDBA01(sequelizeRDB);
// const PLSYS13 = definePLSYS13(sequelizeIDB);
// const PLSYSF02 = definePLSYSF02(sequelizeIDB);
// const SCMPTable = require("../STable/SCMPTable");
// const SM82Table = require("../STableCls/SM82Table");
// const { Sequelize, QueryTypes, Op } = require("sequelize");
// const encryptor = new Encryptor();

// class CmpMaster extends PlusInfo{
//     static oEntDict = {};             // Initialize oEntDict as an empty object
//     static cAction = "";              // Initialize cAction as an empty string
//     static defComp = 'Y'
//     static compNo = '0001';
//     static oCmp;
//     static oYear;
//     // CmpMaster(lCode) {
//     //     // super();
//     //     this.lCode = lCode;            // Initialize the lCode property
//     //     this.cEMsg = "";                // Initialize cEMsg as an empty string
//     //     this.cOEgKey = "";              // Initialize cOEgKey as an empty string
//     //     this.cCmpNo = "";               // Initialize cCmpNo as an empty string
//     // }

//     constructor(cUserID, existingCorpId, LangType, cAction) {
//         super(LangType);
//         this.cUserID = cUserID;
//         this.existingCorpId = existingCorpId;
//         this.cAction = cAction
//         // this.cmpNum = '0001'
//     }


//     // Set default values for the properties
//     static SetDefValue() {

//         let Mp = new MApp();

//         // Set default values for the fields in oEntDict dictionary
//         this.oEntDict["M00"].FIELD10 = MApp._evlSTU(this.oEntDict["M00"]?.M00V01, "");               // Short Name
//         this.oEntDict["M00"].M00V01 = MApp._evlSTU(this.oEntDict["M00"]?.M00V01, Define.CDBVer);     // Company Database Version 1,2, 3 etc
//         this.oEntDict["M00"].M00V02 = MApp._evlSTU(this.oEntDict["M00"]?.M00V02, Define.CodeVer);    // Company Code Version 1,2,3 etc
//         this.oEntDict["M00"].M00V03 = MApp._evlSTU(this.oEntDict["M00"]?.M00V03, Mp.SoftType);     // Company Software Type (Plus-PL, Kishan, KP, Pharma - ....)
//         this.oEntDict["M00"]._COUNTRY = MApp._evlSTU(this.oEntDict["M00"]._COUNTRY, "C0000095");     // Country - Default India
//         this.oEntDict["M00"]._STATE = MApp._evlSTU(this.oEntDict["M00"]?._STATE, "ST000012");         // State - Default Gujarat
//         this.oEntDict["M00"].FIELD81 = MApp._evlSTU(this.oEntDict["M00"]?.FIELD81, LangType.English); // Language - Default English
//         this.oEntDict["M00"].FIELD25 = MApp._evlStr(this.oEntDict["M00"]?.FIELD25, "GENERAL");        // Category code for patch Company
//         this.oEntDict["M00"].FIELD11 = MApp._evlStr(this.oEntDict["M00"]?.FIELD11, " No Group");      // Group Name
//     }

//     // Method to save the company
//     async SaveCompany(nextCorpId, cError, oCUser, lInitCmp, CustId) {
//         this.SetDefValue();

//         let cDBType = DcDefine.DBSQL;
//         let cBPath = MApp.setBasePath();
//         let cCmpNo = MApp._evlSTU(this.oEntDict["M00"].FIELD01);
//         let cCmpNM = MApp._evlStr(this.oEntDict["M00"].FIELD02).trim();
//         let cGrpNM = MApp._evlStr(this.oEntDict["M00"].FIELD11);
//         let TbleYr = '';
//         let newDb
//         let newDatabase = '';

//         this.oEntDict["M00"].FIELD81 = MApp._evlSTU(this.oEntDict["M00"].FIELD81, LangType.English);
//         this.oEntDict["M00"].DBSVER = 0;

//         try {
//             //--------------------------------------------------------

//             let admin = this.cUserID
//             // encryptor.decrypt(this.cUserID);
//             const existingAdmin = await PLSDBADMI.findAll();
//             for (let i of existingAdmin) {
//                 const decrypted = encryptor.decrypt(i.ADMIF01)
//                 if (decrypted == admin) {
//                     admin = i;
//                 }
//             }
//             if (!admin) {
//                 let response = {
//                     message: 'Invalid UserId'
//                 }
//                 let encryptedResponse = encryptor.encrypt(JSON.stringify(response));
//                 return res.status(400).json({ encryptedResponse });
//             }
//             let corpids = await PLRDBA01.findAll({
//                 where: {
//                     A01F03: {
//                         [Op.like]: '%PL-P%'
//                     }
//                 }
//             });
//             let result;
//             let corpNumbers = corpids.map(item => parseInt(item.A01F03.slice(5))).filter(Number.isFinite);
//             let nextCorpNum = (corpNumbers.length > 0 ? Math.max(...corpNumbers) : 0) + 1;
//             nextCorpId = 'PL-P-' + nextCorpNum.toString().padStart(5, '0');
//             targetDbName = 'A' + nextCorpNum.toString().padStart(5, '0') + 'CMP' + this.cmpNum;
//             do {
//                 result = await sequelizeMaster.query(
//                     `SELECT name FROM sys.databases WHERE name = :targetDbName`,
//                     {
//                         replacements: { targetDbName },
//                         type: Sequelize.QueryTypes.SELECT,
//                     }
//                 );

//                 if (result) {
//                     const regex = /(\d{4})$/;
//                     const match = targetDbName.match(regex);
//                     this.cmpNum = parseInt(this.cmpNum) + 1

//                     if (match) {
//                         let num = parseInt(match[0], 10);
//                         num += 1;
//                         targetDbName = targetDbName.replace(regex, num.toString().padStart(4, '0'));
//                     } else {
//                         console.log('No match for the numbering pattern.');
//                         break;
//                     }
//                 }
//             } while (result.length > 0);
//             let updateData = {
//                 ADMICORP: nextCorpId || null
//             }
//             if (this.cAction === "A") {
//                 this.oEntDict["M00"].FIELD03 = await MApp.NextNumber(null, "", "", 20, "", ""); // Company GUID

//                 // Clone DB
//                 const sourceDbName = 'A00001CMP0031';
//                 const corpNum = parseInt(nextCorpId.split('-')[2]);

//                 const replaceSuffix = 'YR' + new Date().getFullYear() % 100;
//                 TbleYr = replaceSuffix;

//                 // cError = await dbCloneService.createCloneProcedure();
//                 await dbCloneService.cloneDatabase(sourceDbName, targetDbName, replaceSuffix);
//                 if (cError) return false;

//                 let sequelize = db.getConnection("master");
//                 newDatabase = targetDbName;
//                 const [result] = await sequelize.query(`
//                 SELECT name
//                 FROM sys.databases
//                 WHERE name = :targetDbName;
//                 `, {
//                     replacements: { targetDbName },
//                     type: QueryTypes.SELECT
//                 });
//                 newDb = db.getConnection(targetDbName);

//             }

//             let CS = new CompanyService({ TbleYr: TbleYr, oEntDict: this.oEntDict, databaseName: newDatabase });
//             await CS.getSetF02(false, newDb);

//             // await PLSDBADMI.update(updateData, {
//             //     where: {
//             //         ADMIF00: admin.ADMIF00,
//             //         ADMICORP: null
//             //     }
//             // });

//             let uId = encryptor.decrypt(admin.ADMIF01)

//             let M82F01val = await PLSDBM81.findOne({
//                 where: { M81F03: uId }
//             })

//             await PLSDBM82.create({
//                 M82F01: M82F01val.dataValues.M81F01,
//                 M82F02: parseInt(this.cmpNum),
//                 M82F11: '',
//                 M82F12: '',
//                 M82F13: '',
//                 M82F14: '',
//                 M82F21: '',
//                 M82F22: '',
//                 M82F23: '',
//                 M82CMP: parseInt(this.cmpNum) == 1 ? 'Y' : 'N',
//                 M82YRN: '',
//                 M82ADA: '',
//             });



//         } catch (ex) {
//             console.error(ex);
//             if (this.cAction === "A") {
//                 this.RemoveCompany(this.oEntDict["M00"].FIELD01.toString(), cError, CustId);
//             }
//             cError = ex.message;
//         }

//         return true;
//     }

//     async GetDictionary(decoded)   // In Case Edit Mode Then Pass Company Object
//     {
//         // Company M00 Defaul Fields
//         let oEntDict = {};
//         //-------------------------------------------------------
//         let DT = await PLSYS13.findAll({
//             where: { S13F01: 'M00' }
//         });
//         // MApp.IDB.GetTable("PLSYS13", "S13F02", "", "S13F01 = 'M00'", "S13F02");
//         for (let nI of DT)
//             oEntDict[(nI.S13F02).toString().trim().toUpperCase()] = "";
//         // Year Date Range Primary
//         if (this.cAction == "G") {
//             let SYr = new Date().getFullYear() - (((new Date().getMonth() + 1) < 4) ? 1 : 0);
//             let EYr = SYr + 1;
//             oEntDict.DSDATE = MApp.DTOS(new Date(SYr, 4, 1), true);    // Finantial year Start Date MM/dd/yyyy Format
//             oEntDict.DEDATE = MApp.DTOS(new Date(EYr, 3, 31), true);   // End Date MM/dd/yyyy Format
//         }
//         else {
//             oEntDict.DSDATE = MApp.DTOS(oCmp.oYear.dSDate, true);    // Finantial year Start Date MM/dd/yyyy Format
//             oEntDict.DEDATE = MApp.DTOS(oCmp.oYear.dEDate, true);   // End Date MM/dd/yyyy Format
//         }
//         // Company Edit Then Load Company And Fill Its M00 & F02 Info 
//         if (this.oCmp == null) {
//             oEntDict["FIELD01"] = await MApp.GetEmptyCmpNo(decoded);          // Company No - Empty No 
//             oEntDict["FIELD02"] = "";                            // Company Name
//         }
//         else {
//             MApp.pc.CopyDicToDic(new M00Table(oCmp).GetDictionary(oCmp.cCmpNo, "", false, true), oEntDict);
//         }

//         // Filling Company Info like Address & Other & Bank Info & Company Logo
//         CompanyService.getSetF02(true);
//         this.SetDefValue();
//         return oEntDict;
//     }
// }

// module.exports = CmpMasterconst CompanyService = require("../../../Controller/companySetupCOntroller");
const Encryptor = require("../../../Services/encryptor");
const { DcDefine } = require("../../../DataClass/Class/DcDefine");
const dbCloneService = require("../../../Services/dbCloneService");
const Define = require("../../commonClass/define");
const { MApp, LangType } = require("../../commonClass/plusCommon");
const PlusInfo = require("../AppCls/PlusInfo");
const db = require('../../../Config/config'); // Your Database class
const sequelizeSDB = db.getConnection('A00001SDB');
const sequelizeRDB = db.getConnection('RDB');
const sequelizeIDB = db.getConnection('IDBAPI');
const sequelizeMaster = db.getConnection('master');
const definePLSDBADMI = require('../../../Models/SDB/PLSDBADMI');
const definePLSDBM81 = require('../../../Models/SDB/PLSDBM81');
const definePLSDBM82 = require('../../../Models/SDB/PLSDBM82');
const definePLRDBA01 = require('../../../Models/RDB/PLRDBA01'); // Model factory
const definePLSYS13 = require('../../../Models/IDB/PLSYS13'); // Model factory
const definePLSYSF02 = require('../../../Models/IDB/PLSYSF02'); // Model factory
const PLSDBM82 = definePLSDBM82(sequelizeSDB);
const PLSDBM81 = definePLSDBM81(sequelizeSDB);
const PLSDBADMI = definePLSDBADMI(sequelizeSDB);
const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const PLSYS13 = definePLSYS13(sequelizeIDB);
const PLSYSF02 = definePLSYSF02(sequelizeIDB);
const SCMPTable = require("../STable/SCMPTable");
const SM82Table = require("../STableCls/SM82Table");
const { Sequelize, QueryTypes, Op } = require("sequelize");
const SDBHandler = require("../STableCls/SDBHandler");
const M00Table = require("../MTableCls/M00Table");
const encryptor = new Encryptor();

class CmpMaster extends PlusInfo {
    static cAction = "";  // Initialize cAction as an empty string
    static defComp = 'Y';
    static compNo = '0001';
    static oCmp;
    static oYear;

    // Constructor with necessary parameters
    constructor(cUserID, existingCorpId, LangType, cAction, oEntDict, decoded) {
        super(LangType);
        this.cUserID = cUserID;
        this.existingCorpId = existingCorpId;
        this.cAction = cAction;
        this.oEntDict = oEntDict ? oEntDict : [];  // Instance-level dictionary initialized
        this.SDBH = new SDBHandler('A00001SDB');
        this.decoded = decoded;
        this.targDB;
    }

    // Set default values for the properties
    SetDefValue() {
        let Mp = new MApp();

        // Set default values for the fields in oEntDict dictionary
        console.log(this.oEntDict);
        this.oEntDict["M00"].FIELD10 = MApp._evlSTU(this.oEntDict["M00"]?.M00V01, "");               // Short Name
        this.oEntDict["M00"].M00V01 = MApp._evlSTU(this.oEntDict["M00"]?.M00V01, Define.CDBVer);     // Company Database Version 1,2, 3 etc
        this.oEntDict["M00"].M00V02 = MApp._evlSTU(this.oEntDict["M00"]?.M00V02, Define.CodeVer);    // Company Code Version 1,2,3 etc
        this.oEntDict["M00"].M00V03 = MApp._evlSTU(this.oEntDict["M00"]?.M00V03, Mp.SoftType);     // Company Software Type (Plus-PL, Kishan, KP, Pharma - ....)
        this.oEntDict["M00"]._COUNTRY = MApp._evlSTU(this.oEntDict["M00"]._COUNTRY, "C0000095");     // Country - Default India
        this.oEntDict["M00"]._STATE = MApp._evlSTU(this.oEntDict["M00"]?._STATE, "ST000012");         // State - Default Gujarat
        this.oEntDict["M00"].FIELD81 = MApp._evlSTU(this.oEntDict["M00"]?.FIELD81, LangType.English); // Language - Default English
        this.oEntDict["M00"].FIELD25 = MApp._evlStr(this.oEntDict["M00"]?.FIELD25, "GENERAL");        // Category code for patch Company
        this.oEntDict["M00"].FIELD11 = MApp._evlStr(this.oEntDict["M00"]?.FIELD11, " No Group");      // Group Name
    }

    // Method to save the company
    async SaveCompany(nextCorpId, cError, oCUser, lInitCmp, CustId) {
        this.SetDefValue();

        let cDBType = DcDefine.DBSQL;
        let cBPath = MApp.setBasePath();
        let cCmpNo = MApp._evlSTU(this.oEntDict["M00"].FIELD01);
        let cCmpNM = MApp._evlStr(this.oEntDict["M00"].FIELD02).trim();
        let cGrpNM = MApp._evlStr(this.oEntDict["M00"].FIELD11);
        let TbleYr = '';
        let newDb;
        let newDatabase = '';

        this.oEntDict["M00"].FIELD81 = MApp._evlSTU(this.oEntDict["M00"].FIELD81, LangType.English);
        this.oEntDict["M00"].DBSVER = 0;

        try {
            //--------------------------------------------------------

            let admin = this.cUserID;
            admin = encryptor.decrypt(admin);
            const existingAdmin = await PLSDBADMI.findAll();
            for (let i of existingAdmin) {
                const decrypted = encryptor.decrypt(i.ADMIF01);
                if (decrypted == admin) {
                    admin = i;
                }
            }
            if (!admin) {
                let response = {
                    message: 'Invalid UserId'
                };
                let encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                return res.status(400).json({ encryptedResponse });
            }
            let corpids = await PLRDBA01.findAll({
                where: {
                    A01F03: {
                        [Op.like]: '%PL-P%'
                    }
                }
            });
            let userUid = await PLSDBM81.findOne({
                where: {
                    M81CHLD: admin.ADMIF00
                }
            });
            let cmpNumbers = await PLSDBM82.findAll({
                attributes: ['M82F02'],
                where: {
                    M82F01: userUid.M81F01
                },
                order: [['M82F02', 'DESC']]
            });
            let lastCompanyNumber = cmpNumbers.length > 0 ? cmpNumbers[0].M82F02 : 0
            const companyNumbers = cmpNumbers.map(row => row.M82F02);
            if (companyNumbers.length != 0) {
                for (let i = 1; i <= lastCompanyNumber; i++) {
                    if (!companyNumbers.includes(i)) {
                        this.cmpNum = i;
                        break;
                    }
                }
            }
            let result;
            let targetDbName;
            let nextCorpId;
            if (this.decoded) {
                let cNum = this.decoded.corpId.split('-');
                nextCorpId = this.decoded.corpId;
                targetDbName = 'A' + cNum[2].toString().padStart(5, '0') + 'CMP' + this.cmpNum.toString().padStart(4, '0');
                this.targDB = targetDbName;
            } else {
                let corpNumbers = corpids.map(item => parseInt(item.A01F03.slice(5))).filter(Number.isFinite);
                let nextCorpNum = (corpNumbers.length > 0 ? Math.max(...corpNumbers) : 0) + 1;
                nextCorpId = 'PL-P-' + nextCorpNum.toString().padStart(5, '0');
                targetDbName = 'A' + nextCorpNum.toString().padStart(5, '0') + 'CMP' + this.cmpNum.toString().padStart(4, '0');
                this.targDB = targetDbName;
            }
            do {
                result = await sequelizeMaster.query(
                    `SELECT name FROM sys.databases WHERE name = :targetDbName`,
                    {
                        replacements: { targetDbName },
                        type: Sequelize.QueryTypes.SELECT,
                    }
                );

                if (result.length > 0) {
                    console.log(result);
                    const regex = /(\d{4})$/;
                    const match = targetDbName.match(regex);
                    this.cmpNum = parseInt(this.cmpNum) + 1;

                    if (match) {
                        let num = parseInt(match[0], 10);
                        num += 1;
                        targetDbName = targetDbName.replace(regex, num.toString().padStart(4, '0'));
                    } else {
                        console.log('No match for the numbering pattern.');
                        break;
                    }
                }
            } while (result.length > 0);
            let updateData = {
                ADMICORP: nextCorpId || null
            };
            if (this.cAction === "A") {
                this.oEntDict["M00"].FIELD03 = await MApp.NextNumber(null, "", "", 20, "", ""); // Company GUID

                // Clone DB
                const sourceDbName = 'A00001CMP0031';
                const corpNum = parseInt(nextCorpId.split('-')[2]);

                const replaceSuffix = 'YR' + new Date().getFullYear() % 100;
                TbleYr = replaceSuffix;

                await dbCloneService.cloneDatabase(sourceDbName, targetDbName, replaceSuffix, this.oEntDict["M00"].DSDATE, this.oEntDict["M00"].DEDATE);
                if (cError) return false;

                let sequelize = db.getConnection("master");
                newDatabase = targetDbName;
                const [result] = await sequelize.query(`
                SELECT name
                FROM sys.databases
                WHERE name = :targetDbName;
                `, {
                    replacements: { targetDbName },
                    type: QueryTypes.SELECT
                });
                newDb = db.getConnection(targetDbName);
            }

            let CS = new CompanyService({ TbleYr: TbleYr, oEntDict: this.oEntDict, databaseName: newDatabase });
            if (await CS.getSetF02(false, newDb)) {
                return true;
            } else {
                return {result :false, CmpNum : newDatabase.slice(-4), cSdata : this.oEntDict };
            }

        } catch (ex) {
            console.error(ex);
            if (this.cAction === "A") {
                await sequelizeMaster.query(`DROP DATABASE ${this.targDB}`, { type: QueryTypes.RAW });
            }
            cError = ex.message;
        }

        return true;
    }

    async GetDictionary(decoded, dbName, LType) {
        // Fill oEntDict directly for the instance
        let DT = await PLSYS13.findAll({
            where: { S13F01: 'M00' }
        });
        for (let nI of DT) {
            // Log the value of S13F02 for debugging
            console.log('Processing S13F02:', nI.S13F02);

            // Ensure 'M00' exists in oEntDict before assigning to it
            if (this.oEntDict.length == 0) {
                this.oEntDict["M00"] = {};  // Initialize M00 if it doesn't exist
                console.log("Initialized M00 in oEntDict");
            }

            // Validate and clean the S13F02 value
            const rawValue = nI.S13F02 && nI.S13F02.toString().trim();

            // Skip invalid or empty values for S13F02
            if (!rawValue) {
                console.warn('Skipping invalid or empty S13F02 value:', nI.S13F02);
                continue; // Skip this iteration and move to the next
            }

            const key = rawValue.toUpperCase();

            // Log the key being generated for better debugging
            console.log('Generated Key:', key);

            // Check if the key already exists in M00 to prevent overwriting
            if (this.oEntDict["M00"][key] !== undefined) {
                console.warn('Key already exists in M00:', key);
            } else {
                // Add or update the key in oEntDict["M00"]
                this.oEntDict["M00"][key] = "";
                console.log('Added Key:', key, 'to oEntDict["M00"]');
            }
        }

        // Optionally, log the final object to see the results
        console.log('Final oEntDict["M00"]:', this.oEntDict["M00"]);


        // Optionally log the final object for debugging
        console.log('Final oEntDict["M00"]:', this.oEntDict["M00"]);



        // Year Date Range Primary
        if (this.cAction == "G" || this.cAction == "A") {
            let SYr = new Date().getFullYear() - (((new Date().getMonth() + 1) < 4) ? 1 : 0);
            let EYr = SYr + 1;
            this.oEntDict["M00"].FIELD01 = await MApp.GetEmptyCmpNo(decoded); // Company No
            this.oEntDict["M00"].DSDATE = MApp.DTOS(new Date(SYr, 4, 1), true);    // Financial year start date
            this.oEntDict["M00"].DEDATE = MApp.DTOS(new Date(EYr, 3, 31), true);   // Financial year end date
        } else {
            // this.oEntDict["M00"].DSDATE = MApp.DTOS(M82, true);    // Financial year start date
            // this.oEntDict["M00"].DEDATE = MApp.DTOS(M92, true);   // Financial year end date
        }

        if (this.oCmp == null) {
            this.oEntDict["M00"].FIELD01 = await MApp.GetEmptyCmpNo(decoded); // Company No
            this.oEntDict["M00"].FIELD02 = "";                               // Company Name
        } else {
            let oM00setup = (new M00Table(this.oCmp, dbName, LType).getDictionary(this.oCmp.cCmpNo, "", false, true), this.oEntDict);
        }

        let CS = new CompanyService({ oCmp: this.oCmp, oEntDict: this.oEntDict });
        await CS.getSetF02(true, dbName, '', this.lCode);
        this.SetDefValue();

        return this.oEntDict;
    }

    async dtM00Grp(cUserid) {
        let dtR = [];  // This will store the unique groups.
        let dT = await this.SDBH.GetUserCmpList(cUserid);

        for (let dr of dT) {
            let cVal = dr.CMPF04.toString().trim();

            // Check if cVal is already present in dtR
            let exists = dtR.some(item => item.Grp === cVal);

            // If not exists, add dr1 to dtR
            if (!exists) {
                let dr1 = {};
                dr1["Grp"] = cVal;
                dtR.push(dr1);
            }
        }

        return dtR;
    }

}

module.exports = CmpMaster;