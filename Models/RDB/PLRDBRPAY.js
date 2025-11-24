const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the PLRDBRPAY model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLRDBRPAY', {
        RPAYF01: {
            type: Sequelize.STRING,  // or whatever the correct type is
            primaryKey: true,
            allowNull: false
          },
          RPAYF02: {
            type: Sequelize.TEXT, // or use Sequelize.JSON if storing JSON directly
            allowNull: false
          }
    }, {
        tableName: 'PLRDBRPAY',
        timestamps: false,
    });
};