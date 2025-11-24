const CompanyService = require("../../../Controller/companySetupCOntroller");
const Encryptor = require("../../../Services/encryptor");
const { DcDefine } = require("../../../DataClass/Class/DcDefine");
const dbCloneService = require("../../../Services/dbCloneService");
const Define = require("../../commonClass/define");
const { MApp, LangType } = require("../../commonClass/plusCommon");
const PlusInfo = require("../AppCls/PlusInfo");
const db = require('../../../Config/config'); // Your Database class
const sequelizeSDB = db.getConnection('A00001SDB');
const sequelizeRDB = db.getConnection('RDB');
const sequelizeMaster = db.getConnection('master');
const definePLSDBADMI = require('../../../Models/SDB/PLSDBADMI');
const definePLSDBM81 = require('../../../Models/SDB/PLSDBM81');
const definePLSDBM82 = require('../../../Models/SDB/PLSDBM82');
const definePLRDBA01 = require('../../../Models/RDB/PLRDBA01'); // Model factory
const PLSDBM82 = definePLSDBM82(sequelizeSDB);
const PLSDBM81 = definePLSDBM81(sequelizeSDB);
const PLSDBADMI = definePLSDBADMI(sequelizeSDB);
const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const SCMPTable = require("../STable/SCMPTable");
const SM82Table = require("../STableCls/SM82Table");
const { Sequelize, QueryTypes, Op } = require("sequelize");
const encryptor = new Encryptor();

class CmpMaster extends PlusInfo {
    static oEntDict = {};             // Initialize oEntDict as an empty object
    static cAction = "";              // Initialize cAction as an empty string
    static defComp = 'Y'
    static compNo = '0001';
    CmpMaster(lCode) {
        // super();
        this.lCode = lCode;            // Initialize the lCode property
        this.cEMsg = "";                // Initialize cEMsg as an empty string
        this.cOEgKey = "";              // Initialize cOEgKey as an empty string
        this.cCmpNo = "";               // Initialize cCmpNo as an empty string
    }

    constructor(cUserID, existingCorpId) {
        super();
        this.cUserID = cUserID;
        this.existingCorpId = existingCorpId;
        this.cmpNum = '0001'
    }


    // Set default values for the properties
    static SetDefValue() {

        let Mp = new MApp();

        // Set default values for the fields in oEntDict dictionary
        this.oEntDict["M00"].FIELD10 = MApp._evlSTU(this.oEntDict["M00"].M00V01, "");               // Short Name
        this.oEntDict["M00"].M00V01 = MApp._evlSTU(this.oEntDict["M00"].M00V01, Define.CDBVer);     // Company Database Version 1,2, 3 etc
        this.oEntDict["M00"].M00V02 = MApp._evlSTU(this.oEntDict["M00"].M00V02, Define.CodeVer);    // Company Code Version 1,2,3 etc
        this.oEntDict["M00"].M00V03 = MApp._evlSTU(this.oEntDict["M00"].M00V03, Mp.SoftType);     // Company Software Type (Plus-PL, Kishan, KP, Pharma - ....)
        this.oEntDict["M00"]._COUNTRY = MApp._evlSTU(this.oEntDict["M00"]._COUNTRY, "C0000095");     // Country - Default India
        this.oEntDict["M00"]._STATE = MApp._evlSTU(this.oEntDict["M00"]._STATE, "ST000012");         // State - Default Gujarat
        this.oEntDict["M00"].FIELD81 = MApp._evlSTU(this.oEntDict["M00"].FIELD81, LangType.English); // Language - Default English
        this.oEntDict["M00"].FIELD25 = MApp._evlStr(this.oEntDict["M00"].FIELD25, "GENERAL");        // Category code for patch Company
        this.oEntDict["M00"].FIELD11 = MApp._evlStr(this.oEntDict["M00"].FIELD11, " No Group");      // Group Name
    }

    // Method to save the company
    async SaveCompany(nextCorpId, cError, oCUser, lInitCmp, CustId) {
        CmpMaster.SetDefValue();

        let cDBType = DcDefine.DBSQL;
        let cBPath = MApp.setBasePath();
        let cCmpNo = MApp._evlSTU(CmpMaster.oEntDict["M00"].FIELD01);
        let cCmpNM = MApp._evlStr(CmpMaster.oEntDict["M00"].FIELD02).trim();
        let cGrpNM = MApp._evlStr(CmpMaster.oEntDict["M00"].FIELD11);
        let TbleYr = '';
        let newDb
        let newDatabase = '';

        CmpMaster.oEntDict["M00"].FIELD81 = MApp._evlSTU(CmpMaster.oEntDict["M00"].FIELD81, LangType.English);
        CmpMaster.oEntDict["M00"].DBSVER = 0;

        try {
            //--------------------------------------------------------

            let admin = this.cUserID
            // encryptor.decrypt(this.cUserID);
            const existingAdmin = await PLSDBADMI.findAll();
            for (let i of existingAdmin) {
                const decrypted = encryptor.decrypt(i.ADMIF01)
                if (decrypted == admin) {
                    admin = i;
                }
            }
            if (!admin) {
                let response = {
                    message: 'Invalid UserId'
                }
                let encryptresponse = encryptor.encrypt(JSON.stringify(response));
                return res.status(400).json({ encryptresponse });
            }
            let corpids = await PLRDBA01.findAll({
                where: {
                    A01F03: {
                        [Op.like]: '%PL-P%'
                    }
                }
            });
            let result;
            let corpNumbers = corpids.map(item => parseInt(item.A01F03.slice(5))).filter(Number.isFinite);
            let nextCorpNum = (corpNumbers.length > 0 ? Math.max(...corpNumbers) : 0) + 1;
            let nextCorpId = 'PL-P-' + nextCorpNum.toString().padStart(5, '0');
            let targetDbName = 'A' + nextCorpNum.toString().padStart(5, '0') + 'CMP' + this.cmpNum;
            do {
                result = await sequelizeMaster.query(
                    `SELECT name FROM sys.databases WHERE name = :targetDbName`,
                    {
                        replacements: { targetDbName },
                        type: Sequelize.QueryTypes.SELECT,
                    }
                );

                if (result) {
                    const regex = /(\d{4})$/;
                    const match = targetDbName.match(regex);
                    this.cmpNum = parseInt(this.cmpNum) + 1

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
            }
            if (CmpMaster.cAction === "A") {
                CmpMaster.oEntDict["M00"].FIELD03 = await MApp.NextNumber(null, "", "", 20, "", ""); // Company GUID

                // Clone DB
                const sourceDbName = 'A00001CMP0031';
                const corpNum = parseInt(nextCorpId.split('-')[2]);

                const replaceSuffix = 'YR' + new Date().getFullYear() % 100;
                TbleYr = replaceSuffix;

                // cError = await dbCloneService.createCloneProcedure();
                await dbCloneService.cloneDatabase(sourceDbName, targetDbName, replaceSuffix);
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

            let CS = new CompanyService({ TbleYr: TbleYr, oEntDict: CmpMaster.oEntDict, databaseName: newDatabase });
            await CS.getSetF02(false, newDb);

            // await PLSDBADMI.update(updateData, {
            //     where: {
            //         ADMIF00: admin.ADMIF00,
            //         ADMICORP: null
            //     }
            // });

            let uId = encryptor.decrypt(admin.ADMIF01)

            let M82F01val = await PLSDBM81.findOne({
                where: { M81F03: uId }
            })

            await PLSDBM82.create({
                M82F01: M82F01val.dataValues.M81F01,
                M82F02: parseInt(this.cmpNum),
                M82F11: '',
                M82F12: '',
                M82F13: '',
                M82F14: '',
                M82F21: '',
                M82F22: '',
                M82F23: '',
                M82CMP: parseInt(this.cmpNum) == 1 ? 'Y' : 'N',
                M82YRN: '',
                M82ADA: '',
            });



        } catch (ex) {
            console.error(ex);
            if (this.cAction === "A") {
                this.RemoveCompany(this.oEntDict["M00"].FIELD01.toString(), cError, CustId);
            }
            cError = ex.message;
        }

        return true;
    }
}

module.exports = CmpMaster;