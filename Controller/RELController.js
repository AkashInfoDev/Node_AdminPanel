const db = require('../Config/config');
const definePLSDBREL = require('../Models/SDB/PLSDBREL'); // Model factory
class RELController {
    constructor(dbName) {
        if (dbName) dbName = dbName == 'PLP00001SDB' ? 'A00001SDB' : dbName 
        this.connection = db.createPool(dbName);
        this.PLSDBREL = definePLSDBREL(this.connection);
    }
    async create(M00F01 = '', M00F02 = '', M00F03 = '', M00F04 = '') {
        const newUser = await this.PLSDBREL.create({
            M00F01,
            M00F02,
            M00F03,
            M00F04,
        });
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

            const results = await this.PLSDBREL.findAll(options);
            return results;
        } catch (error) {
            console.error('Error in findAll:', error);
            throw error;
        }
    }

    async findOne(where = {}, orderby = [], attributes = null) {
        try {
            const options = {};
            if (where && Object.keys(where).length) options.where = where;
            if (orderby && orderby.length) options.order = orderby;
            if (attributes && attributes.length) options.attributes = attributes;

            const result = await this.PLSDBREL.findOne(options);
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

            // Perform the updatePLSDBREL
            const [affectedCount, affectedRows] = await this.PLSDBREL.update(values, {
                where,
                returning: true // returns updated rows (Postgres, some DBs)
            });

            return { affectedCount, affectedRows };
        } catch (error) {
            console.error('Error in update:', error);
            throw error;
        }
    }
    async destroy(where) {
        try {
            return await this.PLSDBREL.destroy(where);
        } catch (error) {
            throw new Error(`Failed to destroy record: ${error.message}`);
        }
    }
}

module.exports = RELController