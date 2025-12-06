const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the Admin model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLSDBBRC', {
        BRCODE: {
            type: DataTypes.STRING(50),
            primaryKey: true,
        },

        BRNAME: {
            type: DataTypes.STRING(100),
            unique: true,
        },
        BRGST: {
            type: DataTypes.STRING(15),
            allowNull: false,
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
        }
    }, {
        tableName: 'PLSDBBRC',
        timestamps: false,
    });
};
