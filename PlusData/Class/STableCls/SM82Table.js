const { MApp } = require("../../commonClass/plusCommon");
const PlusTable = require("../AppCls/PlusTable");
const SM81Table = require("./SM81Table");
// const db = require('../Config/config'); // Your Database class
// const sequelizeSDB = db.getConnection('A00001SDB');
// const PLSYSM81 = definePLSDBADMI(sequelizeSDB);

class SM82Table extends PlusTable{
    constructor(SDBH) {
        super();
        this.oSDB = SDBH; // Database handler (you'll need to implement or import this)
        this.InitCls();
    }

    InitCls() {
        super.cTable = "PLSDBM82";      // Base Table Name
        super.CodeField = "M82F01";     // Table Code Field
        super.cFldPrefix = "M82";       // Field Prefix
        super.cUSCode = "";             // User Security Code
        super.CodeAct = "ED";           // Edit, Delete, user Fields Default
        super.cModuleID = "SM82Table";  // Module ID for Locking Validation
        super.lMXXReq = false;          // Method To Process MXX Save in Case of SaveDataDic & Delete DataDic
        super.lImgReq = false;

        this.oM81 = new SM81Table(this.oSDB);  // Assuming SM81Table is another class for database access
    }

    async UpdateUser(cCmpNo, cUserID, cBeginID = "") {
        let cWhere = `M82F01='${cUserID}' AND M82F02=${cCmpNo}`;

        // Simulate base.GetDictionary() - Assuming this fetches data from DB
        await super.GetDictionary("", cWhere, true, true);

        // Fill in default creation user in company relation table
        this.oEntDict["M82F01"] = cUserID;  // Cmp Creator user
        this.oEntDict["M82F02"] = cCmpNo;   // Cmp No
        this.oEntDict["M82CMP"] = MApp._evlStr(this.oEntDict["M82CMP"], "N");  // Default Company
        this.oEntDict["M82YRN"] = MApp._evlStr(this.oEntDict["M82YRN"], "00");  // Default Year No
        this.oEntDict["M82ADA"] = MApp._evlStr(this.oEntDict["M82ADA"], "A");  // Default Active

        // Fetch data from another table (PLSYSM81)
        let DR = await PLSYSM81
        MApp.IDB.GetRow("PLSYSM81", "", `M81F01='${cUserID}'`);
        if (DR != null) {
            this.oEntDict["M82F21"] = MApp._evlStr(this.oEntDict["M82F21"], DR["M82F21"]);
            this.oEntDict["M82F22"] = MApp._evlStr(this.oEntDict["M82F22"], DR["M82F22"]);
            this.oEntDict["M82F23"] = MApp._evlStr(this.oEntDict["M82F23"], DR["M82F23"]);
        }

        // Save data to the database
        if (await super.SaveDataDict(this.oEntDict, true, cBeginID, true, cWhere)) {
            // Update group records if not saved
            DR = await new SM81Table(MApp.SDBH).GetDataRow(cUserID);
            if (DR != null && MApp._evlSTU(DR["M81F00"], "U") === "U" && !MApp.NullEmpty(DR["M81F05"])) {
                await this.UpdateUser(cCmpNo, MApp._evlSTU(DR["M81F05"]), cBeginID);
            }
            return true;
        }

        return false;
    }
}

module.exports = SM82Table;