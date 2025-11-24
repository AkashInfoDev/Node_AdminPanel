const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the PLRDBA01 model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */

module.exports = (sequelize) => {
    return sequelize.define('PLSYS13', {
        S13F00: {
            type: DataTypes.STRING(1),
            allowNull: true,
        },
        S13F01: {
            type: DataTypes.STRING(10),
            allowNull: true,
        },
        S13PID: {
            type: DataTypes.STRING(10),
            allowNull: true,
        },
        S13F02: {
            type: DataTypes.STRING(15),
            allowNull: true,
        },
        S13F03: {
            type: DataTypes.STRING(2), // nvarchar(MAX)
            allowNull: true,
        },
        S13F03NM: {
            type: DataTypes.STRING(15),
            allowNull: true,
        },
        S13F04: {
            type: DataTypes.DECIMAL(4,0),
            allowNull: true,
        },
        S13F05: {
            type: DataTypes.DECIMAL(1,0),
            allowNull: true,
        },
        S13F06: {
            type: DataTypes.DECIMAL(3,0),
            allowNull: true,
        },
        S13F07: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S13F63: {
            type: DataTypes.STRING(1),
            allowNull: true,
        },
        S13F64: {
            type: DataTypes.STRING(1),
            allowNull: true,
        },
        S13F21: {
            type: DataTypes.STRING(1),
            allowNull: true,
        },
        S13F61: {
            type: DataTypes.STRING(1),
            allowNull: true,
        },
        S13F62: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        S13F08: {
            type: DataTypes.STRING(1),
            allowNull: true,
        },
        S13F09: {
            type: DataTypes.TEXT, // nvarchar(MAX)
            allowNull: true,
        },
        S13F11: {
            type: DataTypes.DECIMAL(3,0),
            allowNull: true,
        },
        S13F12: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S13F13: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S13F14: {
            type: DataTypes.STRING(15),
            allowNull: true,
        },
        S13F16: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S13F82: {
            type: DataTypes.STRING(1),
            allowNull: true,
        },
        S13F83: {
            type: DataTypes.STRING(1),
            allowNull: true,
        },
        S13F84: {
            type: DataTypes.STRING(2),
            allowNull: true,
        },
        S13F85: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S13F86: {
            type: DataTypes.STRING(2),
            allowNull: true,
        },
        S13F87: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S13F09D: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S13F03V: {
            type: DataTypes.STRING(1),
            allowNull: true,
        }
    }, {
        tableName: 'PLSYS13',
        timestamps: false,
        freezeTableName: true
    });
};