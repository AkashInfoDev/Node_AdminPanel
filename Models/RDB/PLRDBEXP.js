const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('PLRDBEXP', {

        // 🔑 Primary Key
        EXPF01: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },

        // Expance Name
        EXPF02: {
            type: DataTypes.STRING(100),
            allowNull: false
        },

        // Expance Amount(₹) / Percentage (%)
        EXPF03: DataTypes.FLOAT,

        //Type of EXPF03 (is amount or percenteage or else)
        EXPF04: DataTypes.CHAR(1),

        // Active or not
        EXPF05: DataTypes.CHAR(1)

    }, {
        tableName: 'PLRDBEXP',
        timestamps: false
    });
};