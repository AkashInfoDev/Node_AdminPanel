const { MApp } = require("../../commonClass/plusCommon");
const PlusTable = require("../AppCls/PlusTable");
const SCMPTable = require("../STable/SCMPTable");

class M00Table extends PlusTable {
    constructor(param = null, dbName, LangType) {
        super(null, dbName, LangType);
        this.Mp = new MApp();

        this.oCmp = null;
        this.oYear = null;

        if (param?.cCmpNo) {
            this.oCmp = param;
        } else if (param?.cYearID) {
            this.oYear = param;
        }

        this.initCls();
    }

    initCls() {
        this.cTable = "CMPM00";
        this.CodeField = "FIELD01";
        this.cFldPrefix = "M00";
        this.cUSCode = "";
        this.CodeAct = "ED";
        this.cModuleID = "M00Table";
        this.lMXXReq = false;
        this.lImgReq = false;
    }

    async getDictionary(cCode = "", cWhere = "", lAddNew = false, lFull = false) {
        if (this.oCmp) {
            cCode = this.oCmp.cCmpNo;
            lAddNew = false;
        }

        let oEntD = await Promise.resolve(super.GetDictionary(cCode, cWhere, lAddNew, lFull));
        console.log(oEntD);
        
        return this.oEntD["M00"];
    }

    async saveDataDict(oEntD = null, lValidate = true, cBeginID = "", lDelete = true, cDelWhr = "") {
        const saveResult = await super.saveDataDict(oEntD, lValidate, cBeginID, lDelete, cDelWhr);

        if (saveResult) {
            const cmpNo = this.Mp._evlSTU(this.oEntDict["FIELD01"]);
            const cmpName = this.Mp._evlStr(this.oEntDict["FIELD02"]);
            const grpName = this.Mp._evlStr(this.oEntDict["FIELD11"]);

            const scmpTable = new SCMPTable(global.MApp?.SDBH); // Simulated MApp.SDBH
            await scmpTable.updateBasic(cmpNo, cmpName, grpName);
            return true;
        }

        return false;
    }

    async importSave(oVF, cBeginID, lDelete = true, cDelWhr = "") {
        const langCode = LangType.setLangCode(this.Mp._evlSTU(this.oEntDict["FIELD05"]));

        this.oEntDict["FIELD02"] = oVF.oVU.mapUniCode(this.Mp._evlStr(this.oEntDict["FIELD02"]), langCode);
        this.oEntDict["FIELD04"] = oVF.oVU.mapUniCode(this.Mp._evlStr(this.oEntDict["FIELD04"]), langCode);

        return await super.importSave(oVF, cBeginID, lDelete, cDelWhr);
    }
}

module.exports = M00Table