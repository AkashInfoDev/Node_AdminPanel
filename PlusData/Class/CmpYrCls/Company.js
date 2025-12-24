const db = require('../../../Config/config'); // Your Database class
const DBHandler = require('../../../DataClass/Class/DbHandler');
// const { MApp, LangType } = require('../../commonClass/plusCommon');
const CMMTable = require('../MTableCls/CMMTable');
const SM82Table = require('../STableCls/SM82Table');


class Company {
    constructor(dbName, cCmpNo) {
        this.oCon = db.getConnection(dbName);
        this.lcon = this.oCon ? true : false;
        this.cCmpNo = cCmpNo
    }

    async LoadCMP()   // Method to load company Data Object
    {
        if (!lCon)
            return lCon;
        //if (FullLock(DcDefine.FULLLOCK_CHKOTHER))
        //{
        //    cEMsg = MApp.pc.RC("CMPLOCK", lCode);  // Somewone has locked This Company;Try after Some Time...
        //    ReleaseMe();
        //    return false;
        //}

        //DbcRLock();        // Database Locking User By This User so ...

        await Company.LoadCmpInfo();      // Company Prime Info Like Name, SName etc

        //LoadCmpSetup();     // Method To Load Company Setup all type of Properties


        // //MK => 28/06/2021, 13:32 Structure change from DBF
        //if (!CheckVersion())    // Version Checking & Upgrade Data
        //{
        //    ReleaseMe();
        //    return false;
        //}

        return true;
    }

    static async LoadCmpInfo(MApp, LangType)   // Method To Load Company info
    {
        let DR = oCon.GetRow("CMPM00", "", "ISNULL(FLDAED,'')!='D' AND FIELD01!=0");
        if (DR != null) {
            _NAME = DR.FIELD02.toString().trim();       // Company Name - Actual Company Name Property 
            _SNAME = DR.FIELD10.toString().trim();      // Company Short Name
            _CGuid = DR.FIELD03.toString().trim();      // Company GUID
            _RHEAD1 = DR.FIELD91.toString().trim();      // Company GUID
            _RHEAD2 = DR.FIELD92.toString().trim();      // Company GUID
            _RHEAD3 = DR.FIELD93.toString().trim();      // Company GUID
            _RHEAD4 = DR.FIELD94.toString().trim();      // Company GUID
            if (DR.Table.Columns.Contains("FIELD81"))
                lCode = MApp._evlSTU(DR.FIELD81, LangType.English);       // Language Code Default English Assume
            else
                lCode = LangType.English;
            //userwiseSec = DR.FIELD98.toString().trim();

            //SoftCat = DR.FIELD25.toString().trim();     // Software Category
        }
        SoftCat = "";
    }

    async GetCMM(cFID, cSID = "", cUID = "", cBID = "", cYrNo = "")  // Method To Get Extra Some Data To Company Memory File
    {
        // cFID  - First ID Must Be Req.
        // cSID  - Second ID optional
        // cUID  - User wise then pass User wise optional
        // cYrNo - Year wise then pass Year no optional
        // cBID  - Branch wise then pass branch iD
        let CMM = CMMTable(this);
        return CMM.GetMM(cFID, cSID, cUID, cBID, cYrNo);
    }

    async YrExists(cYrNo, dbName)      // Method To find year Exist or Not
    {
        let DBH = DBHandler(dbName)
        if (!cYrNo)
            return false;
        let cWhr = await MApp.AndOr("ISNULL(FLDAED,'')!='D'", "FIELD01=" + cYrNo.toString().trim(), "AND", 3);
        return await DBH.RowExist("CMPF01", cWhr);
    }

    async GetDefYrNo(cUserID, cCmpNo, dbName)  // Method To Load Default Year
    {
        let SM82 = await SM82Table();
        let cYrNo = await SM82.GetField("", "M82F01='" + cUserID + "' AND M82F02=" + cCmpNo.trim(), "M82YRN");
        if ((cYrNo) && (parseInt(cYrNo) != 0) && (await Company.YrExists(cYrNo, dbName))) {
            return cYrNo;
        }
        return (await GetLastYrNo()).toString();
    }

    static async GetCOPCBODT(GID, lCode, lFromStr = false, dtPLSYSCAP) // Method To Return Combo option DT for Processing
    {
        //lfromStr - true if retrun Table From String Value
        let DTL;
        let cF02, cF01;
        let CBODT = [];
        let oSysDT = [];

        if (lFromStr) {
            DTL = await ArrayToTable(await StrTo2DArray(GID, "~R~", "~C~", 0, true));

            for (let nIn = 0; nIn < DTL.length; nIn++) {
                const cF02 = await RCCap((DTL[nIn].COLUMN0).toString().trim(), lCode, obj.dtPLSYSCAP);
                const cF01 = (DTL[nIn].COLUMN1).toString().trim().toUpperCase();

                CBODT.push({
                    DisplayMember: cF02 != null ? cF02 : '',
                    ValueMember: cF01 != null ? cF01 : ''
                });
            }

            return CBODT;
        }

        let cWhr = "";
        if (GID.includes("~C~")) {
            let aOptn = await StrToArray(GID, "~C~", true);
            GID = aOptn[0].trim().toUpperCase();
            cWhr = aOptn[1].trim();
        }
        lCode = await EVL(lCode, this.lCode);
        let cKey = GID + "-" + lCode;

        // if (cWhr == "" && obj.oSysDT.hasOwnProperty(cKey))
        //     return obj.oSysDT[cKey];

        let cWhere = "COPF03 In (" + await MakeInListClause(GID.trim().toUpperCase(), ",", true) + ")";
        if (cWhr != "")
            cWhere += " AND " + cWhr;
        const DTCop = await DT('poolIDBAPI', 'get', '', 'PLSYSCOP', (obj.cWhere) ? obj.cWhere : cWhere, "COPF03,COPF07");
        // let DTable = (await Mp.LoadCOP()).recordset
        Dtable = DTCop.recordset;
        DTL = await DTCopy(Dtable, cWhere, "COPF07");

        let OSC = obj.finalResults;
        let EV = {};
        EV["OSC"] = OSC ? OSC : obj.OSC;


        let cF06;
        for (nId = 0; nId < DTL.length; nId++) {
            cF06 = (await EvlStr(DTL[nId].COPF06)).trim();
            if (cF06 == "" || await EvalCol(EV, cF06, GID)) {
                cF02 = await RCCap((DTL[nId].COPF02).toString().trim(), lCode, obj.dtPLSYSCAP);
                cF01 = (DTL[nId].COPF01).toString().trim().toUpperCase();
                CBODT.push({
                    DisplayMember: cF02 != null ? cF02 : '',
                    ValueMember: cF01 != null ? cF01 : ''
                });
                // CBODT.push(cF02, cF01);
            }
        }
        // if (EV.lHasError)
        //     Process.Start(EV.logPath);
        if (cWhr == "")
            oSysDT[cKey] = CBODT;

        obj.oSysDT = oSysDT;
        return CBODT;
    }
}

module.exports = Company