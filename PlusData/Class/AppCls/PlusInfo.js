const DBHandler = require("../../../DataClass/Class/DbHandler");
// const { LangType } = require("../../commonClass/plusCommon");
const Year = require("../CmpYrCls/Year");

class PlusInfo {
    constructor(LangType) {
        // Simulated "NonSerialized" fields
        this.cmpNum = '0001'
        this.ODB = DBHandler; // Database Connection Object
        this._lCode = LangType?.English ? LangType?.English : LangType; // Language Code (default English)
        this.DtS13 = null;
        // this.oYear = new Year;
        this._cLCode = ""; // Current Language Code
        this._myYear = null; // Internal Year object
        this._myCmp = null; // Internal Company object
        this._mySDBH = null; // SDBHandler Object
    }

    static oYear = new Year;

    // Getter and Setter for oYear
    get oYear() {
        return this._myYear;
    }

    set oYear(value) {
        this._myYear = value;
        if (this._myYear != null) {
            this.oCmp = this._myYear.oCmp;
            this.lCode = this._myYear.lCode;
        }
    }

    // Getter and Setter for oCmp
    get oCmp() {
        return this._myCmp;
    }

    set oCmp(value) {
        this._myCmp = value;
        if (this._myCmp != null) {
            this.ODB = this._myCmp.oCon;
            this.lCode = this._myCmp.lCode;
            this.cCmpNo = this._myCmp.cCmpNo;
        }
    }

    // Getter and Setter for lCode
    get lCode() {
        return this._lCode;
    }

    set lCode(value) {
        this._lCode = value;
        if (!this._cLCode) {
            this._cLCode = this._lCode;
        }
    }

    // Getter and Setter for cLCode
    get cLCode() {
        return this._cLCode || this._lCode;
    }

    set cLCode(value) {
        this._cLCode = value;
        if (!this._cLCode) {
            this._cLCode = this._lCode;
        }
    }

    // The GetDBS13 method as a class method
    static async GetDBS13(cTblNM, cWhere = "", cOrderBy = "", obj) {
        if (this.DtS13 == null || this.DtS13.length == 0) {
            await this.LoadS13S14(obj); // Load the data if not already loaded
        }

        cOrderBy = !cOrderBy ? "S13F06" : cOrderBy;

        if (cTblNM) {
            // Update the where clause using AndOr
            cWhere = await DatabaseHelper.AndOr(cWhere, "S13F01='" + cTblNM + "'", "AND", 3);
        }

        // Assuming DTCopy is defined elsewhere, e.g., a utility function
        return await DTCopy(this.DtS13, cWhere, cOrderBy);
    }
}

module.exports = PlusInfo