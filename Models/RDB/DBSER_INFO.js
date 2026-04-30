const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('DBSER_INFO', {

        // 🔑 Primary Key
        INFO_01: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },

        // Server ID
        INFO_02: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        // Server User Name
        INFO_03: DataTypes.STRING(100),

        //Server User Password
        INFO_04: DataTypes.STRING(100),

        // FTP URL
        INFO_05: DataTypes.STRING(50),

        // FTP User Name
        INFO_06: DataTypes.STRING(20),

        // FTP User Password
        INFO_07: DataTypes.STRING(100),

        // FTP Directory
        INFO_08: {
            type: DataTypes.CHAR(1),
            defaultValue: 'Y'
        },

        // FTP Path
        INFO_09: {
            type: DataTypes.CHAR(1),
            defaultValue: 'N'
        },

        // Number of user Assigned to the server
        INFO_10: {
            type: DataTypes.CHAR(1),
            defaultValue: 'N'
        },

        // lActive / Active Flag
        INFO_11: {
            type: DataTypes.CHAR(1),
            defaultValue: 'N'
        }

    }, {
        tableName: 'DBSER_INFO',
        timestamps: false
    });
};