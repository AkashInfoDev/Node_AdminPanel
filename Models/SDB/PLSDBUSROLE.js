const { MAX } = require('mssql2');
const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the Admin model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLSDBUSROLE', {
        USRF00: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        USRF01: {
            type: DataTypes.STRING(MAX),
        },
        USRF02: {
            type: DataTypes.STRING(MAX),
        },
        USRF03: {
            type: DataTypes.STRING(MAX),
        },
        USRF04: {
            type: DataTypes.STRING(MAX),
        },
        USRF05: {
            type: DataTypes.STRING(MAX),
        },
        USRF06: {
            type: DataTypes.STRING(MAX),
        },
        USRF07: {
            type: DataTypes.STRING(MAX),
        }
    }, {
        tableName: 'PLSDBUSROLE',
        timestamps: false,
    });
};
