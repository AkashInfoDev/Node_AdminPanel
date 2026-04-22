const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('EP_TRNS', {
        //-- 🔑 Primary Key
        TRN01: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        //-- 👤 Dealer / Reseller ID (EP_USER.UTF01)
        TRN02: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        // -- 💰 Amount
        TRN03: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: false
        },
        // -- 💳 Payment Method (UPI / BANK / CASH)
        TRN04: DataTypes.STRING(20),

        //-- 🔄 Transaction Status (PENDING / COMPLETED)
        TRN05: {
            type: DataTypes.STRING(20),
            defaultValue: 'PENDING'
        },

        //-- 📅 Payment Date (when admin pays)
        TRN06: DataTypes.DATE,
        //-- 📅 Withdraw Request Date
        TRN07: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        //-- ✅ Approved By (Admin User_Id)
        TRN08: DataTypes.INTEGER,
        //-- 🔐 Transaction ID (external reference)
        TRN09: DataTypes.STRING(100),
        //-- 🔐 Active Flag
        TRN10: {
            type: DataTypes.CHAR(1),
            defaultValue: 'Y'
        },
        //-- 🗑️ Soft Delete
        TRN11: {
            type: DataTypes.CHAR(1),
            defaultValue: 'N'
        },
        TRN15: {
            type: DataTypes.STRING(255)
        }

    }, {
        tableName: 'EP_TRNS',
        timestamps: false
    });
};