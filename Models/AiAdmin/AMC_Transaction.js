const { DataTypes, Sequelize, INTEGER, DATE, FLOAT, STRING, TEXT } = require('sequelize');

/**
 * Factory function to define the AMC_Transaction model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('AMC_Transaction', {
        Amc_Id: {
            type: INTEGER,
            primaryKey: true,
            autoincrement: true,
        },
        Amc_date: {
            type: DATE,
            defaultValue: null
        },
        Cust_Id: {
            type: INTEGER,
            defaultValue: null
        },
        Amc_Start_date: {
            type: DATE,
            defaultValue: null
        },
        Amc_End_date: {
            type: DATE,
            defaultValue: null
        },
        Amc_Type: {
            type: INTEGER,
            defaultValue: null
        },
        Amc_Amt: {
            type: FLOAT,
            defaultValue: null
        },
        Payment_Type: {
            type: INTEGER,
            defaultValue: null
        },
        Remarks: {
            type: STRING(255),
            defaultValue: null
        },
        AMC_custid: {
            type: STRING(10),
            defaultValue: null
        },
        AMC_CorporateId: {
            type: STRING(32),
            defaultValue: null
        },
        AMC_UserID: {
            type: STRING(100),
            defaultValue: null
        },
        AMC_URN: {
            type: STRING(12),
            defaultValue: null
        },
        AMC_EntryDate: {
            type: DATE,
            defaultValue: null
        },
        AMC_ModifiedDate: {
            type: DATE,
            defaultValue: null
        },
        AMC_EntryBY: {
            type: INTEGER,
            defaultValue: null
        },
        AMC_ReceivedBy: {
            type: STRING(8),
            defaultValue: null
        },
        einv_cid: {
            type: STRING(100),
            defaultValue: null
        },
        einv_secret: {
            type: STRING(100),
            defaultValue: null
        },
        einvcr: {
            type: INTEGER,
            defaultValue: null
        },
        einvused: {
            type: INTEGER,
            defaultValue: null
        },
        cuser: {
            type: TEXT,
            defaultValue: null
        },
        cpass: {
            type: TEXT,
            defaultValue: null
        },
        apass: {
            type: TEXT,
            defaultValue: null
        },
        auser: {
            type: TEXT,
            defaultValue: null
        },
        apitype: {
            type: STRING(5),
            defaultValue: null
        },
    }, {
        tableName: 'AMC_Transaction',
        timestamps: false,
    });
};
