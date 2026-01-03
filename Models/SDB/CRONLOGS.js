const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the Admin model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('CRONLOGS', {
        CRONF01: {
            type: DataTypes.INTEGER,
            autoIncrement: true, // This will be the only auto-increment field
            primaryKey: true, // Add a primary key designation
            allowNull: false, // Ensure it's not nullable
        },
        CRONF02: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        CRONF03: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        CRONF04: {
            type: DataTypes.STRING(50),
            allowNull: true,
        },
        CRONF05: {
            type: DataTypes.STRING(50),
            allowNull: true
        },
        // CRONF06: {
        //     type: DataTypes.STRING(1),
        //     allowNull: false
        // },
        CRONF07: {
            type: DataTypes.STRING(1),
            allowNull: false
        }
    }, {
        tableName: 'CRONLOGS',
        timestamps: false,
    });
};
