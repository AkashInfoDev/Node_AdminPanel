// const PlusTable = require("../AppCls/PlusTable");

// class F02Table extends PlusTable {
//     constructor(oYr = null) {
//         super();
//         this.oYear = oYr; // Year object
//         this.oCmp = this.oYear?.oCmp; // optional chaining for null safety
//         this.initCls(); // Initialize class fields
//     }

//     initCls() {
//         this.cTable = this.oYear?.TblYr + 'F02'; // Table name
//         this.cFldPrefix = 'F02';                 // Field Prefix
//         this.CodeField = 'FIELD01';              // Code Field
//         this.cUSCode = '_MNU0114';               // User Security Code
//         this.lMXXReq = false;                    // MXX Required
//         this.lImgReq = false;                    // Image Required
//     }
//     static async getDictionary(cCode, cWhere, lAddNew, lFull){
//         return await super.GetDictionary(cCode, cWhere, lAddNew, lFull);
//     }
// }

// module.exports = F02Table; // Export class if using in other modules


const PlusTable = require("../AppCls/PlusTable");

class F02Table extends PlusTable {
    constructor(oYr = null, databaseName, LangType) {
        super(oYr, databaseName, LangType); // Call to parent class constructor
        this.oYear = oYr; // Store the Year object
        this.oCmp = this.oYear?.oCmp; // Optional chaining to safely access oCmp
        this.initCls(); // Initialize class fields based on oYear
    }

    // Initialize fields (this could be moved to the constructor directly if not needed elsewhere)
    initCls() {
        this.cTable = this.oYear + 'F02'; // Construct table name dynamically based on the year
        this.cFldPrefix = 'F02'; // Field prefix constant
        this.CodeField = 'FIELD01'; // Code field name constant
        this.cUSCode = '_MNU0114'; // User security code constant
        this.lMXXReq = false; // MXX Required flag (set to false by default)
        this.lImgReq = false; // Image Required flag (set to false by default)
    }

    // Static method to fetch dictionary, forwarding the call to PlusTable's GetDictionary
    async getDictionary(cCode, cWhere, lAddNew, lFull) {
        return await this.GetDictionary(cCode, cWhere, lAddNew, lFull);
    }

    async saveDataDict(oEntD, lValidate, cBeginID, lDelete, cDelWhr){
        return await this.SaveDataDict(oEntD, lValidate, cBeginID, lDelete, cDelWhr)
    }
}

module.exports = F02Table; // Export the class for use in other parts of the application
