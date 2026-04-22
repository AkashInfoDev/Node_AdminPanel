module.exports = (sequelize, DataTypes) => {
    return sequelize.define('PLSYSM82', {

        M82F00: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
            allowNull: false
        },

        M82F01: {
            type: DataTypes.STRING(100),
            allowNull: true
        },

        M82F02: {
            type: DataTypes.STRING(100),
            allowNull: true
        }

    }, {
        tableName: 'PLSYSM82',
        timestamps: false
    });
};