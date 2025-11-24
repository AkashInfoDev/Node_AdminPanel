const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the PLSYSM81 model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLSYSM81', {
        M81F00: {
            type: DataTypes.STRING(1),
            // primaryKey: true,  // Assuming M81F00 is the primary key
            allowNull: false,  // It should not be null if it is the primary key
        },
        M81F01: {
            type: DataTypes.STRING(8),
            allowNull: false,
        },
        M81F02: {
            type: DataTypes.STRING(50),
            allowNull: true,
        },
        M81F03: {
            type: DataTypes.STRING(15),
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        M81F04: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        M81F05: {
            type: DataTypes.STRING(8),
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        M81F06: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        M82F21: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        M81F22: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        M81F23: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        M81RTY: {
            type: DataTypes.STRING(10),
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        M81ADA: {
            type: DataTypes.CHAR(1),
            allowNull: false,
            defaultValue: '',  // Assuming 'N' as default value for a CHAR(1) field
        }
    }, {
        tableName: 'PLSYSM81',
        timestamps: false,
    });
};
