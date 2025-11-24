const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the PLRDBA01 model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */

module.exports = (sequelize) => {
    return sequelize.define('PLSYSF02', {
        F02F00: { type: DataTypes.CHAR },
        F02F01: { type: DataTypes.STRING },
        F02F02: { type: DataTypes.CHAR },
        F02F03: { type: DataTypes.STRING },
        F02F03E: { type: DataTypes.TEXT }, // NVARCHAR(MAX)
        F02F04: { type: DataTypes.STRING },
        F02F05: { type: DataTypes.CHAR },
        F02F07: { type: DataTypes.TEXT }, // NVARCHAR(MAX)
        F02F08: { type: DataTypes.TEXT }, // VARCHAR(MAX)
        F02F09: { type: DataTypes.TEXT },
        F02F08D: { type: DataTypes.TEXT },
        F02F12: { type: DataTypes.TEXT },
        F02F13: { type: DataTypes.STRING },
        F02F15: { type: DataTypes.STRING },
        F02F15E: { type: DataTypes.TEXT }, // NVARCHAR(MAX)
        F02F16: { type: DataTypes.STRING },
        F02F17: { type: DataTypes.STRING },
        F02F19: { type: DataTypes.TEXT },
        F02F31D: { type: DataTypes.TEXT }, // NVARCHAR(MAX)
        F02F31: { type: DataTypes.TEXT }, // NVARCHAR(MAX)
        F02PLID: { type: DataTypes.STRING },
        VFPF12: { type: DataTypes.TEXT }, // VARCHAR(MAX)
        VFPNEW: { type: DataTypes.CHAR },
    }, {
        tableName: 'PLSYSF02',
        timestamps: false, // Set to true if you have createdAt / updatedAt columns
        freezeTableName: true, // Prevents Sequelize from pluralizing table name
    });
};
