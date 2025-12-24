const PlusTable = require("../AppCls/PlusTable");
// const { MApp } = require('../../commonClass/plusCommon');
const PlusInfo = require("../AppCls/PlusInfo");

class CMMTable extends PlusInfo {
    async InitCls() {
        // Instance variables
        this.cTable = "CMPCMM";
        this.CodeField = "";
        this.cFldPrefix = "CMM";
        this.cUSCode = "";
        this.CodeAct = "ED";
        this.cModuleID = "CMMTable";
        this.lMXXReq = false;
        this.lImgReq = false;
    }
    static async SetMM(cFID, cData, cSID = "", cUID = "", cBID = "", cYrNo = "", MApp) {
        // cFID  - First ID Must Be Req.
        // cData - Data req. to Store
        // cSID  - Second ID optional
        // cUID  - User wise then pass User wise optional
        // cYrNo - Year wise then pass Year no optional
        // cBID  - Branch wise then pass branch iD
        cWhr = "FIELD01='" + cFID.toUpperCase().trim() + "'";

        cSID = await MApp._evlStr(cSID);
        cWhr = await MApp.AndOr(cWhr, "FIELD03='" + cSID.toUpperCase().trim() + "'", "AND");

        //cUID = MApp.pc.EvlStr(cUID);
        //cWhr = MApp.pc.AndOr(cWhr, "CMMF03='" + cUID + "'", "AND");

        //cYrNo = MApp.pc.EvlStr(cYrNo, "00");
        //cWhr = MApp.pc.AndOr(cWhr, "CMMF04='" + cYrNo.toUpperCase().trim() + "'", "AND");

        //cBID = MApp.pc.EvlStr(cBID);
        //cWhr = MApp.pc.AndOr(cWhr, "CMMF05='" + cBID + "'", "AND");

        await super.GetDictionary("", cWhr, true, true);
        if (await NullEmpty(oEntDict.FIELD01)) {
            oEntDict.FIELD01 = cFID;
            oEntDict.FIELD03 = cSID;
            //oEntDict.CMMF03 = cUID;
            //oEntDict.CMMF04 = cYrNo;
            //oEntDict.CMMF05 = cBID;
            oEntDict.FIELD02 = cData;
        }
        else {
            oEntDict.FIELD02 = cData;
        }
        await super.SaveDataDict(oEntDict, false, "", true, cWhr);
        return !SaveErr.hasError();
    }

    static async GetMM(cFID, cSID = "", cUID = "", cBID = "", cYrNo = "", obj, MApp) {
        // cFID  - First ID Must Be Req.
        // cSID  - Second ID optional
        // cUID  - User wise then pass User wise optional
        // cYrNo - Year wise then pass Year no optional
        // cBID  - Branch wise then pass branch iD
        if (Object.keys(obj).includes('Init')) {
            obj.Init = InitCls(obj);
        }
        else {
            let Init = InitCls(obj);
            obj = { ...obj, Init };
        }
        let cWhr = "FIELD01='" + cFID.toUpperCase().trim() + "'";

        cSID = await MApp._evlStr(cSID);
        cWhr = await MApp.AndOr(cWhr, "FIELD03='" + cSID.toUpperCase().trim() + "'", "AND");

        //cUID = MApp.pc.EvlStr(cUID);
        //cWhr = MApp.pc.AndOr(cWhr, "CMMF03='" + cUID + "'", "AND");

        //cYrNo = MApp.pc.EvlStr(cYrNo, "00");
        //cWhr = MApp.pc.AndOr(cWhr, "CMMF04='" + cYrNo.toUpperCase().trim() + "'", "AND");

        //cBID = MApp.pc.EvlStr(cBID);
        //cWhr = MApp.pc.AndOr(cWhr, "CMMF05='" + cBID + "'", "AND");

        let oEntDict = await super.GetDictionary("", cWhr, true, true, obj);
        return await MApp._evlStr(oEntDict["CMM"]?.FIELD02);
    }
}

module.exports = CMMTable