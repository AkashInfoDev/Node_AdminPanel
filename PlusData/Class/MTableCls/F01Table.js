const PlusTable = require("../AppCls/PlusTable");
class F01Table extends PlusTable {
    constructor(oYr = null, databaseName, LangType) {
        super(oYr, databaseName, LangType); // Call to parent class constructor
        this.oYear = oYr; // Store the Year object
        this.oCmp = this.oYear?.oCmp; // Optional chaining to safely access oCmp
        this.initCls(); // Initialize class fields based on oYear
    }

    // Initialize fields (this could be moved to the constructor directly if not needed elsewhere)
    initCls() {
        this.cTable = 'CMPF01'; // Construct table name dynamically based on the year
        this.cFldPrefix = 'F01'; // Field prefix constant
        this.CodeField = 'FIELD01'; // Code field name constant
        this.cUSCode = 'M0000105'; // User security code constant
        this.CodeAct = "ED";
        this.cModuleID = "F01Table";
        this.lMXXReq = false; // MXX Required flag (set to false by default)
        this.lImgReq = false; // Image Required flag (set to false by default)
    }

    // Static method to fetch dictionary, forwarding the call to PlusTable's GetDictionary
    async getDictionary(cCode, cWhere, lAddNew, lFull) {
        return await this.GetDictionary(cCode, cWhere, lAddNew, lFull);
    }

    async saveDataDict(oEntD, lValidate, cBeginID, lDelete, cDelWhr) {
        if (await this.SaveDataDict(oEntD, lValidate, cBeginID, lDelete, cDelWhr)) {
            return true;
        } else {
            return false;
        }
    }

    async GetListByQry(cWhr = "") {
        cWhr = cWhr ? MApp.AndOr("ISNULL(FLDAED,'')!='D'", cWhr, "AND", 3) : '';
        let cQry = "SELECT FIELD01 AS YearNo, Field02 AS strtDate, FIELD03 AS endDate from CMPF01";

        if (cWhr)
            cQry += " WHERE " + cWhr;
        
        let result = await dbconn.query(cQry, {
            type: sequelizeIDB.QueryTypes.SELECT
        })
    }
}

module.exports = F01Table; // Export the class for use in other parts of the application