const PlusTable = require("../AppCls/PlusTable");

class T82Table extends PlusTable {
    constructor(companyOrYear) {
        super();
        if (companyOrYear?.oCmp) {
            this.oYear = companyOrYear;
            this.oCmp = companyOrYear.oCmp;
            this.lCode = companyOrYear.lCode;
        } else {
            this.oCmp = companyOrYear;
            this.lCode = companyOrYear?.lCode;
        }
        this.initCls();
    }

    initCls() {
        this.cTable = this.oYear ? this.oYear.TblYr + 'T82' : '';
        this.CodeField = '';
        this.cFldPrefix = 'T82';
        this.cUSCode = '';
        this.cModuleID = 'T82Table';
        super.initCls();
    }

    addUserLog(oYr, cCode, cTbl, cBeginID = '', cAct = 'A', oEnt = {}, oldEnt = {}, nT02Str = '', oT02Str = '') {
        const dr = this.getDictionary('', '', true);
        if (cTbl === 'T41') {
            dr.FIELD06 = oEnt.FIELD06;
            dr.FIELD11 = oEnt.FIELD02;
            dr.FIELD13 = this.inList(oEnt.T41PVT, ['PP', 'HP', 'OP', 'PR']) ? oEnt.FIELD10 : oEnt.FIELD12;
            dr.FIELD15 = this.t82_GetVouStr(true, oEnt, null) + (nT02Str === '' ? '' : '~TV~' + nT02Str);

            if (oldEnt) {
                dr.FIELD07 = oldEnt.FIELD06;
                dr.FIELD10 = oldEnt.FIELD02;
                dr.FIELD12 = this.inList(oldEnt.T41PVT, ['PP', 'HP', 'OP', 'PR']) ? oldEnt.FIELD10 : oldEnt.FIELD12;
                dr.FIELD14 = this.t82_GetVouStr(true, oldEnt, null) + (oT02Str === '' ? '' : '~TV~' + oT02Str);
            }
        }

        dr.FIELD01 = cCode;
        dr.FIELD02 = this.oCmp?.oCUser?.oUser?.cUserID || '';
        dr.FIELD03 = cAct;
        dr.FIELD04 = this.formatDate(new Date());
        dr.FIELD05 = this.formatTime(new Date());
        dr.FIELD08 = cTbl;

        switch (cTbl) {
            case 'T41':
                dr.FIELD09 = (
                    this.inList(oEnt.T41PVT, ['PP', 'HP', 'OP', 'PR']) ? oEnt.FIELD10 : oEnt.FIELD12
                ) + '##' + oEnt.FIELD02 + '##' + (oEnt.FIELD04 || oEnt.FIELD31);
                if (oEnt.FIELD32?.trim()) {
                    const cF32 = this.strToArray(oEnt.FIELD32.trim() + '###############', '#');
                    dr.FIELD09 += cF32[0];
                }
                break;
            case 'M02':
                dr.FIELD09 = oEnt.FIELD61;
                break;
            default:
                if (oEnt.FIELD02) {
                    dr.FIELD09 = oEnt.FIELD02;
                } else {
                    const keys = Object.keys(oEnt);
                    if (keys.length > 0) {
                        dr.FIELD09 = oEnt[keys[1] || keys[0]];
                    }
                }
                break;
        }

        this.saveDataDict(dr, false, cBeginID, false);
    }

    t82_GetVouStr(lT41, oEnt = {}, T02 = []) {
        let cStr = '', cExp = '', c13 = '';
        const cSep = '~TC~', RSep = '~TR~', C1Sep = '~TP~';

        if (lT41 && oEnt) {
            cStr = 'FIELD04' + cSep + (oEnt.FIELD04 || oEnt.FIELD31) + RSep +
                   'FIELD13' + cSep + oEnt.FIELD13 + RSep +
                   'FIELD07' + cSep + oEnt.FIELD07;

            if (oEnt.FIELD16 === 'C' && oEnt.FIELD32) {
                cStr += RSep + 'FIELD32' + cSep + oEnt.FIELD32;
            }

            if (!oEnt.FIELD13) {
                const M45 = this.getTable(this.oYear.TblYr + 'M45', {
                    FIELD01: oEnt.FIELD13,
                    FIELD12: { $ne: 0 }
                });

                for (const row of M45) {
                    c13 = row.FIELD13;
                    cExp += (cExp === '' ? '' : RSep) + c13 + cSep + oEnt[c13];
                }
            }

            if (cExp) cStr += RSep + cExp;
        } else if (T02?.length > 0) {
            for (const row of T02) {
                cStr += (cExp === '' ? '' : C1Sep) +
                    'FIELD03' + cSep + row.FIELD03 + RSep +
                    'FIELD56' + cSep + row.FIELD56 + RSep +
                    'FIELD06' + cSep + row.FIELD06 + RSep +
                    'FIELD07' + cSep + row.FIELD07 + RSep +
                    'FIELD08' + cSep + row.FIELD08;
            }
        }

        return cStr;
    }

    // === Helpers ===

    formatDate(date) {
        return date.toISOString().split('T')[0].replace(/-/g, '');
    }

    formatTime(date) {
        return date.toTimeString().split(' ')[0];
    }

    inList(value, list) {
        return list.includes(value);
    }

    strToArray(str, sep) {
        return str.split(sep);
    }

    getTable(tableName, query) {
        // Implement DB call here
        return []; // placeholder
    }

    getDictionary() {
        // Return an empty record structure or default values
        return {};
    }

    saveDataDict(dict, p1, id, p2) {
        // Save logic here
        console.log("Saved: ", dict);
    }
}

module.exports = T82Table;