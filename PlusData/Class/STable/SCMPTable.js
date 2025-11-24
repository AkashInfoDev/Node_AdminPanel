const PlusTable = require("../AppCls/PlusTable");

class SCMPTable extends PlusTable {
    constructor(dbHandler = null) {
        super();
        this.oSDB = dbHandler;
        this.initCls();
    }

    initCls() {
        super.cTable = "PLSDBCMP";
        super.CodeField = "CMPF01";
        super.cFldPrefix = "CMP";
        super.cUSCode = "";
        super.CodeAct = "ED";
        super.cModuleID = "SCMPTable";
        super.lMXXReq = false;
        super.lImgReq = false;
    }

    async update(cCmpNo, cCmpNm, cGrpNm, cDBType, cBPath, oUser) {
        const cWhere = `CMPF01='${cCmpNo}'`;
        await super.GetDictionary(cCmpNo, cWhere, true, true);

        // Populate entity dictionary
        this.oEntDict["CMPF01"] = cCmpNo;
        this.oEntDict["CMPF02"] = cCmpNm;
        this.oEntDict["CMPF03"] = cDBType;
        this.oEntDict["CMPF04"] = cGrpNm || "No Group";

        this.oEntDict["CMPF11"] = oUser ? oUser.cUserID : (this.oEntDict["CMPF11"] || "U0000001");
        this.oEntDict["CMPF12"] = new Date();

        this.oEntDict["CMPF21"] = global.ODB?.cDBSrvr || "";
        this.oEntDict["CMPF22"] = global.ODB?.cDBUser || "";
        this.oEntDict["CMPF23"] = global.ODB?.cDBPass || "";
        this.oEntDict["CMPF24"] = cBPath;

        return await super.SaveDataDict(this.oEntDict, true, "", true, cWhere);
    }

    async updateBasic(cCmpNo, cCmpNm, cGrpNm) {
        const cWhere = `CMPF01='${cCmpNo}'`;
        await super.GetDictionary(cCmpNo, cWhere, false, true);

        if (!this.oEntDict || Object.keys(this.oEntDict).length === 0) {
            return false;
        }

        const cDBType = this.oEntDict["CMPF03"] || "";
        const cBPath = this.oEntDict["CMPF24"] || "";

        return await this.update(cCmpNo, cCmpNm, cGrpNm, cDBType, cBPath, null);
    }
}

module.exports = SCMPTable