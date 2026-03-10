const { DataTypes, Sequelize, INTEGER, DATE, FLOAT, STRING, TEXT } = require('sequelize');

/**
 * Factory function to define the AMC_TransactionHistory model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('AMC_TransactionHistory', {
        Amc_Id: { //
            type: INTEGER,
            defaultValue: null
        },
        Amc_date: { //
            type: DATE,
            defaultValue: null
        },
        Cust_Id: { //
            type: INTEGER,
            defaultValue: null
        },
        Amc_Start_date: { //
            type: DATE,
            defaultValue: null
        },
        Amc_End_date: { //
            type: DATE,
            defaultValue: null
        },
        Amc_Type: { //
            type: INTEGER,
            defaultValue: null
        },
        Amc_Amt: { //
            type: FLOAT,
            defaultValue: null
        },
        Payment_Type: { //
            type: INTEGER,
            defaultValue: null
        },
        Remarks: { //
            type: STRING(255),
            defaultValue: null
        },
        AMC_custid: { //
            type: STRING(10),
            defaultValue: null
        },
        AMC_CorporateId: { //
            type: STRING(32),
            defaultValue: null
        },
        AMC_UserID: { //
            type: STRING(100),
            defaultValue: null
        },
        AMC_URN: { //
            type: STRING(12),
            defaultValue: null
        },
        AMC_EntryDate: { //
            type: DATE,
            defaultValue: null
        },
        AMC_ModifiedDate: { //
            type: DATE,
            defaultValue: null
        },
        AMC_EntryBY: { //
            type: INTEGER,
            defaultValue: null
        },
        AMC_ReceivedBy: { //
            type: STRING(8),
            defaultValue: null
        },
        ATH_Id: { //
            type: INTEGER,
            autoIncrement: true,
            primaryKey: true
        }
    }, {
        tableName: 'AMC_TransactionHistory',
        timestamps: false,
    });
};
