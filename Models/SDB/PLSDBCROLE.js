const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the Admin model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLSDBCROLE', {
        CROLF01: {
            type: DataTypes.STRING(50),
            primaryKey: true,
        },
        CROLF00: {
            type: DataTypes.STRING(10),
            unique: true,
        }
    }, {
        tableName: 'PLSDBCROLE',
        timestamps: false,
    });
};
