const db = require('../../Config/config'); // Your Database class
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');

const sequelizeSDB = db.getConnection('A00001SDB');
const definePLSDBM81 = require('../../Models/SDB/PLSDBM81');
const definePLSDBM82 = require('../../Models/SDB/PLSDBM82');
const definePLSDBADMI = require('../../Models/SDB/PLSDBADMI');
const Company = require('../Class/CmpYrCls/Company');
const Encryptor = require('../../Services/encryptor');
const ADMIController = require('../../Controller/ADMIController');
const M81Controller = require('../../Controller/M81Controller');
const M82Controller = require('../../Controller/M82Controller');
const PLSDBM82 = definePLSDBM82(sequelizeSDB);
const PLSDBM81 = definePLSDBM81(sequelizeSDB);
const PLSDBADMI = definePLSDBADMI(sequelizeSDB);
const encryptor = new Encryptor();

class MApp {
    cSolPath = path.resolve(__dirname, '..'); // Parent directory

    // Initial default values
    _cBaseDBPath = '';
    lSSBOLT = false;
    SoftType = "PL"

    get cBaseDBPath() {
        const ssboltFilePath = path.join(__dirname, 'SSBOLT.TXT');

        // Check if 'SSBOLT.TXT' exists in the current directory
        if (fs.existsSync(ssboltFilePath)) {
            this.lSSBOLT = true;
            this._cBaseDBPath = path.join(__dirname, 'Data');
        } else {
            this._cBaseDBPath = path.join(__dirname, 'DATA');
        }

        return this._cBaseDBPath;
    }

    set cBaseDBPath(value) {
        this._cBaseDBPath = value;
    }

    static AndOr(Qry1, Qry2, Operator = "AND", BrcType = 0) {
        // Qry1 - First Query String
        // Qry2 - Second Query String
        // Operator - Any Operator you can Pass otherwise AND
        // BrcType - 0 = No Bracket to Qry1 & Qry2
        //           1 = Bracket to Qry1  Means (Qry1) operator Qry2
        //           2 = Bracket to Qry2 Means Qry1 operator (Qry2)
        //           3 = Bracket to Both Means (Qry1) operator (Qry2)
        //           4 = Bracket to Whole Expression Means (Qry1 operator Qry2)
        //           5 = 1 + 4, Means ((Qry1) operator Qry2)
        //           6 = 2 + 4, Means (Qry1 operator (Qry2))
        //           7 = 1 + 2 + 4, Means ((Qry1) operator (Qry2))

        // Handle null or empty query strings
        if ((Qry1 == null || Qry1 === '') && (Qry2 == null || Qry2 === '')) {
            return "";
        }

        // If Qry2 is empty, return Qry1 with appropriate brackets
        else if (Qry2 == null || Qry2 === '') {
            Qry1 = Qry1.trim();
            if (BrcType === 1 || BrcType === 3 || BrcType === 5 || BrcType === 7) {
                return `(${Qry1})`;
            } else {
                return Qry1;
            }
        }

        // If Qry1 is empty, return Qry2 with appropriate brackets
        else if (Qry1 == null || Qry1 === '') {
            Qry2 = Qry2.trim();
            if (BrcType === 2 || BrcType === 3 || BrcType === 6 || BrcType === 7) {
                return `(${Qry2})`;
            } else {
                return Qry2;
            }
        }

        // If both Qry1 and Qry2 are non-empty, proceed with operators and brackets
        else {
            Qry1 = Qry1.trim();
            Qry2 = Qry2.trim();

            // Apply brackets where needed
            if (BrcType === 1 || BrcType === 3 || BrcType === 5 || BrcType === 7) {
                Qry1 = `(${Qry1})`;
            }
            if (BrcType === 2 || BrcType === 3 || BrcType === 6 || BrcType === 7) {
                Qry2 = `(${Qry2})`;
            }

            // If BrcType is 4 or higher, wrap the entire expression in brackets
            if (BrcType >= 4) {
                return `(${Qry1} ${Operator.trim()} ${Qry2})`;
            } else {
                // Return normal expression without outer brackets
                if (Qry2 === '()') {
                    return Qry1;
                } else {
                    return `${Qry1} ${Operator.trim()} ${Qry2}`;
                }
            }
        }
    }

    static setBasePath(cBPath = '') {
        return cBPath.trim() === '' ? this.cBaseDBPath : cBPath;
    }

    // Method to mimic EvlSTU from C# (Trim & Uppercase)
    static _evlSTU(oObj1, oObj2 = null) {
        if (oObj1 != null && oObj1.toString().trim() !== "") {
            return oObj1.toString().trim().toUpperCase();
        }
        if (oObj2 != null && oObj2.toString().trim() !== "") {
            return oObj2.toString().trim().toUpperCase();
        }
        return "";
    }

    // Method to mimic EvlStr from C# (Return the first value if not empty, else return the second)
    static _evlStr(oObj1, oObj2 = null) {
        if (oObj1 != null && oObj1.toString().trim() !== "") {
            return oObj1.toString().trim();
        }
        if (oObj2 != null && oObj2.toString().trim() !== "") {
            return oObj2.toString().trim();
        }
        return "";
    }

    static strToArray(cStr, cSep = ',') {
        if (!cStr) {
            return null;
        }

        let cArray = cStr.split(this.toSapArray(cSep));
        return cArray;
    }

    static async NextNumber(oCon, cTblNm, cFldNm, nWidth, cPrefix = '', cExPrefix = '') {
        const cChar = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
        let cCode = '';
        const nLen = nWidth - cPrefix.length;

        let lLoop = false;
        do {
            cCode = cPrefix;

            // Generate random characters
            for (let i = 0; i < nLen; i++) {
                cCode += cChar.charAt(Math.floor(Math.random() * cChar.length));
            }

            // If there's a specific exclusion prefix, check it
            if (cExPrefix && cCode.startsWith(cExPrefix)) {
                lLoop = true;
            }

            // Check the database for uniqueness
            if (!lLoop && oCon != null) {
                lLoop = await this.rowExists(cTblNm, cFldNm, cCode);
            }

        } while (lLoop);

        return cCode;
    }

    static async NullEmpty(oObj) {
        return typeof oObj === 'object'
            ? (oObj === null || Object.keys(oObj).length === 0)
            : (typeof oObj === 'string'
                ? (oObj === null || oObj.trim() === '')
                : false);
    }

    // Method to seek (filter) a record in a DataTable (DT)
    static DTSeek(DT, cFilter, lBlank = false) {
        try {
            // Filter the DT DataTable array by cFilter (assuming cFilter is a string or a function for filtering)
            const filteredRows = DT.filter(row => {
                // Assuming cFilter is a key-value pair string like "name = 'John'"
                // Parse cFilter as simple key-value pair logic, e.g., "name = 'John'"
                const [key, value] = cFilter.split('=').map(str => str.trim());
                let result = row[key] && row[key].toString().toLowerCase() === value.toLowerCase();
                return result;
            });

            // Return the first matching row or a new row if lBlank is true
            if (filteredRows.length > 0) {
                return filteredRows[0]; // Return the first matched row
            }

            // If no match and lBlank is true, return a new row (empty object)
            return lBlank ? {} : null;

        } catch (error) {
            console.error("Error in DTSeek:", error);
            return null;
        }
    }

    // Method to seek a field in the found record
    static DTSeekFld(DT, cFilter, cFldNM, cDefVal = "") {
        try {
            // Use DTSeek to find the row
            const row = this.DTSeek(DT, cFilter, true);

            if (row && row.hasOwnProperty(cFldNM)) {
                let result = row[cFldNM] || cDefVal; // Return the field value or default value
                return result;
            }

            return cDefVal; // If field doesn't exist, return default value
        } catch (error) {
            console.error("Error in DTSeekFld:", error);
            return cDefVal;
        }
    }

    // Converts SQL-like filter to JavaScript filter function
    sqlToJsFilter(sqlFilter) {
        return sqlFilter
            // Normalize spacing
            .replace(/\s+/g, ' ')
            // Handle IN clauses
            .replace(/(\w+)\s+IN\s*\(([^)]+)\)/gi, (match, field, values) => {
                const jsArray = values.split(',')
                    .map(v => `"${v.trim().replace(/^'|'$/g, '')}"`)
                    .join(', ');
                return `[${jsArray}].includes(x.${field})`;
            })
            // Handle NOT IN clauses
            .replace(/(\w+)\s+NOT\s+IN\s*\(([^)]+)\)/gi, (match, field, values) => {
                const jsArray = values.split(',')
                    .map(v => `"${v.trim().replace(/^'|'$/g, '')}"`)
                    .join(', ');
                return `![${jsArray}].includes(x.${field})`;
            })
            // Handle LIKE '%value%'
            .replace(/(\w+)\s+LIKE\s+'%(.+?)%'/gi, (match, field, value) => {
                return `x.${field}.includes("${value}")`;
            })
            // Handle LIKE 'value%'
            .replace(/(\w+)\s+LIKE\s+'(.+?)%'/gi, (match, field, value) => {
                return `x.${field}.startsWith("${value}")`;
            })
            // Handle LIKE '%value'
            .replace(/(\w+)\s+LIKE\s+'%(.+?)'/gi, (match, field, value) => {
                return `x.${field}.endsWith("${value}")`;
            })
            // Handle comparisons with constants: =, !=, <, >, <=, >=
            .replace(/(\w+)\s*(=|!=|<>|<=|>=|<|>)\s*'([^']+)'/gi, (match, field, op, value) => {
                const jsOp = op === '=' ? '===' : (op === '<>' ? '!==' : op);
                return `x.${field} ${jsOp} "${value}"`;
            })
            // Handle comparisons with other fields (field-to-field)
            .replace(/(\w+)\s*(=|!=|<>|<=|>=|<|>)\s*(\w+)/g, (match, left, op, right) => {
                // Skip if right is a number (would already be handled)
                if (!isNaN(right)) return match;

                const jsOp = op === '=' ? '===' : (op === '<>' ? '!==' : op);
                return `x.${left} ${jsOp} x.${right}`;
            })
            // Logical operators
            .replace(/\bAND\b/gi, '&&')
            .replace(/\bOR\b/gi, '||')
            // Clean up stray quotes
            .replace(/'([^']+)'/g, '"$1"');
    }

    // Method to copy data from the DataTable with optional filters, ordering, and distinct selection
    DTCopy(DT, cFilter = "", cOrderBy = "", aFlds = null, lDistinct = false) {
        let enumerable = Query.from(DT);

        if (cFilter) {
            const jsFilter = this.sqlToJsFilter(cFilter);
            const filterFunc = new Function("x", `return (${jsFilter});`);
            enumerable = enumerable.where(filterFunc);
        }

        if (cOrderBy) {
            enumerable = enumerable.orderBy(x => x[cOrderBy]);
        }

        if (aFlds && aFlds.length > 0) {
            enumerable = enumerable.select(x => {
                const result = {};
                for (const field of aFlds) {
                    result[field] = x[field];
                }
                return result;
            });
        }

        let result = Array.from(enumerable);

        if (lDistinct) {
            const seen = new Set();
            result = result.filter(row => {
                const key = JSON.stringify(row);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        }

        return result;
    }

    static DTOS(oObj, lNoQuote = false) {
        if (oObj == null || oObj.toString().trim() == '')
            return lNoQuote ? "" : "''";

        let cDate = oObj.getFullYear().toString().padStart(4, '0') + (oObj.getMonth() + 1).toString().padStart(2, '0') + oObj.getDate().toString().padStart(2, '0');
        return lNoQuote ? cDate : "'" + cDate + "'";
    }

    static async GetEmptyCmpNo(dtoken, cBPath = "") // Method To Load Empty Company No for Create new Company no
    {
        let sdbSeq = (dtoken.corpId).split('-');
        let sdbdbname = sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB'
        let admi = new ADMIController(sdbdbname);
        let m81 = new M81Controller(sdbdbname);
        let m82 = new M82Controller(sdbdbname);
        let admin = null;
        let existingAdmin = await admi.findAll();
        let userId = encryptor.decrypt(dtoken.userId);
        for (let i of existingAdmin) {
            const decrypted = encryptor.decrypt(i.ADMIF01)
            if (decrypted == userId) {
                admin = i;
            }
        }
        let M81
        if (dtoken.corpId == 'PL-P-00001') {
            M81 = await m81.findOne({
                M81CHLD: admin.ADMIF00
            });
        } else {
            M81 = await m81.findOne({
                M81UNQ: admin.ADMIF00
            });
        }
        let M82 = await m82.findAll(
            { M82F01: M81.M81F01 },
            [],
            ['M82F01', 'M82F02'], 
        );

        // Extract the numbers from M82F02 field
        let numbers = M82.map(item => item.M82F02);

        // Sort the numbers to find the missing one
        numbers.sort((a, b) => a - b);

        // Now, let's find the missing number in the sequence
        let missingNumber = null;
        for (let i = 0; i < numbers.length; i++) {
            // Check if the next number is not the current number + 1
            if (numbers[i] !== i + 1) {
                missingNumber = i + 1;
                break;
            }
        }

        // If no missing number was found, it means the next number in sequence is the next highest number
        if (!missingNumber) {
            missingNumber = numbers[numbers.length - 1] + 1;
        }

        return missingNumber; // This will be the first missing number in the sequence

    }

    static EVL(cExp1, cExp2) {
        let type = typeof cExp1;
        if (type == 'number') {
            return (cExp1 != 0 ? cExp1 : cExp2);
        } else if (type == 'string') {
            return (cExp1 != "" && cExp1 != null ? cExp1 : cExp2);
        } else if (type == 'object') {
            return ((cExp1) ? cExp2 : cExp1);
        }
    }

    static async LoadCmpYear(cUserID, cCmpNo, dbName) {
        let oCmp = new Company(dbName);
        if (oCmp.lcon) {
            return false;
        }
        let oTCmp = await oCmp.LoadCMP()
        if (oTCmp == null) {
            return false;
        }
        if (!cYrNo || (parseInt(cYrNo) == 0)) {
            cYrNo = await oCmp.GetCMM("_CMPYEAR");
            if (!cYrNo)
                cYrNo = await oCmp.GetDefYrNo(cUserID, cCmpNo, dbName);
            else {

                if (!await oCmp.YrExists(cYrNo)) {
                    cYrNo = oCmp.GetLastYrNo().toString();
                }
            }
        }
        if (!cYrNo) {
            // cEMsg = pc.RC("CMPEM003", oCUser.lCode);   // Year Not Exist or Loading Problem.
            return false;
        }
        //----------------------------------
        let oTYr = await oCmp.LoadYear(parseInt(cYrNo), false);
        if (oTYr == null) {
            // cEMsg = pc.EVL(oCmp.cEMsg, pc.RC("CMPEM003", oCmp.lCode));   // Year Not Exist or Loading Problem.
            return false;
        }
        if (oCmp != null && oTYr != null)
            oTYr.LoadCmpSetup(oTYr);

        //----------------------------------
        if (lSetDef) {
            oCUser.SetDefaultYear(oCmp, oTYr, true);
        }
        //if (oTYr != null && false && Environment.UserName.ToUpper() == "BHADRESH") // Temparory only for BD
        //{
        //    YrSupport oYRS = new YrSupport(oTYr);
        //    oYRS.LoadCustomFiles("", false);
        //    oCmp.StructChg("", "Y");
        //}
        if (!oCmp.CheckVersion())    // Version Checking & Upgrade Data
        {
            oCmp.ReleaseMe();
            return false;
        }
        return true;
    }
}

class LangType {
    // Static Properties
    static Gujarati = "01";
    static English = "02";
    static Hindi = "03";

    static Resorce_Gujarati = "gu-IN";
    static Resorce_English = "en-US";
    static Resorce_Hindi = "hi-IN";

    static LangCodes = "01,02,03";  // All Language Code Strings

    // Static Methods
    static SetLangCode(lCode) {
        if (LangType.LangCodes.includes(lCode)) {
            return lCode;
        } else {
            return LangType.English;  // Default English
        }
    }

    static GetLangNo(lCode) {
        if (lCode === LangType.English) {
            return LangType.Resorce_English;
        } else if (lCode === LangType.Gujarati) {
            return LangType.Resorce_Gujarati;
        } else if (lCode === LangType.Hindi) {
            return LangType.Resorce_Hindi;
        } else {
            return LangType.Resorce_English;  // Default English
        }
    }
}

class plusCommon {
    RC(field, lCode, dtPLSYSCAP) {
        const row = dtPLSYSCAP?.find(record => record.CAPF00 === field);

        if (!row) {
            return field;
        }

        switch (lCode) {
            case '01':
                return row.CAPF01;
            case '02':
                return row.CAPF02;
            case '03':
                return row.CAPF03;
            default:
                logger.error(`Invalid lCode: ${lCode}`);
                return null;
        }
    }
}

// Export the LangType class
module.exports = { LangType, MApp };
