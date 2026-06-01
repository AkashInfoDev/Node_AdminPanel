const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    return sequelize.define('EP_DELETE', {

        DEL01: {   
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },

        DEL02: {
            type: DataTypes.STRING(100),
            allowNull: false
        },//-- User ID / Corporate ID

        DEL03: {
            type: DataTypes.INTEGER,
            allowNull: true
        }, // -- Created By

        DEL04: {
            type: DataTypes.INTEGER,
            allowNull: false
        },// -- Deleted By

        DEL05: {
            type: DataTypes.INTEGER,
            allowNull: false
        }, //-- Deleted By Role

        DEL06: {
            type: DataTypes.DATE,
            allowNull: true
        }

    }, {
        tableName: 'EP_DELETE',
        timestamps: false
    });

};