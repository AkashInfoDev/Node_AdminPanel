const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the PLRDBPLREL model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLRDBPLREL', {
        RELF00: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        RELF01: {
            type: DataTypes.TEXT
        },
        RELF02: {
            type: DataTypes.FLOAT
        },
        RELF03: {
            type: DataTypes.CHAR(1)
        },
        RELF04: {
            type: DataTypes.TEXT
        }
    }, {
        tableName: 'PLRDBPLREL',
        timestamps: false,
    });
};
