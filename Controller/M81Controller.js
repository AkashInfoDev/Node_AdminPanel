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

    async create(M81F00, M81F01, M81F02, M81F03, M81F04, M81F05, M81F06, M81F07, M81F08, M81IMG, M81RTY, M81ADA, M81CHLD, M81UNQ) {
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
            M81UNQ
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
}

module.exports = M81Controller;

// const data = await controller.findAll(
//     { status: 'active' },                  // where
//     [['createdAt', 'DESC']],               // orderby
//     ['id', 'name', 'status']               // attributes
// );