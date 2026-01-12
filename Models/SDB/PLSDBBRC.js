const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the Admin model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLSDBBRC', {
        BRID: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        BRCODE: {
            type: DataTypes.STRING(50),
        },

        BRNAME: {
            type: DataTypes.STRING(100),
            unique: true,
        },
        BRGST: {
            type: DataTypes.STRING(15),
            allowNull: true,
        },
        BRCORP: {
            type: DataTypes.STRING(10),
            allowNull: true,
        },
        BRSTATE: {
            type: DataTypes.STRING(15),
            allowNull: true
        },
        BRDEF: {
            type: DataTypes.STRING(1),
            allowNull: false
        },
        BRCCOMP: {
            type: DataTypes.STRING(100),
            allowNull: true
        }
    }, {
        tableName: 'PLSDBBRC',
        timestamps: false,
    });
};
