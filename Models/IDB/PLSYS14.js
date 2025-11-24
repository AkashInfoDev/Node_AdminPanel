const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the PLRDBA01 model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */

module.exports = (sequelize) => {
    return sequelize.define('PLSYS14', {
        S14F01: {
            type: DataTypes.STRING(10),
            allowNull: true,
        },
        S14PID: {
            type: DataTypes.STRING(10),
            allowNull: true,
        },
        S14F02: {
            type: DataTypes.STRING(4),
            allowNull: true,
        },
        S14F04: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S14F06: {
            type: DataTypes.STRING(1), // nvarchar(MAX)
            allowNull: true,
        },
        S14F07: {
            type: DataTypes.STRING(200),
            allowNull: true,
        },
        S14F08: {
            type: DataTypes.STRING(200),
            allowNull: true,
        },
        S14F09: {
            type: DataTypes.STRING(50),
            allowNull: true,
        },
        S14F10: {
            type: DataTypes.STRING(10),
            allowNull: true,
        },
        S14F11: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S14F12: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S14F13: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S14F14: {
            type: DataTypes.STRING(1),
            allowNull: true,
        },
        S14F15: {
            type: DataTypes.STRING(1),
            allowNull: true,
        },
        S14F16: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S14F18: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S14F61: {
            type: DataTypes.TEXT, // nvarchar(MAX)
            allowNull: true,
        },
        S14F62: {
            type: DataTypes.STRING(1),
            allowNull: true,
        },
        S14F63: {
            type: DataTypes.STRING(1),
            allowNull: true,
        },
        S14F64: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S14F71: {
            type: DataTypes.STRING(1),
            allowNull: true,
        },
        S14F72: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S14F73: {
            type: DataTypes.STRING(20),
            allowNull: true,
        },
        S14F74: {
            type: DataTypes.STRING(10),
            allowNull: true,
        },
        S14F01_V: {
            type: DataTypes.STRING(30), // nvarchar(MAX)
            allowNull: true,
        },
    }, {
        tableName: 'PLSYS14',
        timestamps: false,
        freezeTableName: true
    });
};