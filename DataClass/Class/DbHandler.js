// const DT = require('./dt'); // Adjust import path as needed
const DDefine = require('./DcDefine'); // Adjust import path as needed
const db = require('../../Config/config'); // Your Database class
const sequelizeIDB = db.getConnection('IDBAPI');


class DBHandler {
    constructor(dbName) {
        if (typeof dbName === 'string') {
            this.databasename = dbName;
            this.sequelizeDynamic = db.getConnection(dbName);
        } else {
            this.sequelizeDynamic = dbName
        }
        // You can inject dependencies or configurations here if needed
    }

    /**
     * Get a blank row dictionary based on a table structure
     */
    async GetBlankRowDict(cTblNM, cFldList = "*", cExFld = "", obj) {
        try {

            const query = `SELECT TOP 1 ${cFldList} FROM ${cTblNM.toString().trim()}`;
            let DTable = await this.sequelizeDynamic.query(
                query,
                { type: this.sequelizeDynamic.QueryTypes.SELECT }
            );
            // await DT('DynamicPool', 'get', '', '', '', '', '', '', obj.corporateID, obj.companyID, obj.YrNo, '', query);

            DTable = cExFld ? await this.AddExColInDT(DTable.recordset, cExFld) : DTable.recordset;
            return this.DrToDic(DTable);
        } catch (ex) {
            console.error(`Error in GetBlankRowDict: ${cTblNM}`, ex);
            return null;
        }
    }

    /**
     * Adds extra columns in the data table with default values
     */
    async AddExColInDT(DTObj, cExFld, lRemoveAdd = false) {
        let DT = DTObj;

        if (DT == null) {
            DT = [];
        }

        if (Object.keys(DT).includes('recordset')) {
            DT = DT.recordset;
        }

        if (DT.length === 0) {
            DT[0] = await this.GetEmptyRow([], '', false, true); // Placeholder method
        }

        if (!cExFld) return DT;

        const rowSep = DDefine.RSep;
        const colSep = DDefine.CSep;
        const aFld = await DDefine.Str2Array(cExFld, rowSep, colSep, 4);

        for (let nIx = 0; nIx < aFld.length; nIx++) {
            const [rawFld, rawDTy, rawDVl, rawMLn] = aFld[nIx];

            const cFld = rawFld.toString().trim();
            if (!cFld) continue;

            const cDVl = rawDVl.toString().trim();

            if (lRemoveAdd && Object.keys(DT).includes(cFld)) {
                for (let row of DT) {
                    delete row[cFld];
                }
            }

            if (DT.length > 0) {
                for (let item of DT) {
                    item[cFld] = cDVl.length > 0 ? cDVl : null;
                }
            } else {
                DT[cFld] = cDVl.length > 0 ? cDVl : null;
            }
        }

        return DT;
    }

    // /**
    //  * Convert a row from the DB to a dictionary with default values
    //  */
    // DrToDic(DR) {
    //     let oDic = {};
    //     if (!DR || typeof DR !== 'object' || !Array.isArray(DR) || DR.length === 0) return oDic;

    //     const colLst = Object.keys(DR[0]);

    //     for (const noR of DR) {
    //         for (const col of colLst) {
    //             const cColNM = col.trim().toUpperCase();
    //             const value = DR[0][col];

    //             if (value === null || value === undefined) {
    //                 oDic[cColNM] = "";
    //                 continue;
    //             }

    //             switch (typeof value) {
    //                 case 'string':
    //                     oDic[noR][cColNM] = '';
    //                     break;
    //                 case 'number':
    //                     oDic[noR][cColNM] = 0;
    //                     break;
    //                 case 'boolean':
    //                     oDic[noR][cColNM] = false;
    //                     break;
    //                 case 'object':
    //                     oDic[noR][cColNM] = value instanceof Date ? null : '';
    //                     break;
    //                 default:
    //                     oDic[noR][cColNM] = value;
    //             }
    //         }
    //     }

    //     return oDic;
    // }

    DrToDic(DR) {
        let oDic = []; // Initialize as an array to store the results
        if (!DR || typeof DR !== 'object' || !Array.isArray(DR) || DR.length === 0) return oDic;

        const colLst = Object.keys(DR[0]); // Get column names from the first row

        // Iterate through each row in DR
        for (const noR of DR) {
            let rowObj = {}; // Create a new object for each row

            // Iterate through each column
            for (const col of colLst) {
                const cColNM = col.trim().toUpperCase(); // Normalize column name
                const value = noR[col]; // Get value from the current row

                if (value === null || value === undefined) {
                    rowObj[cColNM] = ""; // Set empty string for null/undefined values
                    continue;
                }

                // Handle the type of value and set the appropriate default value
                switch (typeof value) {
                    case 'string':
                        rowObj[cColNM] = '';
                        break;
                    case 'number':
                        rowObj[cColNM] = 0;
                        break;
                    case 'boolean':
                        rowObj[cColNM] = false;
                        break;
                    case 'object':
                        rowObj[cColNM] = value instanceof Date ? null : '';
                        break;
                    default:
                        rowObj[cColNM] = value;
                }
            }

            oDic.push(rowObj); // Push the object for this row to the array
        }

        return oDic[0];
    }

    // You can define this placeholder method as needed
    async GetBlankRowDict(cTblNM, cFldList = "*", cExFld = "", obj) {
        try {

            this.sequelizeDynamic = db.getConnection(this.databasename);
            const query = `SELECT TOP 1 ${cFldList ? cFldList : '*'} FROM [${cTblNM.trim()}]`;
            console.log(query);
            console.log(this.sequelizeDynamic);
            let DTable = await this.sequelizeDynamic.query(
                query,
                { type: this.sequelizeDynamic.QueryTypes.SELECT }
            );
            // let DTable = 
            // await DT('DynamicPool', 'get', '', '', '', '', '', '', obj.corporateID, obj.companyID, obj.YrNo, '', query);

            DTable = cExFld ? await this.AddExColInDT(DTable, cExFld) : DTable;
            return this.DrToDic(DTable);
        } catch (ex) {
            console.error(`Error in GetBlankRowDict: ${cTblNM}`, ex);
            return null;
        }
    }

    async appendEntryDict(cTblNm, oEntry, lDelete = false, cWhere = "", transaction) {
        let lError;

        if (lDelete) {
            lError = await this.deleteRow(cTblNm, cWhere, transaction);
        }

        return !lError;
    }

    /**
* Deletes rows from the specified table based on condition.
* 
* @param {string} tableName - The name of the table.
* @param {string} whereClause - SQL WHERE clause string (e.g. "id = 5").
* @param {object} obj - Must include transactionMap and cBeginID.
* @returns {Promise<boolean>} - true if successful, false on error.
*/
    // async deleteRow(tableName, whereClause = "", transaction) {
    //     let success = true;

    //     try {
    //         // Check if transaction exists and is valid
    //         if (!transaction || !transaction.sequelize || !transaction.connection) {
    //             throw new Error("Invalid transaction object.");
    //         }

    //         // Early return if the whereClause is just '()' (no condition)
    //         if (whereClause === "()") {
    //             return true;
    //         }

    //         // Build the DELETE query safely (ensure `whereClause` is safe)
    //         const deleteQuery = `DELETE FROM ${tableName} WHERE ${whereClause}`;
    //         console.log("DELETE Query:", deleteQuery);

    //         // Execute the delete query with the provided transaction
    //         const [result] = await transaction.sequelize.query(deleteQuery, {
    //             transaction: transaction, // Pass the transaction here
    //         });

    //         // Check if any rows were affected
    //         if (result?.affectedRows === 0) {
    //             console.warn(`No rows deleted from ${tableName}. Condition: ${whereClause}`);
    //         }

    //     } catch (error) {
    //         console.error("deleteRow Error:", error);
    //         success = false;
    //     }

    //     return success;
    // }

    async deleteRow(tableName, whereClause = "", transaction) {
        let success = true;

        try {
            if (!transaction || !transaction.sequelize) {
                throw new Error("Invalid transaction object.");
            }

            if (!whereClause || whereClause.trim() === "" || whereClause.trim() === "()") {
                console.warn(`Skipping delete from ${tableName} — empty WHERE clause.`);
                return true;
            }

            // ✅ Use queryGenerator instead of quoteTable() on QueryInterface
            const queryGenerator = transaction.sequelize.getQueryInterface().queryGenerator;
            const escapedTable = queryGenerator.quoteTable(tableName);

            const deleteQuery = `DELETE FROM ${escapedTable} WHERE ${whereClause}`;
            console.log("DELETE Query:", deleteQuery);

            // Execute query inside the transaction
            const [results, metadata] = await transaction.sequelize.query(deleteQuery, { transaction });

            // MSSQL returns { rowsAffected: [number] }
            const affectedRows = metadata?.rowsAffected?.[0] ?? 0;

            if (affectedRows === 0) {
                console.warn(`No rows deleted from ${tableName}. Condition: ${whereClause}`);
            }

        } catch (error) {
            console.error("deleteRow Error:", error);
            success = false;
        }

        return success;
    }


    async FillDataType(DTable, cDBType) {
        let cKey;

        // Check if aDTSQL is empty or null, and load the data type dictionary if necessary
        if (aDTSQL == null || Object.keys(aDTSQL).length === 0) {
            try {
                // Query the PLSYSDT table
                let DTType = await sequelizeIDB.query(`SELECT * FROM PLSYSDT`, {
                    type: sequelizeIDB.QueryTypes.SELECT
                });

                // Ensure DTType is an array
                if (Array.isArray(DTType)) {
                    // Loop through the returned data and populate aDTSQL
                    for (let i = 0; i < DTType.length; i++) {
                        cKey = DTType[i].PDTF01.toString().trim().toUpperCase();
                        if (!aDTSQL.hasOwnProperty(cKey)) {
                            aDTSQL[cKey] = DTType[i][("PDT" + cDBType).toString().trim().toUpperCase()];
                        }
                    }
                }
            } catch (error) {
                console.error("Error loading data type dictionary:", error);
            }
        }

        // Iterate over DTable to populate the DName field based on the DType
        for (let i = 0; i < DTable.length; i++) {
            cKey = DTable[i][DDefine.DBF_DType]?.toString().trim().toUpperCase();
            if (cKey && aDTSQL[cKey]) {
                DTable[i][DDefine.DBF_DName] = aDTSQL[cKey];
            }
        }

        return DTable;
    }
}

module.exports = DBHandler;
