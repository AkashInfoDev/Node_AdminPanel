const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the PLSDBM82 model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLSDBM82', {
        M82F01: {
            type: DataTypes.STRING(8),
            primaryKey: true,  // Assuming M81F00 is the primary key
            allowNull: false,  // It should not be null if it is the primary key
        },
        M82F02: {
            type: DataTypes.SMALLINT(4),
            allowNull: false,
        },
        M82F11: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        M82F12: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        M82F13: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        M82F14: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        M82F21: {
            type: DataTypes.TEXT(50),
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        M82F22: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        M82F23: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        M82CMP: {
            type: DataTypes.CHAR(1),
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        M82YRN: {
            type: DataTypes.CHAR(2),
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        M82ADA: {
            type: DataTypes.CHAR(1),
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        }
    }, {
        tableName: 'PLSDBM82',
        timestamps: false,
    });
};