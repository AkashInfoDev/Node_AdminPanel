const { Op, QueryTypes } = require('sequelize');
const db = require('../../../Config/config')

class SDBHandler {
    constructor(dbName) {
        this.oCon = db.createPool(dbName);  // Assumed to return a Sequelize instance
    }

    async GetUserCmpList(cUID) { // Method To Return Userwise Cmp List
        // Build the where condition dynamically based on the presence of cUID
        const cWhr = cUID ? ` WHERE T2.M82F01 = '${cUID}'` : '';

        try {
            const query = `
            SELECT T1.*
            FROM PLSDBCMP AS T1
            LEFT JOIN PLSDBM82 AS T2 ON T1.CMPF01 = T2.M82F02
            ${cWhr} 
            ORDER BY CMPF01;
        `;

            // Perform the query using Sequelize with parameterized values
            const results = await this.oCon.query(query, {
                type: QueryTypes.RAW
            });
            // const results = await this.oCon.query(`SELECT T1.* FROM PLSDBCMP T1 LEFT JOIN PLSDBM82 T2 ON T1.CMPF01=T2.M82F02 ${cWhr} Order By CMPF01`, { type: QueryTypes.RAW });

            return results[0];
        } catch (error) {
            console.error('Error in GetUserCmpList:', error);
            throw error;  // You can handle or propagate the error depending on your needs
        }
    }
}

module.exports = SDBHandler;