const db = require('../Config/config');
const definePLRDBPLREL = require('../Models/RDB/PLRDBPLREL');
const sequelizeRDB = db.getConnection('RDB');

class PLRDBPLRELController {
    constructor() {
        // RDB is fixed
        this.connection = db.getConnection('RDB');
        this.PLRDBPLREL = definePLRDBPLREL(this.connection);
    }

    /* ==========================
     * CREATE ADD-ON / MODULE / SETUP
     * ========================== */
    async create(data) {
        return await this.PLRDBPLREL.create(data);
    }

    /* ==========================
     * FIND ALL
     * ========================== */
    async findAll(where = {}, orderby = [], attributes = null) {
        const options = {};

        if (where && Object.keys(where).length) options.where = where;
        if (orderby && orderby.length) options.order = orderby;
        if (attributes && attributes.length) options.attributes = attributes;

        return await this.PLRDBPLREL.findAll(options);
    }

    /* ==========================
     * FIND ONE
     * ========================== */
    async findOne(where = {}, attributes = null) {
        const options = {};

        if (where && Object.keys(where).length) options.where = where;
        if (attributes && attributes.length) options.attributes = attributes;

        return await this.PLRDBPLREL.findOne(options);
    }

    /* ==========================
     * UPDATE ADD-ON
     * ========================== */
    async update(values, where) {
        if (!values || !Object.keys(values).length)
            throw new Error('No values provided for update');

        if (!where || !Object.keys(where).length)
            throw new Error('No conditions provided for update');

        const [affectedCount] = await this.PLRDBPLREL.update(values, { where });
        return affectedCount;
    }

    /* ==========================
     * HARD DELETE
     * ========================== */
    async destroy(where) {
        if (!where || !Object.keys(where).length)
            throw new Error('Where clause required');

        return await this.PLRDBPLREL.destroy({ where });
    }

    // async getAllWithSetupNames() {
    //     return await this.connection.query(`
    //     SELECT 
    //         R.RELF00,
    //         R.RELF01,
    //         R.RELF02,
    //         R.RELF03,
    //         S.F02F03E AS setupName
    //     FROM PLRDBPLREL R
    //     LEFT JOIN PLSYSF02 S
    //         ON R.RELF03 = 'S'
    //         AND R.RELF01 = S.F02F01
    //     ORDER BY R.RELF03 ASC, R.RELF00 ASC
    // `);
    // }

}

module.exports = PLRDBPLRELController;
