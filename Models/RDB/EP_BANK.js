const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('EP_BANK', {

        // 🔑 Primary Key
        BNK01: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },

        // 👤 Dealer User_Id (FK → EP_USER.UTF01)
        BNK02: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        // 🏦 Account Holder Name
        BNK03: DataTypes.STRING(100),

        // 🏦 Bank Name
        BNK04: DataTypes.STRING(100),

        // 💳 Account Number
        BNK05: DataTypes.STRING(50),

        // 🔐 IFSC Code
        BNK06: DataTypes.STRING(20),

        // 📱 UPI ID
        BNK07: DataTypes.STRING(100),

        // 🔐 Active Flag
        BNK08: {
            type: DataTypes.CHAR(1),
            defaultValue: 'Y'
        },

        // 🗑️ Soft Delete Flag
        BNK09: {
            type: DataTypes.CHAR(1),
            defaultValue: 'N'
        }

    }, {
        tableName: 'EP_BANK',
        timestamps: false
    });
};