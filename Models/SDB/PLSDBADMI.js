const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the Admin model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLSDBADMI', {
        ADMIF00: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        ADMIF01: {
            type: DataTypes.STRING(150),
            unique: true,
        },
        ADMIF02: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        ADMIF03: {
            type: DataTypes.STRING(50),
            allowNull: true,
        },
        ADMIF04: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        ADMIF05: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        ADMIF06: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        ADMIF07: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
        },
        ADMIF08: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        ADMIF09: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        ADMIF10: {
            type: DataTypes.STRING(10),
            allowNull: true,
        },
        // ADMIF11: {
        //     type: DataTypes.DATE,
        //     defaultValue: Sequelize.NOW,
        // },
        ADMIF12: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        ADMIF13: {
            type: DataTypes.STRING(20),
            allowNull: true,
        },
        ADMIF14: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        ADMICORP : {
            type: DataTypes.STRING(50),
            allowNull: true,
        },
        ADMIMOD : {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        ADMIROL: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        ADMIBRC: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        ADMICOMP: {
            type: DataTypes.STRING(100),
            allowNull: true
        }
    }, {
        tableName: 'PLSDBADMI',
        timestamps: false,
    });
};
