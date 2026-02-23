const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the PLSDBM83 model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLSDBM83', {
        M83F01: {
            type: DataTypes.TEXT,
            primaryKey: true,  // Assuming M81F00 is the primary key
            allowNull: false,  // It should not be null if it is the primary key
        },
        M83F02: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        M83F03: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        M83F04: {
            type: DataTypes.STRING(25),
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        M83F06: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        M83F07: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        }
    }, {
        tableName: 'PLSDBM83',
        timestamps: false,
    });
};