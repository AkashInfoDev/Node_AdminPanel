const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the PLRDBGAO model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLRDBGAO', {
        GAOF00: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        GAOF01: {
            type: DataTypes.STRING(20) // CorporateID / Name
        },
        GAOF02: {
            type: DataTypes.INTEGER
        },
        GAOF03: {
            type: DataTypes.INTEGER
        },
        GAOF04: {
            type: DataTypes.INTEGER
        },
        GAOF05: {
            type: DataTypes.INTEGER
        },
        GAOF06: {
            type: DataTypes.INTEGER
        },
        GAOF07: {
            type: DataTypes.INTEGER
        },
        GAOF08: {
            type: DataTypes.INTEGER
        },
        GAOF09: {
            type: DataTypes.INTEGER
        },
        GAOF10: {
            type: DataTypes.INTEGER
        }
    }, {
        tableName: 'PLRDBGAO',
        timestamps: false,
    });
};
