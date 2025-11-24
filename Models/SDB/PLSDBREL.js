const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the Admin model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLSDBREL', {
        M00F01: {
            type: DataTypes.STRING(50),
            primaryKey: true
        },
        M00F02: {
            type: DataTypes.TEXT,
            unique: true,
        },
        M00F03: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        M00F04: {
            type: DataTypes.TEXT,
            allowNull: true,
        }
    }, {
        tableName: 'PLSDBREL',
        timestamps: false,
    });
};
