const db = require('../Config/config');
const definePLSDBBRC = require('../Models/SDB/PLSDBBRC'); // Model factory
class BRCController {
    constructor(dbName) {
        if (dbName) dbName = dbName == 'PLP00001SDB' ? 'A00001SDB' : dbName
        this.connection = db.createPool(dbName);
        this.PLSDBBRC = definePLSDBBRC(this.connection);
    }
    async create(BRCODE, BRNAME, BRGST, BRCORP, BRSTATE, BRDEF, BRCCOMP) {
        console.log(BRCODE, BRGST, BRCORP, BRSTATE, BRDEF, BRCCOMP);
        return await this.PLSDBBRC.create({
            BRCODE,
            BRNAME,
            BRGST,
            BRCORP,
            BRSTATE,
            BRDEF,
            BRCCOMP
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

            const results = await this.PLSDBBRC.findAll(options);
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

            const result = await this.PLSDBBRC.findOne(options);
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
            const [affectedCount, affectedRows] = await this.PLSDBBRC.update(values, {
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
            return await this.PLSDBBRC.destroy(where);
        } catch (error) {
            throw new Error(`Failed to destroy record: ${error.message}`);
        }
    }
}

module.exports = BRCController