const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the PLRDBA01 model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */

module.exports = (sequelize) => {
    return sequelize.define('PLSYS01', {
        S01F00: {
            type: DataTypes.STRING(8),
            allowNull: true,
        },
        S01F01: {
            type: DataTypes.CHAR(4),
            allowNull: true,
        },
        S01FTY: {
            type: DataTypes.CHAR(4),
            allowNull: true,
        },
        S01F02: {
            type: DataTypes.STRING(8),
            allowNull: true,
        },
        S01F03: {
            type: DataTypes.TEXT, // nvarchar(MAX)
            allowNull: true,
        },
        S01F04: {
            type: DataTypes.STRING(10),
            allowNull: true,
        },
        S01F04E: {
            type: DataTypes.CHAR(1),
            allowNull: true,
        },
        S01F05: {
            type: DataTypes.TEXT, // nvarchar(MAX)
            allowNull: true,
        },
        S01F07: {
            type: DataTypes.TEXT, // varchar(MAX)
            allowNull: true,
        },
        S01F08: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S01F09: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S01F10: {
            type: DataTypes.STRING(70),
            allowNull: true,
        },
        S01F11: {
            type: DataTypes.TEXT, // nvarchar(MAX)
            allowNull: true,
        },
        S01F12: {
            type: DataTypes.STRING(8),
            allowNull: true,
        },
        S01MRU: {
            type: DataTypes.STRING(3),
            allowNull: true,
        },
        S01F24: {
            type: DataTypes.STRING(3),
            allowNull: true,
        },
        S01F26: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S01F27: {
            type: DataTypes.TEXT, // nvarchar(MAX)
            allowNull: true,
        },
        S01F28: {
            type: DataTypes.STRING(10),
            allowNull: true,
        },
        S01F29: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S01F04D: {
            type: DataTypes.CHAR(1),
            allowNull: true,
        },
        S01F10D: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        S01F10T: {
            type: DataTypes.TEXT, // nvarchar(MAX)
            allowNull: true,
        },
    }, {
        tableName: 'PLSYS01',
        timestamps: false,
        freezeTableName: true
    });
};