const { Op } = require('sequelize');
const db = require('../Config/config');
const definePLSDBM81 = require('../Models/SDB/PLSDBM81'); // Model factory

class M81Controller {
    constructor(dbName) {
        if (dbName) dbName = dbName == 'PLP00001SDB' ? 'A00001SDB' : dbName
        this.connection = db.createPool(dbName);
        this.PLSDBM81 = definePLSDBM81(this.connection);
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

            const results = await this.PLSDBM81.findAll(options);
            return results;
        } catch (error) {
            console.error('Error in findAll:', error);
            throw error;
        }
    }

    async create(M81F00, M81F01, M81F02, M81F03, M81F04, M81F05, M81F06, M81F07, M81F08, M81IMG, M81RTY, M81ADA, M81CHLD, M81UNQ, M81SID) {
        let created = await this.PLSDBM81.create({
            M81F00,
            M81F01,
            M81F02,
            M81F03,
            M81F04,
            M81F05,
            M81F06,
            M81F07,
            M81F08,
            M81IMG,
            M81RTY,
            M81ADA,
            M81CHLD,
            M81UNQ,
            M81SID
        });
    }

    async findOne(where = {}, orderby = [], attributes = null) {
        try {
            const options = {};
            if (where && Object.keys(where).length) options.where = where;
            if (orderby && orderby.length) options.order = orderby;
            if (attributes && attributes.length) options.attributes = attributes;

            const result = await this.PLSDBM81.findOne(options);
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
                const [affectedCount, affectedRows] = await this.PLSDBM81.update(values, {
                    where: {
                        M81F00: {
                            [Op.ne]: ''
                        }
                    },
                })
                return { affectedCount, affectedRows };
                // throw new Error('No conditions provided for update');
            }

            // Perform the update
            const [affectedCount, affectedRows] = await this.PLSDBM81.update(values, {
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
            return await this.PLSDBM81.destroy(where);
        } catch (error) {
            throw new Error(`Failed to destroy record: ${error.message}`);
        }
    }
}

module.exports = M81Controller;

// const data = await controller.findAll(
//     { status: 'active' },                  // where
//     [['createdAt', 'DESC']],               // orderby
//     ['id', 'name', 'status']               // attributes
// );