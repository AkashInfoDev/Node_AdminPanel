const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the PLSDBROLE model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLSDBROLE', {
        ROLEID: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true, // Automatically uses IDENTITY(1,1) in SQL Server
        },
        ROLENAME: {
            type: DataTypes.STRING(50), // NVARCHAR(50)
            allowNull: false,
        },
        ROLEDESC: {
            type: DataTypes.STRING(255), // NVARCHAR(255)
            allowNull: true,
        },
        ISACTIVE: {
            type: DataTypes.BOOLEAN, // Sequelize maps BOOLEAN to BIT in SQL Server
            allowNull: false,
            defaultValue: true, // Matches DEFAULT 1
        }
    }, {
        tableName: 'PLSDBROLE',
        timestamps: false, // No createdAt/updatedAt columns
    });
};
