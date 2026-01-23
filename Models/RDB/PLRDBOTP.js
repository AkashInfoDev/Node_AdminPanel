const { DataTypes } = require('sequelize');

/**
 * Factory function to define PLRDBOTP model
 * @param {Sequelize} sequelize
 */
module.exports = (sequelize) => {
    return sequelize.define('PLRDBOTP', {
        OTPID: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },

        CORP_ID: {
            type: DataTypes.STRING(20),   // ✅ varchar(20)
            allowNull: false
        },

        EMAIL: {
            type: DataTypes.STRING(150),  // ✅ varchar(150)
            allowNull: false
        },

        OTP_CODE: {
            type: DataTypes.STRING(10),   // ✅ varchar(10)
            allowNull: false
        },

        OTP_EXPIRY: {
            type: DataTypes.DATE,         // ✅ datetime
            allowNull: false
        },

        OTP_STATUS: {
            type: DataTypes.STRING(20),   // ✅ varchar(20)
            allowNull: false
        }

    }, {
        tableName: 'PLRDBOTP',
        timestamps: false,
        freezeTableName: true
    });
};
