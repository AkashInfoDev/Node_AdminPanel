const db = require('../Config/config');
const definePLSDBCMP = require('../Models/SDB/PLSDBCMP'); // Model factory

class CMPController {
    constructor(dbName) {
        if (dbName) dbName = dbName == 'PLP00001SDB' ? 'A00001SDB' : dbName 
        this.connection = db.createPool(dbName);
        this.PLSDBCMP = definePLSDBCMP(this.connection);
    }

    /**
     * Retrieve all records with optional filters, ordering, and selected attributes
     * @param {Object} where - Sequelize where clause
     * @param {Array|String} orderby - Sequelize order clause
     * @param {Array} attributes - Attributes to select
     * @returns {Promise<Array>} - List of records
     */
    async findAll(where = {}, orderby = [], attributes = null) {
        try {
            const options = {};

            // Filter records
            if (where && Object.keys(where).length) {
                options.where = where;
            }

            // Order records
            if (orderby && orderby.length) {
                options.order = orderby;
            }

            // Select specific columns
            if (attributes && attributes.length) {
                options.attributes = attributes;
            }

            const results = await this.PLSDBCMP.findAll(options);
            return results;
        } catch (error) {
            console.error('Error in findAll:', error);
            throw error;
        }
    }

    async create(CMPF01, CMPF02, CMPF03, CMPF04, CMPF11, CMPF12, CMPF21, CMPF22, CMPF23, CMPF24, CMPDEL) {
        let created = await this.PLSDBCMP.create({
            CMPF01,
            CMPF02,
            CMPF03,
            CMPF04,
            CMPF11,
            CMPF12,
            CMPF21,
            CMPF22,
            CMPF23,
            CMPF24,
            CMPDEL
        });
    }

    async findOne(where = {}, orderby = [], attributes = null) {
        try {
            const options = {};
            if (where && Object.keys(where).length) options.where = where;
            if (orderby && orderby.length) options.order = orderby;
            if (attributes && attributes.length) options.attributes = attributes;

            const result = await this.PLSDBCMP.findOne(options);
            return result;
        } catch (error) {
            console.error('Error in findOne:', error);
            throw error;
        }
    }

    /**
 * Update records matching the where clause with the given values
 * @param {Object} values - Fields to update
 * @param {Object} where - Conditions to select records
 * @returns {Promise<Object>} - { affectedCount, affectedRows }
 */
    async update(values, where = {}) {
        try {
            if (!values || Object.keys(values).length === 0) {
                throw new Error('No values provided for update');
            }
            if (!where || Object.keys(where).length === 0) {
                throw new Error('No conditions provided for update');
            }

            // Perform the update
            const [affectedCount, affectedRows] = await this.PLSDBCMP.update(values, {
                where,
                returning: true // returns updated rows (Postgres, some DBs)
            });

            return { affectedCount, affectedRows };
        } catch (error) {
            console.error('Error in update:', error);
            throw error;
        }
    }
}

module.exports = CMPController;

// const data = await controller.findAll(
//     { status: 'active' },                  // where
//     [['createdAt', 'DESC']],               // orderby
//     ['id', 'name', 'status']               // attributes
// );