const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the PLRDBA01 model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLRDBA02', {
        A02F01: {
            type: DataTypes.INTEGER, // Subscription Unique ID
            // primaryKey: true
        },
        A02F02: {
            type: DataTypes.STRING(50), // CorporateID / Name
            primaryKey: true
        },
        A02F03: {
            type: DataTypes.TEXT // CustomerID e.g., PL-P-00001
        },
        A02F04: {
            type: DataTypes.TEXT // Software type (e.g., PL)
        },
        A02F05: {
            type: DataTypes.DECIMAL(18, 4)
        },
        A02F06: {
            type: DataTypes.DECIMAL(18, 4)
        },
        A02F07: {
            type: DataTypes.DECIMAL(3, 0)
        },
        A02F08: {
            type: DataTypes.DECIMAL(4, 0)
        },
        A02F09: {
            type: DataTypes.BOOLEAN
        },
        A02F10: {
            type: DataTypes.STRING(1)
        },
        A02F11: {
            type: DataTypes.INTEGER
        },
        A02F12: {
            type: DataTypes.TEXT
        },
        A02F13: {
            type: DataTypes.INTEGER
        }
    }, {
        tableName: 'PLRDBA02',
        timestamps: false,
    });
};
