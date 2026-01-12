const db = require('../Config/config');
const definePLSDBADMI = require('../Models/SDB/PLSDBADMI'); // Model factory
class ADMIController {
    constructor(dbName) {
        if (dbName) dbName = dbName == 'PLP00001SDB' ? 'A00001SDB' : dbName 
        this.connection = db.createPool(dbName);
        this.PLSDBADMI = definePLSDBADMI(this.connection);
    }
    async create(encryptedUserId, firstName, middleName, lastName, hashedPassword, roleId, email, dob, gender, address, phoneNumber, base64Image, BrcList, CmpList, menuList, cusRole, corpId) {
        return await this.PLSDBADMI.create({
            ADMIF01: encryptedUserId,
            ADMIF02: firstName,
            ADMIF03: middleName,
            ADMIF04: lastName,
            ADMIF05: hashedPassword,
            ADMIF06: roleId,
            ADMIF07: email,
            ADMIF09: (dob?.toString()) ? dob.toString() : null,
            ADMIF10: gender,
            ADMIF12: address,
            ADMIF13: phoneNumber,
            ADMIF14: base64Image,
            ADMIBRC: BrcList,
            ADMICOMP: CmpList,
            ADMIMOD: menuList,
            ADMIROL: cusRole,
            ADMICORP: corpId
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

            const results = await this.PLSDBADMI.findAll(options);
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

            const result = await this.PLSDBADMI.findOne(options);
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
            const [affectedCount, affectedRows] = await this.PLSDBADMI.update(values, {
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
            const options = {};

            // Filter records
            if (where && Object.keys(where).length) {
                options.where = where;
            }
            return await this.PLSDBADMI.destroy(options);
        } catch (error) {
            throw new Error(`Failed to destroy record: ${error.message}`);
        }
    }
}

module.exports = ADMIController