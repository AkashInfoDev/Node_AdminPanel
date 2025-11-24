const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the PLSDBUBC model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLSDBUBC', {
        UBCF01: {
            type: Sequelize.STRING,  // or whatever the correct type is
            primaryKey: true,
            allowNull: false
        },
        UBCF02: {
            type: Sequelize.TEXT, // or use Sequelize.JSON if storing JSON directly
            allowNull: false
        },
        UBCF03: {
            type: Sequelize.TEXT, // or use Sequelize.JSON if storing JSON directly
            allowNull: false
        },
        UBCF04: {
            type: Sequelize.TEXT, // or use Sequelize.JSON if storing JSON directly
            allowNull: false
        },
        UBCF05: {
            type: Sequelize.TEXT, // or use Sequelize.JSON if storing JSON directly
            allowNull: false
        }
    },
        {
            tableName: 'PLSDBUBC',
            timestamps: false,
        });
};
