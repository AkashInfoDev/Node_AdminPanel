const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('EP_LOGIN', {

        // 🔑 Primary Key
        LOG01: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },

        // 👤 User ID (EP_USER.UTF01)
        LOG02: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        // 📅 Login Time
        LOG03: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },

        // 🔐 Token
        LOG04: {
            type: DataTypes.TEXT,
            allowNull: false
        }

    }, {
        tableName: 'EP_LOGIN',
        timestamps: false
    });
};