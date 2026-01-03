const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the PLRDBA01 model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLRDBA01', {
        A01F01: {
            type: DataTypes.STRING(8), // Subscription Unique ID
            primaryKey: true
        },
        A01F02: {
            type: DataTypes.STRING(50) // CorporateID / Name
        },
        A01F03: {
            type: DataTypes.STRING(10) // CustomerID e.g., PL-P-00001
        },
        A01F04: {
            type: DataTypes.STRING(2) // Software type (e.g., PL)
        },
        A01F05: {
            type: DataTypes.STRING(1)
        },
        A01F06: {
            type: DataTypes.INTEGER
        },
        A01F07: {
            type: DataTypes.STRING(10)
        },
        A01F08: {
            type: DataTypes.STRING(1)
        },
        A01F10: {
            type: DataTypes.SMALLINT
        },
        A01F11: {
            type: DataTypes.DATEONLY
        },
        A01F12: {
            type: DataTypes.DATEONLY
        },
        A01F13: {
            type: DataTypes.DATEONLY
        },
        A01F14: {
            type: DataTypes.DATEONLY
        },
        A01F15: {
            type: DataTypes.DATEONLY
        },
        A01F16: {
            type: DataTypes.TEXT // nvarchar(MAX)
        },
        A01F51: {
            type: DataTypes.STRING(10)
        },
        A01F52: {
            type: DataTypes.STRING(100)
        },
        A01F53: {
            type: DataTypes.STRING(50)
        },
        A01F54: {
            type: DataTypes.STRING(50)
        },
        A01F09: {
            type: DataTypes.TEXT // nvarchar(MAX)
        },
        A01F17: {
            type: DataTypes.STRING(12)
        },
        A02F01: {
            type: DataTypes.INTEGER // Foreign key or related ID
        },
        A01CHLD: {
            type: DataTypes.STRING(10)
        },
        A01UNQ: {
            type: DataTypes.STRING(10),
            autoIncrement: true
        },
        FTPURL: {
            type: DataTypes.TEXT,
        },
        FTPUID: {
            type: DataTypes.TEXT,
        },
        FTPPWD: {
            type: DataTypes.TEXT,
        },
        FTPDIR: {
            type: DataTypes.TEXT,
        },
        FTPPATH: {
            type: DataTypes.TEXT,
        }
    }, {
        tableName: 'PLRDBA01',
        timestamps: false,
    });
};
