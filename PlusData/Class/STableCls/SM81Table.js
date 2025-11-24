const { MApp } = require("../../commonClass/plusCommon");
const PlusTable = require("../AppCls/PlusTable");

class SM81Table extends PlusTable{
    constructor(SDBH) {
        super();
        this.oSDB = SDBH; // Database handler (you'll need to implement or import this)
        this.InitCls();
    }

    InitCls() {
        super.cTable = "PLSDBM81";      // Base Table Name
        super.CodeField = "M81F01";     // Table Code Field
        super.cFldPrefix = "M81";       // Field Prefix
        super.cUSCode = "";             // User Security Code
        super.CodeAct = "ED";           // Edit, Delete, user Fields Default
        super.cModuleID = "SM81Table";  // Module ID for Locking Validation
        super.cADAFld = "M81ADA";      // Active/Deactive Status Field
        super.lMXXReq = false;          // Method To Process MXX Save in Case of SaveDataDic & Delete DataDic
        super.lImgReq = false;
    }

    static async GetDataRow(cCode = "", cWhere = "", lAddNew = false, lFull = false) {
        let cErr = "";

        // Try to get the row from the database
        let dr = await super.GetDataRow(cWhere, lAddNew);
        
        if (!dr) {
            if (MApp.SDBH) {
                MApp.SDBH.oCon.end();  // Close current DB connection
                MApp.SDBH = null;  // Clear the handler
            }

            await MApp.LoadSDB(MApp.RDBH.RDB_CustID, (err) => {
                if (err) {
                    MApp.IDB.SetError(`LoadSDB Error: ${err}`);
                }
            });

            // Retry fetching data after reloading the DB connection
            dr = await this.getRowFromDatabase(cWhere, lAddNew);
            if (!dr) {
                MApp.IDB.SetError(`SM81.Error => ${cCode} ${cWhere}`);
            }
        }

        return dr;
    }
}

module.exports = SM81Table