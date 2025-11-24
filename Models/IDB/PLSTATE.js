const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the PLSTATE model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLSTATE', {
        PLSF01: {
            type: DataTypes.STRING(35),
            primaryKey: true,
            allowNull: true,
        },
        PLSF02: {
            type: DataTypes.STRING(1),
            allowNull: true,
        },
        PLSF03: {
            type: DataTypes.STRING(3),
            allowNull: true,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        PLSF04: {
            type: DataTypes.STRING(2),
            allowNull: true,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        PLSF05: {
            type: DataTypes.STRING(2),
            allowNull: true,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        },
        PLSF06: {
            type: DataTypes.STRING(50),
            allowNull: true,
            defaultValue: '',  // Updated default value to an empty string (adjust as needed)
        }
    }, {
        tableName: 'PLSTATE',
        timestamps: false,
    });
};
