const db = require('../Config/config');
// const defineUserTable = require('../Models/RDB/UserTable');
const defineEPUser = require('../Models/RDB/EP_USER');
// 🔥 create connection
const connection = db.createPool('RDB'); // or your actual DB name
// D:\Aashish\Admin_panel\Node_AdminPanel\Controller\UserController1.js
// 🔥 initialize model
const EPUser = defineEPUser(connection);

class EP_USERController {
constructor(dbName) {
    this.connection = db.createPool(dbName);
    this.EPUser = defineEPUser(this.connection);
}

    /* =========================
       🧱 CREATE USER
    ========================= */
    async create(data) {
        try {
            return await this.EPUser.create(data);
        } catch (error) {
            console.error('Error in create:', error);
            throw error;
        }
    }

    /* =========================
       🔍 FIND ALL
    ========================= */
    async findAll(where = {}, orderby = [], attributes = null) {
        try {
            const options = {};

            if (where && Object.keys(where).length) {
                options.where = where;
            }

            if (orderby && orderby.length) {
                options.order = orderby;
            }

            if (attributes && attributes.length) {
                options.attributes = attributes;
            }

            return await this.EPUser.findAll(options);

        } catch (error) {
            console.error('Error in findAll:', error);
            throw error;
        }
    }

    /* =========================
       🔍 FIND ONE
    ========================= */
    async findOne(where = {}, orderby = [], attributes = null) {
        try {
            const options = {};

            if (where && Object.keys(where).length) {
                options.where = where;
            }

            if (orderby && orderby.length) {
                options.order = orderby;
            }

            if (attributes && attributes.length) {
                options.attributes = attributes;
            }

            return await this.EPUser.findOne(options);

        } catch (error) {
            console.error('Error in findOne:', error);
            throw error;
        }
    }

    /* =========================
       ✏️ UPDATE
    ========================= */
    async update(values, where = {}) {
        try {
            if (!values || Object.keys(values).length === 0) {
                throw new Error('No values provided for update');
            }

            if (!where || Object.keys(where).length === 0) {
                throw new Error('No conditions provided for update');
            }

            const [affectedCount, affectedRows] = await this.EPUser.update(values, {
                where,
                returning: true
            });

            return { affectedCount, affectedRows };

        } catch (error) {
            console.error('Error in update:', error);
            throw error;
        }
    }

    /* =========================
       ❌ DELETE
    ========================= */
    async destroy(where = {}) {
        try {
            return await this.EPUser.destroy({ where });
        } catch (error) {
            console.error('Error in destroy:', error);
            throw error;
        }
    }

    /* =========================
       🔢 COUNT
    ========================= */
    async count(where = {}) {
        try {
            return await this.EPUser.count({ where });
        } catch (error) {
            console.error('Error in count:', error);
            throw error;
        }
    }
}

module.exports = EP_USERController;