const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const db = require('../../../Config/config');
const { QueryTypes } = require('sequelize');

// Define the ExcelGenerator class
class G04Table {
    constructor(cCode, cOPara, yr, dbName) {
        this.T02 = null;
        this.T41 = null;
        this.M01 = null;
        this.M01S = null;
        this.M02 = null;
        this.M02S = null;
        this.G07F;
        this.G07T;
        this.cCode = cCode;
        this.cOPara = cOPara;
        this.cVNo = '';
        this.cFile = '';
        this.cErr = '';
        this.cDestFile = '';
        this.cFiletoret = '';
        this.lError = false;
        this.oYear = yr
        this.dbconn = db.createPool(dbName)

        // Base directory for template and reports
        this.srcFile = path.join(__dirname, 'Reports', 'Eway_Bill.xlsm');
        this.destDir = path.join(__dirname, 'EWB', this.cOPara);

        // Placeholder for Excel JSON data
        this.oJson = null;
    }
    InitCls() {
        cTable = oYear.TblYr + "G04";
        CodeField = "G04F01";
        cFldPrefix = "G04";
        cUSCode = "";
        CodeAct = "ED";
        cModuleID = "G04Table";
        lMXXReq = false;
        lImgReq = false;
        cCodePrefix = "";
    }

    async InitEnv(cCode = "") {
        this.cVCode = cCode;

        const yearPrefix = 'YR' + this.oYear.TblYr; // equivalent of oYear.TblYr

        // 🔹 T02 → Array (table)
        this.T02 = await this.dbconn.query(
            `SELECT * FROM ${yearPrefix}T02 FIELD01='${cCode}'`,
            {
                type: QueryTypes.SELECT
            }
        );

        // 🔹 T41 → Single Row (object)
        this.T41 = await this.dbconn.query(
            `SELECT * TOP 1 FROM ${yearPrefix}T41 FIELD01='${cCode}'`,
            {
                type: QueryTypes.SELECT
            }
        );

        // Helper shortcut
        const evlStr = this.evlStr;

        // 🔹 M01
        const keyM01 = evlStr(this.T41.FIELD31, this.T41.FIELD04);
        this.M01 = await this.dbconn.query(
            `SELECT * TOP 1 FROM ${yearPrefix}M01 FIELD01='${keyM01}'`,
            {
                type: QueryTypes.SELECT
            }
        );

        // 🔹 M01S
        const keyM01S = evlStr(
            this.T41.FIELD39,
            evlStr(this.T41.FIELD31, this.T41.FIELD04)
        );

        this.M01S = await this.dbconn.query(
            `SELECT * TOP 1 FROM ${yearPrefix}M01 FIELD01='${keyM01S}'`,
            {
                type: QueryTypes.SELECT
            }
        );

        // 🔹 M02
        this.M02 = await this.dbconn.query(
            `SELECT * TOP 1 FROM ${yearPrefix}M02 FIELD01='${keyM01}'`,
            {
                type: QueryTypes.SELECT
            }
        );

        // 🔹 M02S
        this.M02S = await this.dbconn.query(
            `SELECT * TOP 1 FROM ${yearPrefix}M02 FIELD01='${keyM01S}'`,
            {
                type: QueryTypes.SELECT
            }
        );

        // 🔹 Load G04 entity dictionary
        await this.G04Load(cCode);

        // 🔹 G07F
        if (!this.nullEmpty(this.oEntDict?.G04F64)) {
            this.G07F = await this.dbconn.query(
                `SELECT * TOP 1 FROM ${yearPrefix}G07 FIELD01='${this.oEntDict.G04F64}'`,
                {
                    type: QueryTypes.SELECT
                }
            );
        }

        // 🔹 G07T
        if (!this.nullEmpty(this.oEntDict?.G04F65)) {
            this.G07T = await this.dbconn.query(
                `SELECT * TOP 1 FROM ${yearPrefix}G07 FIELD01='${this.oEntDict.G04F65}'`,
                {
                    type: QueryTypes.SELECT
                }
            );
        }
    }
    static async ExcelGenerator() {

        // Helper function to simulate GetJson
        GetJson()

        // Helper function to simulate GetG04F03
        GetG04F03(subSupplyType)

        // Main function to generate the Excel file
        GenExcel()
    }
    static async GenExcel() {
        try {
            // Simulate the process of getting the JSON data
            const cJson = await this.GetJson();
            const parsedJson = JSON.parse(cJson);
            this.oJson = parsedJson; // Store the parsed JSON in the class

            // Generate file path for destination report
            this.cFiletoret = path.join(this.destDir, `Eway_Bill_${this.cVNo.replace(/\\|\/|\-/g, '_')}.xlsm`);
            this.cDestFile = path.join(__dirname, this.cFiletoret);

            // Create destination directory if it doesn't exist
            if (!fs.existsSync(this.destDir)) {
                fs.mkdirSync(this.destDir, { recursive: true });
            }

            // Copy the template file to the destination path if it doesn't exist
            if (!fs.existsSync(this.cDestFile)) {
                fs.copyFileSync(this.srcFile, this.cDestFile);
            }

            // Now work with ExcelJS to modify the file
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(this.cDestFile); // Open the Excel file

            const worksheet = workbook.getWorksheet(2); // Accessing the second sheet
            const sheet = worksheet.getSheetByName('Sheet2');

            // Example of filling data in cells as done in the C# code
            let nNR = 3; // Starting row
            this.oJson.itemlist.forEach((item) => {
                nNR++;
                worksheet.getCell(`A${nNR}`).value = this.oJson.supplytype === "I" ? "Inward" : "Outward";
                worksheet.getCell(`B${nNR}`).value = this.GetG04F03(this.oJson.subsupplytype);
                worksheet.getCell(`C${nNR}`).value = this.oJson.doctype;
                worksheet.getCell(`D${nNR}`).value = this.oJson.docno;
                worksheet.getCell(`E${nNR}`).value = this.oJson.docdate;
                worksheet.getCell(`F${nNR}`).value = "Calculated Value"; // Placeholder for calculated value

                // Continue this for all columns as needed, following the C# code logic
            });

            // Save the modified workbook back to the same file
            await workbook.xlsx.writeFile(this.cDestFile);

            // Return the path to the generated file
            return this.cDestFile;
        } catch (err) {
            console.error('Error generating Excel file:', err);
            this.lError = true;
            return `Error: ${err.message}`;
        }
    }

    async GetJson() {
        let cVNo = "", cFile = "", cErr = "", cDestFile = "", cFiletoret = "";
        let lError = false;

        // ⚠️ You must implement these based on your system
        await this.InitEnv(this.cCode);

        if (!this.validEwb()) {
            return cMsg;
        }

        const G04 = this.oEntDict; // equivalent of Dictionary<string, object>

        // Equivalent of: MApp.pc.InList(...)
        const inList = (val, ...list) => list.includes(val);

        // T41 assumed as object
        const T41 = this.T41;

        cVNo = inList(T41.T41PVT, "PP", "PR", "HP", "OP")
            ? T41.FIELD10
            : T41.FIELD12;

        // Build JSON structure
        const oEJ = {
            version: "1.0.0421",
            billlists: []
        };

        const oBL = {
            usergstin: G04.G04F02 === "O" ? G04.G04F40 : G04.G04F41,
            supplytype: G04.G04F02,
            subsupplytype: Number(G04.G04F03),
            doctype: G04.G04F04,
            docno: inList(T41.T41PVT, "PP", "HP", "OP", "PR")
                ? T41.FIELD10
                : T41.FIELD12,
            docdate: T41.FIELD02,
            transtype: Number(G04.G04F30),

            fromgstin: G04.G04F40,
            fromtrdname: G04.G04F05,
            fromaddr1: G04.G04F08,
            fromaddr2: G04.G04F09,
            fromplace: G04.G04F06,
            frompincode: Number(G04.G04F10),
            fromstatecode: G04.G04F07,
            actualfromstatecode: G04.G04F51,

            togstin: G04.G04F41,
            totrdname: G04.G04F11,
            toaddr1: G04.G04F14,
            toaddr2: G04.G04F15,
            toplace: G04.G04F12,
            topincode: Number(G04.G04F16),
            tostatecode: G04.G04F13,
            actualtostatecode: G04.G04F52,

            totalvalue: Number(G04.G04F35) || 0,
            cgstvalue: Number(G04.G04F36) || 0,
            sgstvalue: Number(G04.G04F37) || 0,
            igstvalue: Number(G04.G04F38) || 0,
            cessvalue: Number(G04.G04F39) || 0,

            othvalue:
                Number(T41.FIELD06 || 0) -
                (
                    Number(G04.G04F35 || 0) +
                    Number(G04.G04F36 || 0) +
                    Number(G04.G04F37 || 0) +
                    Number(G04.G04F38 || 0) +
                    Number(G04.G04F39 || 0)
                ),

            transdistance: Number(G04.G04F23),
            transportername: G04.G04F19,
            transporterid: G04.G04F18,
            transdocdate: G04.G04F21,

            itemlist: []
        };

        // Transport details
        if (G04.G04F22) {
            oBL.transtransmode = G04.G04F17;
            oBL.vehicleno = G04.G04F22;
            oBL.vehicletype = G04.G04F53;
            oBL.transdocno = G04.G04F20;
        }

        // Loop through T02 rows (array in Node.js)
        let nCnt = 0;

        for (const dr of this.T02) {
            nCnt++;

            // ⚠️ Replace with DB calls
            let M21 = await this.getM21(dr.FIELD03);
            let M51 = await this.getM51(dr.FIELD56);

            if (!M51) {
                const slab = this.getSlab(M21.FIELD03, dr.FIELD02);
                M51 = await this.getM51(slab);
            }

            const oItem = {
                itemno: nCnt,
                productname: M21.FIELD02?.trim(),
                productdesc: M21.FIELD02?.trim(),
                hsncode: M21.FIELD04,

                quantity: Number(dr.FIELD06),

                qtyunit: (M21.FIELD03 || "BOX-BOX").substring(4, 7),

                taxableamount: this.getTaxableVal(dr),

                sgstrate: Number(M51.FIELD05),
                cgstrate: Number(M51.FIELD07),
                igstrate: Number(M51.FIELD06),
                cessrate: Number(M51.FIELD09),

                cessnonadvol: 0
            };

            if (!oBL.mainhsncode) {
                oBL.mainhsncode = M21.FIELD04;
            }

            oBL.itemlist.push(oItem);
        }

        oEJ.billlists.push(oBL);

        // Convert to JSON (ignore nulls manually if needed)
        cJson = JSON.stringify(oEJ, null, 2);

        // store for reuse
        this.cVNo = cVNo;

        return cJson;
    }

    async G04Load(cCode = "") {
        let nSGST = 0, nCGST = 0, nIGST = 0, nEGST = 0, nAEGST = 0;

        // 🔹 Equivalent of GetM45Val(...)
        const taxVals = await this.getM45Val(this.T41, this.T41, false);
        nSGST = taxVals.nSGST;
        nCGST = taxVals.nCGST;
        nIGST = taxVals.nIGST;
        nEGST = taxVals.nEGST;
        nAEGST = taxVals.nAEGST;

        // 🔹 Load company setup (equivalent of oYear.LoadSetup)
        const OSCMP = await this.oYear.loadSetup("SCMP");

        // 🔹 Initialize dictionary if null
        if (!this.oEntDict) {
            this.oEntDict = await this.getDictionary(cCode);
        }

        const evlStr = this.evlStr;
        const inList = this.inList;

        const T41 = this.T41;
        const M01 = this.M01;
        const M01S = this.M01S;
        const M02S = this.M02S;

        this.cVType = cCode.substring(0, 2);

        // 🔹 Assign values
        this.oEntDict["G04F01"] = cCode;

        this.oEntDict["G04F02"] = evlStr(
            this.oEntDict["G04F02"],
            inList(this.cVType, "SS", "HS", "TS") ? "O" : "I"
        );

        this.oEntDict["G04F03"] = evlStr(this.oEntDict["G04F03"], 1);

        this.oEntDict["G04F04"] = evlStr(
            this.oEntDict["G04F04"],
            T41.FIELD21 === "T" ? "INV"
                : T41.FIELD21 === "R" ? "BIL"
                    : inList(this.cVType, "HS", "HP") ? "CHL"
                        : inList(this.cVType, "HC", "HD") ? "CNT"
                            : "OTH"
        );

        // 🔹 From details
        this.oEntDict["G04F05"] = evlStr(this.oEntDict["G04F05"], this.oCmp?._NAME?.trim());
        this.oEntDict["G04F07"] = evlStr(this.oEntDict["G04F07"], OSCMP._STCD);
        this.oEntDict["G04F06"] = evlStr(this.oEntDict["G04F06"], OSCMP._CITY);
        this.oEntDict["G04F08"] = evlStr(this.oEntDict["G04F08"], OSCMP._ADDRESS_1);
        this.oEntDict["G04F09"] = evlStr(this.oEntDict["G04F09"], OSCMP._ADDRESS_2);
        this.oEntDict["G04F10"] = evlStr(this.oEntDict["G04F10"], OSCMP._PINCODE);

        // 🔹 To details
        this.oEntDict["G04F11"] = evlStr(this.oEntDict["G04F11"], M01?.FIELD02?.trim());
        this.oEntDict["G04F12"] = evlStr(this.oEntDict["G04F12"], M01?.FIELD17);
        this.oEntDict["G04F13"] = evlStr(this.oEntDict["G04F13"], M01S?.FIELD36);
        this.oEntDict["G04F14"] = evlStr(this.oEntDict["G04F14"], M02S?.FIELD02 || "");
        this.oEntDict["G04F15"] = evlStr(this.oEntDict["G04F15"], M02S?.FIELD03 || "");
        this.oEntDict["G04F16"] = evlStr(this.oEntDict["G04F16"], M02S?.FIELD07 || "");

        // 🔹 State logic
        this.oEntDict["G04F51"] = evlStr(
            this.oEntDict["G04F51"],
            evlStr(this.oEntDict["G04F07"], OSCMP._STCD)
        );

        this.oEntDict["G04F52"] = evlStr(
            this.oEntDict["G04F52"],
            evlStr(this.oEntDict["G04F13"], M01S?.FIELD36)
        );

        // 🔹 GSTIN
        this.oEntDict["G04F40"] = evlStr(
            this.oEntDict["G04F40"],
            this.oYear?.OSC?._GSTINCMP
        );

        this.oEntDict["G04F41"] = evlStr(
            this.oEntDict["G04F41"],
            evlStr(M01?.FIELD35, "URP")
        );

        // 🔹 Transport
        this.oEntDict["G04F17"] = evlStr(this.oEntDict["G04F17"], 1);

        // 🔹 Amounts
        this.oEntDict["G04F35"] = evlStr(this.oEntDict["G04F35"], T41.FIELD07);
        this.oEntDict["G04F36"] = evlStr(this.oEntDict["G04F36"], nCGST);
        this.oEntDict["G04F37"] = evlStr(this.oEntDict["G04F37"], nSGST);
        this.oEntDict["G04F38"] = evlStr(this.oEntDict["G04F38"], nIGST);
        this.oEntDict["G04F39"] = evlStr(this.oEntDict["G04F39"], nEGST + nAEGST);

        this.oEntDict["TOTINAMT"] = evlStr(
            this.oEntDict["TOTINAMT"],
            T41.FIELD06
        );

        // 🔹 Override from G07F
        if (this.G07F) {
            this.oEntDict["G04F06"] = this.G07F.FIELD04;
            this.oEntDict["G04F10"] = this.G07F.FIELD05;
            this.oEntDict["G04F08"] = this.G07F.FIELD06;
            this.oEntDict["G04F09"] = this.G07F.FIELD07;

            this.oEntDict["G04F51"] = await this.getField(
                "PLSTATE",
                `PLSF01='${this.G07F.FIELD03}'`,
                "PLSF06"
            );
        }

        // 🔹 Override from G07T
        if (this.G07T) {
            this.oEntDict["G04F12"] = this.G07T.FIELD04;

            const state = await this.getField(
                "PLSTATE",
                `PLSF01='${this.G07T.FIELD03}'`,
                "PLSF06"
            );

            this.oEntDict["G04F13"] = state;
            this.oEntDict["G04F52"] = state;

            this.oEntDict["G04F16"] = this.G07T.FIELD05;
            this.oEntDict["G04F14"] = this.G07T.FIELD06;
            this.oEntDict["G04F15"] = this.G07T.FIELD07;
        }
    }

    static _evlStr(oObj1, oObj2 = null) {
        if (oObj1 != null && oObj1.toString().trim() !== "") {
            return oObj1.toString().trim();
        }
        if (oObj2 != null && oObj2.toString().trim() !== "") {
            return oObj2.toString().trim();
        }
        return "";
    }
}

module.exports = G04Table;