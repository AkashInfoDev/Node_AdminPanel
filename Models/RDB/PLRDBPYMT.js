const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the PLRDBPYMT model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLRDBPYMT', {
        PYMT01: {
            type: DataTypes.INTEGER, // CorporateID / Name
            primaryKey: true
        },

        PYMT02: {
            type: DataTypes.STRING(10) // CustomerID e.g., PL-P-00001
        },

        PYMT03: {
            type: DataTypes.INTEGER // Software type (e.g., PL)
        },

        PYMT04: {
            type: DataTypes.STRING(50)
        },

        PYMT05: {
            type: DataTypes.INTEGER
        },

        PYMT06: {
            type: DataTypes.INTEGER
        },

        PYMT07: {
            type: DataTypes.INTEGER
        },

        PYMT08: {
            type: DataTypes.TEXT
        },

        PYMT09: {
            type: DataTypes.INTEGER
        },

        PYMT10: {
            type: DataTypes.DATEONLY
        },

        PYMT11: {
            type: DataTypes.DATEONLY
        },

        PYMT12: {
            type: DataTypes.DATEONLY
        },

        PYMT13: {
            type: DataTypes.DATEONLY
        },

        PYMT14: {
            type: DataTypes.TEXT // nvarchar(MAX)
        },

        PYMT15: {
            type: DataTypes.STRING(10)
        },

        PYMT16: {
            type: DataTypes.STRING(100)
        }
    }, {
        tableName: 'PLRDBPYMT',
        timestamps: false,
    });
};
