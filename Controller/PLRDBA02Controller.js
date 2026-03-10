const db = require('../Config/config');
const definePLRDBA02 = require('../Models/RDB/PLRDBA02');

class PLRDBA02Controller {
    constructor() {
        // RDB is fixed
        this.connection = db.getConnection('RDB');
        this.PLRDBA02 = definePLRDBA02(this.connection);
    }

    /* ==========================
     * CREATE PLAN
     * ========================== */
    async create(data) {
        return await this.PLRDBA02.create(data);
    }

    /* ==========================
     * FIND ALL
     * ========================== */
    async findAll(where = {}, orderby = [], attributes = null) {
        const options = {};

        if (where && Object.keys(where).length) options.where = where;
        if (orderby && orderby.length) options.order = orderby;
        if (attributes && attributes.length) options.attributes = attributes;

        return await this.PLRDBA02.findAll(options);
    }

    /* ==========================
     * FIND ONE
     * ========================== */
    async findOne(where = {}, attributes = null) {
        const options = {};
        if (where && Object.keys(where).length) options.where = where;
        if (attributes && attributes.length) options.attributes = attributes;

        return await this.PLRDBA02.findOne(options);
    }

    /* ==========================
     * UPDATE PLAN
     * ========================== */
    async update(values, where) {
        if (!values || !Object.keys(values).length)
            throw new Error('No values provided for update');

        if (!where || !Object.keys(where).length)
            throw new Error('No conditions provided for update');

        const [affectedCount] = await this.PLRDBA02.update(values, { where });
        return affectedCount;
    }

    /* ==========================
     * SOFT DELETE
     * ========================== */
    async softDelete(A02F01) {
        return await this.PLRDBA02.update(
            { A02F09: 0 },
            { where: { A02F01 } }
        );
    }

    /* ==========================
     * RESTORE
     * ========================== */
    async restore(A02F01) {
        return await this.PLRDBA02.update(
            { A02F09: 1 },
            { where: { A02F01 } }
        );
    }

    /* ==========================
     * HARD DELETE (rare)
     * ========================== */
    async destroy(where) {
        if (!where || !Object.keys(where).length)
            throw new Error('Where clause required');

        return await this.PLRDBA02.destroy({ where });
    }
}

module.exports = PLRDBA02Controller;
