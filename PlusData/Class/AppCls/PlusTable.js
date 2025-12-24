const DBHandler = require("../../../DataClass/Class/DbHandler");
const DatabaseTransaction = require("../../../Services/transactionServices");
const Define = require("../../commonClass/define");
const { MApp } = require("../../commonClass/plusCommon");
// const MXXTable = require("../MTableCls/MXXTable");
// const T82Table = require("../TTable/T82Table");
const CollectError = require("./CollectError");
const PLDic = require("./PLDic");
const PlusInfo = require("./PlusInfo");

class PlusTable extends PlusInfo {
    constructor(OSC, databaseName, LangType) {
        // Initialize DBHandler as an instance
        super(LangType);
        this.transaction = null;
        this.oYr = PlusInfo.oYear
        this.dbName = databaseName
        this.DBHand = new DBHandler(databaseName);
        this.Mp = new MApp();
        // this.info = PlusInfo();
        this.cLCode = super.cLCode;
        this.PLDc = new PLDic(OSC);
        this.SaveErr = new CollectError();
    }

    async InitCls() {
        // Instance variables
        this.cFldPrefix = '';
        this.oEntDict = {};
        this.cExFldStr = '';
        this.nT02Str = '';
        this.oT02Str = '';
        this.CodeField = '';
        this.cTable = '';
        this.cCode = '';
        this.cUSCode = '';
        this.cAction = '';
        this.CodeAct = "EDUBF";  // Action codes
        this.lUserLog = false;
        this.lMXXReq = false;
        this.cCodePrefix = '';
    }

    /**
     * Get Dictionary from DB
     * @param {string} cCode 
     * @param {string} cWhere 
     * @param {boolean} lAddNew 
     * @param {boolean} lFull 
     * @param {object} obj 
     * @param {object} oEnt 
     * @returns {object|null}
     */
    async GetDictionary(cCode = "", cWhere = "", lAddNew = false, lFull = false, obj, oEnt = {}) {
        this.oEntDict = oEnt ? oEnt : this.oEntDict;

        // Ensure DBHand is initialized properly
        lAddNew = lAddNew || false;

        // const init = this.Init;

        try {
            if (!cCode && !cWhere) {
                this.oEntDict[this.cFldPrefix] = await this.DBHand.GetBlankRowDict(
                    this.cTable,
                    "*",
                    this.cExFldStr
                );
            } else {
                if (!cWhere && this.CodeField) {
                    cWhere = cCode ? `${this.CodeField}='${cCode}'` : "";
                }

                if (!lAddNew && !cWhere) {
                    // this.SaveErr.addErr("No Code Field or Where Clause Passed."); // Uncomment and define SaveErr if needed
                    this.oEntDict[this.cFldPrefix] = null;
                    return null;
                }

                this.oEntDict[this.cFldPrefix] = await this.DBHand.GetRowDict(
                    this.cTable,
                    this.cExFldStr,
                    cWhere,
                    lAddNew,
                    obj = {}
                );
            }

            this.oEntDict = await this.SetFldDefValue(this.oEntDict, null, true, obj); // System field fill
            return this.oEntDict;

        } catch (ex) {
            console.error("Exception occurred in GetDictionary:", ex);
            return null;
        }
    }

    /**
     * Placeholder: Fill system fields like RTY, ADA, BRC
     * @param {object} dict 
     * @param {any} param2 
     * @param {boolean} param3 
     * @param {object} obj 
     * @returns {object}
     */
    async SetFldDefValue(oED = null, oEnt = null, lLoad = false, obj) {
        // let init = this.Init;
        const cFP = this.cFldPrefix;
        let cFldNM;
        let oYear = this.oYear;

        // ---------------- START: Update oED Dictionary ----------------
        if (oED && typeof oED === 'object' && Object.keys(oED).length > 0) {
            // Flatten entries like { "M01": { "0": { ... } } } into { "M01": { ... } }
            for (const key in oED) {
                if (oED.hasOwnProperty(key) && typeof oED[key] === 'object') {
                    const innerKeys = Object.keys(oED[key]);
                    if (innerKeys.length === 1 && !isNaN(innerKeys[0])) {
                        oED[key] = oED[key][innerKeys[0]];
                    }
                }
            }

            for (const key in oED) {
                if (oED.hasOwnProperty(key) && typeof oED[key] === 'object') {
                    let entry = oED[key];

                    cFldNM = "FLDAED";
                    if (entry.hasOwnProperty(cFldNM)) {
                        entry[cFldNM] = await MApp._evlSTU(entry[cFldNM]?.trim(), "A");
                    }

                    cFldNM = cFP + "ADA";
                    if (entry.hasOwnProperty(cFldNM)) {
                        entry[cFldNM] = await MApp._evlSTU(entry[cFldNM].trim(), "A");
                    }

                    cFldNM = cFP + "RTY";
                    if (entry.hasOwnProperty(cFldNM)) {
                        entry[cFldNM] = await MApp._evlSTU(entry[cFldNM].trim());
                    }

                    cFldNM = cFP + "LCD";
                    if (entry.hasOwnProperty(cFldNM)) {
                        entry[cFldNM] = this.cLCode;
                    }

                    cFldNM = cFP + "BRC";
                    if (entry.hasOwnProperty(cFldNM)) {
                        if (lLoad && this.oCmp && await MApp.NullEmpty(entry[cFldNM])) {
                            entry[cFldNM] = this.oCmp.cBrcCode;
                        }

                        entry[cFldNM] = await MApp._evlSTU(entry[cFldNM].trim(), this.DEF_BRC_CODE);

                        if (!entry[cFldNM].toString().includes(this.DEF_BRC_CODE)) {
                            entry[cFldNM] += `,${this.DEF_BRC_CODE}`;
                        }
                    }

                    oED[key] = entry;
                }
            }
        }
        // ---------------- END: Update oED Dictionary ----------------

        // ---------------- START: Handle oEnt Row Object ----------------
        if (oEnt && typeof oEnt === 'object' && Object.keys(oEnt).length > 0) {
            cFldNM = cFP + "ADA";
            if (oEnt.hasOwnProperty(cFldNM)) {
                oEnt[cFldNM] = await this.Mp._evlSTU(oEnt[cFldNM], "A");
            }

            cFldNM = cFP + "RTY";
            if (oEnt.hasOwnProperty(cFldNM)) {
                oEnt[cFldNM] = await this.Mp._evlSTU(oEnt[cFldNM]);
            }

            cFldNM = cFP + "LCD";
            if (oEnt.hasOwnProperty(cFldNM)) {
                oEnt[cFldNM] = this.cLCode;
            }

            cFldNM = cFP + "BRC";
            if (oEnt.hasOwnProperty(cFldNM)) {
                if (
                    lLoad &&
                    oYear &&
                    await MApp.NullEmpty(oEnt[cFldNM]) &&
                    this.PLDc.GETL("_BRCREQ", OSC)
                ) {
                    oEnt[cFldNM] = Define.DEF_HOMECODE;
                }

                oEnt[cFldNM] = await this.Mp._evlSTU(oEnt[cFldNM], Define.DEF_BRC_CODE);

                if (!oEnt[cFldNM].toString().includes(Define.DEF_BRC_CODE)) {
                    oEnt[cFldNM] += `,${Define.DEF_BRC_CODE}`;
                }
            }
        }

        // ---------------- END: Handle oEnt ----------------

        return oED;
    }

    async SaveDataDict(oEntD = null, lValidate = true, cBeginID = "", lDelete = true, cDelWhr = "", obj) {
        // oEntD - Dictionary Data Object
        // lValidate - SaveValidation Requied or not Default True - Means always Validate
        // cBeginID - Transaction Begin ID
        // lDelete - Delete + Add Facity req. then pass true so its default delete first old row 

        let oYear = this.oYear;
        const oTSs = new DatabaseTransaction(this.dbName);

        // Dictionary Passed then take its as current entry
        if (oEntD != null)
            this.oEntDict = oEntD;

        if (this.oEntDict == null) {
            this.SaveErr.addErr("Dictionary Not Passed.");
            return false;
        }

        // Save Validation Calling if don't want then pass it false
        if (lValidate && !await this.SaveValidation(false, this.oEntDict, obj)) {
            return false;
        }
        this.cCode = "";
        let lUnLock = false;
        // if Code Field Given & Code Value Empty Then Generate Code
        if (this.CodeField) {
            if (await MApp.NullEmpty(this.oEntDict[this.CodeField])) {
                this.oEntDict[this.CodeField] = await MApp.NextNumber(this.cFldPrefix, true, this.cCodePrefix, this.oEntDict, '', false, obj);
                lUnLock = true;
            }
            this.cCode = (await MApp._evlStr(this.oEntDict[this.CodeField], "")).trim();
        }

        // Delete Entry if Code Present
        if (lDelete && !cDelWhr) {
            lDelete = !this.cCode ? true : false;
            cDelWhr = this.CodeField + "='" + this.cCode + "'";
        }

        // Filling Inbuit Some System Fields Like RTY, ADA, BRC
        await this.SetFldDefValue(this.oEntDict, null, false, obj);

        // if Begin ID Not Passed then start begin and save tables data
        let lCommit = false;
        let ODB = this.oDB;
        let lBegin = !cBeginID ? true : false;
        try {
            if (lBegin)
                cBeginID = await oTSs.begin();
            this.transaction = oTSs.getTransaction();

            //----- EM => 28/03/2019, 17:39
            //---------------------------------------//
            // if (lImgReq) {
            //     lCommit = UploadFile();
            // }
            //---------------------------------------//

            lCommit = await this.DBHand.appendEntryDict(this.cTable, this.oEntDict, lDelete, cDelWhr, this.transaction);
            if (lCommit)
                this.SaveErr.addErr(ODB.cError);


            let oOldEntDict = {};

            if (lCommit && this.lUserLog) {
                //MK => 22/03/2025
                let oT82 = await T82Table();
                if (cAction == "E")
                    oOldEntDict = await this.GetDictionary(cCode);
                await oT82.AddUserLog(oYear, cCode, cTable.replace("YR" + this.YrNo, ""), cBeginID, cAction, oEntDict, oOldEntDict, nT02Str, oT02Str, pTable, obj);
            }

            if (lCommit && this.lMXXReq && this.cCode) {
                lCommit = await SaveMXX(oEntDict, cCode, cBeginID);
                if (!lCommit)
                    this.SaveErr.addErr(ODB.cError);

            }
            if (lBegin) {
                if (lCommit) {
                    // await oTSs.Commit(cBeginID, obj);
                    // if (lL01Rec) {
                    //     oCmp.AddL01Rec(cCode, cEntType + "-" + cAction, cTable.replace(oYear.TblYr, ""));
                    //     Task.Run(() => _notifier.NotifyChangeAsync(oYear));
                    // }
                }
                else
                    await oTSs.rollback(cBeginID, obj);
            }

        }
        catch (Ex) {
            console.error(Ex);
            lCommit = false;
            if (lBegin)
                await oTSs.rollback(cBeginID);
            this.SaveErr.addErr(Ex);
        }

        //if (lUnLock)
        // UnlockRecord(cCode);
        return lCommit;
    }

    async SaveMXX(oEntD, cCode = "", cBeginID = "", obj) {
        const CodeField = this.Init.CodeField;

        if (oEntD != null)
            this.oEntDict = oEntD;

        if (this.oEntDict == null) {
            SaveErr.addErr("Dictionary Object not Passed");
            return false;
        }

        // Code Validation
        if (await this.Mp.NullEmpty(cCode)) {
            if (await NullEmpty(CodeField) || await NullEmpty(this.oEntDict[CodeField])) {
                SaveErr.addErr("Code Or Code Field Object not Passed");
                return false;
            }

            cCode = await this.Mp._evlStr(this.oEntDict[CodeField]).trim().toUpperCase();

            if (await NullEmpty(cCode)) {
                SaveErr.addErr("Code Object not Passed so MXX Can't Work");
                return false;
            }
        }

        // Actual Save Method
        const oMXX = await MXXTable();
        if (!await oMXX.UpdateTable(cTable, cCode, this.oEntDict, lCode, cBeginID, obj)) {
            SaveErr.CopyDic(SaveErr.getBaseDict());
        }

        return !SaveErr.hasError();
    }

    async SaveValidation(lS13F63Valid = false, oEntDict) {
        if (oEntDict == null) {
            console.log("oEntDict Not Passed or Loaded");
            return false; // Optionally return false if oEntDict is not passed
        }

        this.oEntDict = oEntDict; // Set the entry dictionary

        // Check all duplication if S13F63Valid is true
        if (lS13F63Valid) {
            await this.CheckS13F63Valid(oEntDict, '', '', this.obj);
        }

        return !this.SaveErr.hasError();
    }

    async CheckS13F63Valid(oEntD = null, cWhere = "", cFldNm = "") {
        try {
            if (oEntD != null) this.oEntDict = oEntD;

            if (this.oEntDict == null) {
                this.SaveErr.addErr("Entry Object Not Passed.");
                return false;
            }

            // Empty Field Value Duplication Validation - S13F63
            // Define cWhr based on the validation type
            let cWhr = "(S13F63 = 'N' OR S13F63 = 'O' OR S13F63 = 'E')";
            if (!await MApp.NullEmpty(cFldNm)) {
                cWhr = await MApp.AndOr(cWhr, "S13F02='" + cFldNm + "'", "AND", 3);
            }

            let S13 = await this.oYr.GetDBS13(this.obj.Init.cTable, cWhr, '', this.obj);

            if (S13.length > 0) {
                if (!await MApp.NullEmpty(this.oEntDict[this.CodeField])) {
                    cWhere = await MApp.AndOr(this.CodeField + "!='" + this.oEntDict[this.CodeField].toString() + "'", cWhere, "AND", 3);
                }

                for (let DR of S13) {
                    let cDupFld = DR.S13F02.toString().trim();
                    let cS13F63 = await MApp._evlStr(DR.S13F63, "XX");

                    if (cS13F63 == "E") {
                        if (await this.NullEmpty(this.oEntDict[cDupFld])) {
                            this.SaveErr.addErr(cDupFld, await this.RCCap("MSG21", this.lCode, this.obj.dtPLSYSCAP));
                        }
                        continue;
                    }

                    if (cS13F63 == "N") {
                        if (await this.NullEmpty(this.oEntDict[cDupFld])) {
                            this.SaveErr.addErr(cDupFld, await this.RCCap("MSG21", this.lCode, this.obj.dtPLSYSCAP));
                        }
                    }

                    if (cS13F63 == "O" && await this.NullEmpty(this.oEntDict[cDupFld])) {
                        continue;
                    } else {
                        // Check Duplicate Name
                        if (await this.CheckDuplicate(this.obj.Init.cTable, cDupFld, await MApp._evlStr(this.oEntDict[cDupFld]), cWhere, this.obj)) {
                            if (await this.NullEmpty(DR.S13F13)) {
                                this.SaveErr.addErr(cDupFld, await this.RCCap("MSG128", this.lCode, this.obj.dtPLSYSCAP));
                            } else {
                                this.SaveErr.addErr(cDupFld, await this.RCCap(DR.S13F13.toString().trim(), this.lCode, this.obj.dtPLSYSCAP) + " " + await this.RCCap("MSG128", this.lCode, this.obj.dtPLSYSCAP));
                            }
                        }
                    }
                }
            }
        } catch (Ex) {
            console.error(Ex);
            this.SaveErr.addErr(Ex);
        }
        return this.SaveErr.hasError();
    }

}

module.exports = PlusTable;
