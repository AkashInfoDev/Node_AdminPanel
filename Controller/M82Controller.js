const db = require('../Config/config');
const definePLSDBM82 = require('../Models/SDB/PLSDBM82'); // Model factory

class M82Controller {
    constructor(dbName) {
        if (dbName) dbName = dbName == 'PLP00001SDB' ? 'A00001SDB' : dbName 
        this.connection = db.createPool(dbName);
        this.PLSDBM82 = definePLSDBM82(this.connection);
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

            const results = await this.PLSDBM82.findAll(options);
            return results;
        } catch (error) {
            console.error('Error in findAll:', error);
            throw error;
        }
    }

    async create(M82F01, M82F02, M82F11, M82F12, M82F13, M82F14, M82F21, M82F22, M82F23, M82CMP, M82YRN, M82ADA) {
        let created = await this.PLSDBM82.create({
           M82F01,
           M82F02,
           M82F11,
           M82F12,
           M82F13,
           M82F14,
           M82F21,
           M82F22,
           M82F23,
           M82CMP,
           M82YRN,
           M82ADA
        });
    }

    async findOne(where = {}, orderby = [], attributes = null) {
        try {
            const options = {};
            if (where && Object.keys(where).length) options.where = where;
            if (orderby && orderby.length) options.order = orderby;
            if (attributes && attributes.length) options.attributes = attributes;

            const result = await this.PLSDBM82.findOne(options);
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

module.exports = M82Controller;

// const data = await controller.findAll(
//     { status: 'active' },                  // where
//     [['createdAt', 'DESC']],               // orderby
//     ['id', 'name', 'status']               // attributes
// );