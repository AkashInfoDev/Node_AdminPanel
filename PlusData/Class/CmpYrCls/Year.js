const PLDic = require('../AppCls/PLDic'); // Your shared OSC dictionary function

const db = require('../../../Config/config'); // Your Database class
const definePLSYSF02 = require('../../../Models/IDB/PLSYSF02'); // Model factory
const definePLSYS13 = require('../../../Models/IDB/PLSYS13'); // Model factory
const definePLSYS14 = require('../../../Models/IDB/PLSYS14'); // Model factory
const { Sequelize, Op } = require('sequelize');
const DBHandler = require('../../../DataClass/Class/DbHandler');
const { MApp } = require('../../commonClass/plusCommon');
const sequelizeIDB = db.getConnection('IDBAPI');

// Initialize model using the Sequelize instance
const PLSYSF02 = definePLSYSF02(sequelizeIDB);
const PLSYS13 = definePLSYS13(sequelizeIDB);
const PLSYS14 = definePLSYS14(sequelizeIDB);

class Year {
    constructor(dbName, tblYr) {
        // this.context = context; // usually: { corporateID, companyID, YrNo }
        this.dbName = dbName;
        this.tblYr = tblYr
        this.DtS13 = null;
        this.DtS14 = null;
        this.pldc = new PLDic();
        this.DBH = new DBHandler(dbName);
        this.Mp = new MApp
    }

    async LoadSetup(cGrpID, oSS = null, aCF02 = null, lBothSame = false, cF01IDs = "") {
        const sequelizeDynamic = db.getConnection(dbName);
        let cRId, cKey, cVal, cType, cSubID = "";

        //------------------------------------------------------------
        if (oSS == null) {
            oSS = await PLDic(); // shared OSC instance
        }

        //------------------------------------------------------------
        if (cGrpID.includes('~C~')) {
            cSubID = cGrpID.substring(7, 4).toUpperCase().trim(); // Sub Group ID
        }
        cGrpID = cGrpID.substring(0, 4).toUpperCase().trim(); // Group ID


        //------------------------------------------------------------
        if (aCF02 == null) {
            aCF02 = await sequelizeDynamic.query(
                `SELECT * FROM ${tableName} WHERE FLDAED != 'D'`,
                { type: sequelizeDynamic.QueryTypes.SELECT }
            );
            // aCF02 = aCF02.recordset;
        }

        //------------------------------------------------------------
        let aSF02 = null;
        if (lBothSame) {
            aSF02 = aCF02;
        } else {
            let cWhere = "";
            if (cSubID) {
                cWhere = "F02F02='" + cSubID + "'";
            }
            cWhere = await AndOr("F02F00='" + cGrpID + "'", cWhere, "AND", 3);

            aSF02 = await DT('poolIDBAPI', 'get', '', 'PLSYSF02', cWhere);
            aSF02 = aSF02.recordset;
        }

        //------------------------------------------------------------
        let lF01Ids = cF01IDs ? true : false;

        for (let SDR of aSF02) {
            cRId = SDR.F02F01.toString().trim().toUpperCase();
            if (lF01Ids && !cF01IDs.includes(cRId)) {
                continue;
            }

            //------------------------------------------------------------
            cKey = await EvlSTU(SDR.F02F04);
            if (!cKey) continue;

            //------------------------------------------------------------
            cType = SDR.F02F05.toString().trim().toUpperCase();

            //------------------------------------------------------------
            if (lBothSame) {
                cVal = SDR.F02F07.toString().trim();
            } else {
                let VDR = await DTSeek(aCF02, { 'FIELD01': cRId }, true, true);
                if (VDR.length > 0) {
                    cVal = await EvlStr(VDR[0].FIELD13, VDR[0].FIELD07).trim();
                } else {
                    cVal = SDR.F02F07.toString().trim();
                }
            }

            //------------------------------------------------------------
            switch (cType) {
                case "1":
                case "2":
                    cVal = cVal.toUpperCase();
                    break;
                case "3":
                case "4":
                case "5":
                case "6":
                case "7":
                    break;
            }

            //------------------------------------------------------------
            if (oSS.hasOwnProperty(cKey)) {
                oSS.cKey = cVal;
            } else {
                oSS[cKey] = cVal;
            }
        }

        //------------------------------------------------------------
        if (oSS.hasOwnProperty("_MULTICUR")) {
            oSS._MULTICUR = "N";
        }

        return oSS;
    }

    // The GetDBS13 method as a class method
    async GetDBS13(cTblNM, cWhere = "", cOrderBy = "") {
        if (this.DtS13 == null || this.DtS13.length == 0) {
            await this.LoadS13S14(); // Load the data if not already loaded
        }

        cOrderBy = !cOrderBy ? "S13F06" : cOrderBy;

        if (cTblNM) {
            // Update the where clause using AndOr
            cWhere = await DatabaseHelper.AndOr(cWhere, "S13F01='" + cTblNM + "'", "AND", 3);
        }

        // Assuming DTCopy is defined elsewhere, e.g., a utility function
        return this.Mp.DTCopy(this.DtS13, cWhere, cOrderBy);
    }

    async LoadS13S14() {
        const dbconn = db.getConnection(this.dbName); 
        // Table Definition Table - Assuming DT is a function that gets data from the database
        this.DtS14 = await PLSYS14.findAll({
            order: ['S14F01']
        });
        // await DT('poolIDBAPI', 'get', '', 'PLSYS14', '', 'S14F01');
        // this.DtS14 = this.DtS14.recordset;

        // Field Definition Table
        this.DtS13 = await PLSYS13.findAll({
            order: ['S13F06']
        })
        // await DT('poolIDBAPI', 'get', '', 'PLSYS13', '', 'S13F06');
        // this.DtS13 = this.DtS13.recordset;

        let DTC = null;
        let OOSC = new OSCData(this.dbName, 'YR' + new Date().getFullYear() % 100);

        let OSC = OOSC.finalResults;
        for (let O of OSC) {
            this.pldc.ADDKEY(Object.keys(O), Object.values(O))
        }
        if (OSC != null && OSC.length > 0) { // Loading Patch Fields and its Structure
            let cPID = "";

            if (this.pldc.GETL("_SHACCREQ")) // Share Setup
                cPID = cPID + (!cPID ? "" : ",") + "'SHARE'";

            if (this.pldc.GETL("_CHLDPROD")) // Child Product
                cPID = cPID + (!cPID ? "" : ",") + "'CHILDPRD'";

            if (this.pldc.GETL("_MULTICUR")) // Multi Currency
                cPID = cPID + (!cPID ? "" : ",") + "'MULTICUR'";

            if (this.pldc.GETL("_COSTCENT")) // Cost Centre
                cPID = cPID + (!cPID ? "" : ",") + "'COSTCENT'";

            if (cPID) { // Loading Patch Records
                DTC = await sequelizeIDB.query(`SELECT * FROM PATCHS14 S14PID In (" + ${cPID} + ") ORDERBY S14F01`, {
                    type: sequelizeIDB.QueryTypes.SELECT
                });
                // DT('poolIDBAPI', 'get', '', 'PATCHS14', "S14PID In (" + cPID + ")", "S14F01");
                DTC = DTC;
                if (DTC.length > 0) this.DtS14 = this.DtS14.concat(DTC);

                DTC = await sequelizeIDB.query(`SELECT * FROM PATCHS13 S13PID In (" + ${cPID} + ") ORDERBY S13F06`, {
                    type: sequelizeIDB.QueryTypes.SELECT
                });
                // DT('poolIDBAPI', 'get', '', 'PATCHS13', "S13PID In (" + cPID + ")", "S13F06");
                // DTC = DTC.recordset;
                if (DTC.length > 0) this.DtS13 = this.DtS13.concat(DTC);
            }
        }

        // Filling Company Data Table For UMaster, UField, Expense etc. and other Tables
        DTC = await dbconn.query(`SELECT * FROM ${tblYr}C14 ORDERBY S14F01`, {
            type: dbconn.QueryTypes.SELECT
        });
        // DT('DynamicPool', 'get', '', '', '', 'S14F01', '', '', obj.corporateID, obj.companyID, obj.YrNo, 'C14');
        DTC = DTC;
        if (DTC.length > 0) this.DtS14 = this.DtS14.concat(DTC);

        DTC = await dbconn.query(`SELECT * FROM ${tblYr}C13 ORDERBY S13F06`, {
            type: dbconn.QueryTypes.SELECT
        });
        // DT('DynamicPool', 'get', '', '', '', 'S13F06', '', '', obj.corporateID, obj.companyID, obj.YrNo, 'C13');
        DTC = DTC;
        if (DTC.length > 0) this.DtS13 = this.DtS13.concat(DTC);

        // Fill Data Types if necessary using DBH.FillDataType (assuming DBH is defined)
        this.DtS13 = await this.DBH.FillDataType(this.DtS13, ddefine.DBSQL);
        return true;
    }
}
class OSCData {
    constructor(dbName, tblYr) {
        this.dbName = dbName;  // Database name
        this.tblYr = tblYr;    // Year-based table name
        this.finalResults = {};  // To store final results
        this.errorResults = {};  // To store error messages
        this.query2List = [];    // To store query2-related data
        this.f02f03List = [];    // To store f02f03 data
    }

    async fetchGeneralInfo() {
        try {
            // Fetch PLSYSF02 data with filter 'F02F00 = 'CCCC''
            const dtPLSYSF02 = await PLSYSF02.findAll({
                where: { F02F00: 'CCCC' }
            });

            // Fetch PLSYSF02 data with specific F02F04 values
            const redtPLSYSF02 = await PLSYSF02.findAll({
                where: {
                    F02F04: {
                        [Op.in]: ['_UNIT1', '_UNIT2', '_DEC1', '_DEC2', '_RATEDEC', '_AMTDEC', '_COUNTRY', '_STATE', '_MESSLINE', '_CMPLOGO', '_GSTINCMP', '_STCD']
                    }
                }
            });

            // Fetch PLSYSIDB data (assuming raw SQL query)
            const dtPLSYSIDB = await sequelizeIDB.query('SELECT * FROM PLSYSIDB', {
                type: sequelizeIDB.QueryTypes.SELECT
            });

            // Check if the data exists
            if (dtPLSYSIDB.length === 0 || dtPLSYSF02.length === 0 || redtPLSYSF02.length === 0) {
                logger.info('Required data not found.');
                return { finalResults: {}, errorResults: {}, query3List: [] };
            }

            // Prepare the f02f03List and query2List for further queries
            this.f02f03List = dtPLSYSF02.map(row => ({
                f02f04: row.F02F04,
                f02f01: row.F02F01,
                f02f07: row.F02F07,
                f02f13: row.F02F13
            }));

            this.query2List = redtPLSYSF02.map(row => ({
                f02f04: row.F02F04,
                f02f01: row.F02F01,
            }));

            // Fetch data for finalResults
            await this.fetchDataForFinalResults();

            return { finalResults: this.finalResults, errorResults: this.errorResults, query2Data: [], query3List: [] };
        } catch (err) {
            logger.error('Error in FinalResults fetchGeneralInfo:', err.message);
            throw new Error('Failed to fetch all general info');
        }
    }

    // Fetch data for finalResults based on f02f03List
    async fetchDataForFinalResults() {
        const queryPromises = this.f02f03List.map(async ({ f02f04, f02f01, f02f07, f02f13 }) => {
            try {
                const dbconn = db.getConnection(this.dbName); // Adjust connection as per your setup
                const tblF02 = generateTableName(this.tblYr, 'F02');
                // Fetch data for FIELD01
                const dtcmptblF02 = await dbconn.query(`SELECT * FROM ${tblF02} WHERE FIELD01 = :f02f01`, {
                    replacements: { f02f01 },
                    type: dbconn.QueryTypes.SELECT
                });

                let field13 = f02f13;
                let field07 = f02f07;

                if (dtcmptblF02.length > 0) {
                    const row = dtcmptblF02[0];
                    field13 = row.FIELD13 ? row.FIELD13.trim() : '';
                    field07 = row.FIELD07 ? row.FIELD07.trim() : '';
                } else {
                    logger.info(`No data found for F02F01 = ${f02f01}`);
                }

                const resultValue = field13 || field07;
                this.finalResults[f02f04] = resultValue;

            } catch (err) {
                logger.error(`Error fetching data for F02F01 = ${f02f01}: ${err.message}`);
                this.errorResults[f02f04] = `Error: ${err.message}`;
            }
        });

        // Wait for all queries to complete
        await Promise.all(queryPromises);

        // Fetch additional data based on query2List
        await this.fetchFromQuery2List();
    }

    // Fetch additional data for query2List
    async fetchFromQuery2List() {
        let f02f01Values = this.query2List.map(({ f02f01 }) => f02f01);

        try {
            const dbconn = sequelizeIDB.getConnection(this.dbName); // Adjust connection as per your setup
            const tblF02 = generateTableName(this.tblYr, 'F02');
            // Fetch data for multiple F02F01 values
            const resultQuery = await dbconn.query(`SELECT * FROM ${tblF02} WHERE FIELD01 IN (:f02f01Values)`, {
                replacements: { f02f01Values },
                type: dbconn.QueryTypes.SELECT
            });

            resultQuery.forEach(row => {
                const f02f04 = row.FIELD01;
                const field13 = row.FIELD13 ? row.FIELD13.trim() : '';
                const field07 = row.FIELD07 ? row.FIELD07.trim() : '';
                const resultValue = field13 || field07;

                this.finalResults[f02f04] = resultValue;
            });

        } catch (err) {
            logger.error(`Error fetching data for F02F01 values: ${f02f01Values}: ${err.message}`);
            this.errorResults = `Error: ${err.message}`;
        }
    }
}

// module.exports = FinalResults;


module.exports = Year;