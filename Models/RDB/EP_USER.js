const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('EP_USER', {

        UTF01: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },

        UTF02: DataTypes.STRING,
        UTF03: DataTypes.INTEGER,

        UTF04: {
            type: DataTypes.STRING(100),
            unique: true
        },

        UTF05: DataTypes.STRING,

        UTF06: {
            type: DataTypes.CHAR(1),
            defaultValue: 'Y'
        },

        UTF07: {
            type: DataTypes.CHAR(1),
            defaultValue: 'N'
        },

        UTF08: DataTypes.STRING(50),
        UTF09: DataTypes.BIGINT,
        UTF10: DataTypes.STRING(100),
        UTF11: DataTypes.TEXT,
        UTF12: DataTypes.FLOAT,
        UTF13: DataTypes.TEXT,
        UTF14: DataTypes.STRING(50),
        UTF15: DataTypes.STRING(50),
        UTF16: DataTypes.INTEGER,
        UTF17: DataTypes.STRING(15)

    }, {
        tableName: 'EP_USER',
        timestamps: false
    });
};