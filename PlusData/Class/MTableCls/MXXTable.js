const PlusTable = require("../AppCls/PlusTable");

class MXXTable extends PlusTable {
    constructor(oTCmp = null, oYr = null) {
        super();
        this.oCmp = oTCmp;
        this.oYear = oYr;
        this.InitCls();
    }

    InitCls() {
        this.cTable = 'PLUSMXX';
        this.CodeField = '';
        this.cFldPrefix = 'MXX';
        this.cUSCode = '';
        this.CodeAct = 'ED';
        this.cModuleID = 'MXXTable';
        this.lMXXReq = false;
        this.lImgReq = false;
    }

    async UpdateRow(cTblNm, cFldNm, cCode, lCode, cFldData, cBeginID) {
        let cWhere = `MXXTBL='${cTblNm.trim().toUpperCase()}' AND MXXFLD='${cFldNm.trim().toUpperCase()}' AND MXXCOD='${cCode.trim().toUpperCase()}'`;

        this.oEntDict = await this.GetDictionary('', cWhere, true, false);
        this.oEntDict['MXXTBL'] = cTblNm.toUpperCase();
        this.oEntDict['MXXFLD'] = cFldNm.toUpperCase();
        this.oEntDict['MXXCOD'] = cCode.toUpperCase();

        cFldData = cFldData || '';

        if (['01', '02', '03'].includes(lCode)) {
            this.oEntDict['MXXF' + lCode] = cFldData;
        }

        this.oEntDict['MXXF01'] = MApp.pc.EvlStr(this.oEntDict['MXXF01'], cFldData);
        this.oEntDict['MXXF02'] = MApp.pc.EvlStr(this.oEntDict['MXXF02'], cFldData);
        this.oEntDict['MXXF03'] = MApp.pc.EvlStr(this.oEntDict['MXXF03'], cFldData);

        return await this.SaveDataDict(this.oEntDict, false, cBeginID, true, cWhere);
    }

    async UpdateTable(cTblNM, cCode, oEDic, lCode, cBeginID) {
        const lBegin = !cBeginID;
        try {
            const DT = await this.oYear.GetDBS13(cTblNM, "S13F21='Y'");

            if (lBegin) cBeginID = await ODB.Begin();

            for (const DR of DT) {
                const cFldNm = DR['S13F02'].trim().toUpperCase();
                if (oEDic.hasOwnProperty(cFldNm)) {
                    const success = await this.UpdateRow(
                        cTblNM,
                        cFldNm,
                        cCode,
                        lCode,
                        MApp.pc.EvlStr(oEDic[cFldNm]),
                        cBeginID
                    );
                    if (!success) break;
                }
            }

            if (lBegin) {
                if (SaveErr.lError) {
                    await ODB.Rollback(cBeginID);
                } else {
                    await ODB.Commit(cBeginID);
                }
            }
        } catch (Ex) {
            if (lBegin) await ODB.Rollback(cBeginID);
            SaveErr.AddErr(Ex);
        }

        return !SaveErr.lError;
    }

    async DeleteData(cTblNM, cCode, cFldNm = '', cBeginID = '') {
        let cWhere;
        if (!cFldNm) {
            cWhere = `MXXTBL='${cTblNM.trim().toUpperCase()}' AND MXXCOD='${cCode.trim().toUpperCase()}'`;
        } else {
            cWhere = `MXXTBL='${cTblNM.trim().toUpperCase()}' AND MXXFLD='${cFldNm.trim().toUpperCase()}' AND MXXCOD='${cCode.trim().toUpperCase()}'`;
        }
        return await super.DeleteData(cWhere, '', false, cBeginID);
    }

    async SaveDataDict(oEntD = null, lValidate = true, cBeginID = '', lDelete = true, cDelWhr = '') {
        if (!cDelWhr && this.oEntDict) {
            cDelWhr = `MXXTBL='${this.oEntDict["MXXTBL"].trim().toUpperCase()}' AND MXXFLD='${this.oEntDict["MXXFLD"].trim().toUpperCase()}' AND MXXCOD='${this.oEntDict["MXXCOD"].trim().toUpperCase()}'`;
        }
        return await super.SaveDataDict(this.oEntDict, lValidate, cBeginID, lDelete, cDelWhr);
    }

    async InitCmp(cBeginID = '', cWhr = '') {
        const DT = await MApp.IDB.GetTable('PLSYSMXX', '', '', cWhr);
        this.cAction = 'E';
        for (const DR of DT) {
            await this.GetDictionary('', '', true, true);
            this.oEntDict = MApp.pc.CopyDrToDic(DR, this.oEntDict);
            this.oYear.FillDefValInDict(this.cTable, this.oEntDict, true);
            await this.SaveDataDict(this.oEntDict, false, cBeginID, false);
        }
    }
}
module.exports = MXXTable