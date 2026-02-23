const db = require('../Config/config');
const definePLSDBM83 = require('../Models/SDB/PLSDBM83'); // Model factory

class M83Controller {
    constructor(dbName) {
        if (dbName) dbName = dbName == 'PLP00001SDB' ? 'A00001SDB' : dbName
        this.connection = db.createPool(dbName);
        this.PLSDBM83 = definePLSDBM83(this.connection);
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

            const results = await this.PLSDBM83.findAll(options);
            return results;
        } catch (error) {
            console.error('Error in findAll:', error);
            throw error;
        }
    }

    async create(M83F01, M83F02, M83F03, M83F04, M83F06, M83F07) {
        let created = await this.PLSDBM83.create({
            M83F01: M83F01,
            // M83F02: M83F02,
            // M83F03: M83F03,
            M83F04: M83F04,
            M83F06: M83F06,
            M83F07: M83F07
        });
    }

    async findOne(where = {}, orderby = [], attributes = null) {
        try {
            const options = {};
            if (where && Object.keys(where).length) options.where = where;
            if (orderby && orderby.length) options.order = orderby;
            if (attributes && attributes.length) options.attributes = attributes;

            const result = await this.PLSDBM83.findOne(options);
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
            const [affectedCount, affectedRows] = await this.PLSDBM83.update(values, {
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
            return await this.PLSDBM83.destroy({where});
        } catch (error) {
            throw new Error(`Failed to destroy record: ${error.message}`);
        }
    }
}

module.exports = M83Controller;

// const data = await controller.findAll(
//     { status: 'active' },                  // where
//     [['createdAt', 'DESC']],               // orderby
//     ['id', 'name', 'status']               // attributes
// );