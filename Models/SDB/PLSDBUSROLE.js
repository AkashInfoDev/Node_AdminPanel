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
            type: DataTypes.INTEGER,
        },
        USRF02: {
            type: DataTypes.INTEGER,
            unique: true,
        },
        USRF03: {
            type: DataTypes.INTEGER,
            unique: true,
        },
        USRF04: {
            type: DataTypes.SMALLINT,
            allowNull: false,
        },
        USRF05: {
            type: DataTypes.SMALLINT,
            allowNull: true,
        },
        USRF06: {
            type: DataTypes.SMALLINT,
            allowNull: false,
        },
        USRF07: {
            type: DataTypes.SMALLINT,
            allowNull: false,
        },
        USRF08: {
            type: DataTypes.SMALLINT,
            allowNull: false,
        },
        USRF09: {
            type: DataTypes.SMALLINT,
            allowNull: false,
        }
    }, {
        tableName: 'PLSDBUSROLE',
        timestamps: false,
    });
};
