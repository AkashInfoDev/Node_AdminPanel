const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the Admin model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLSDBCMP', {
        CMPF01: {
            type: DataTypes.SMALLINT,
            primaryKey: true,
            autoIncrement: false,
        },
        CMPF02: {
            type: DataTypes.STRING(120),
            unique: true,
        },
        CMPF03: {
            type: DataTypes.STRING(10),
            allowNull: false,
        },
        CMPF04: {
            type: DataTypes.STRING(4000),
            allowNull: true,
        },
        CMPF11: {
            type: DataTypes.STRING(8),
            allowNull: false,
        },
        CMPF12: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        CMPF21: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        CMPF22: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
        },
        CMPF23: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        CMPF24: {
            type: DataTypes.STRING(4000),
            allowNull: true,
        },
        CMPDEL: {
            type: DataTypes.STRING(50),
            allowNull: true,
        }
    }, {
        tableName: 'PLSDBCMP',
        timestamps: false,
    });
};
