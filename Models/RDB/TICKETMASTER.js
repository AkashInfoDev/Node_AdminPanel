module.exports = (sequelize, DataTypes) => {
    return sequelize.define('TICKETMASTER', {

        CAT01: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },

        CAT02: {
            type: DataTypes.STRING(100),
            allowNull: false
        },

        CAT03: {
            type: DataTypes.INTEGER, // assigned role
            allowNull: true
        },

        CAT04: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }

    }, {
        tableName: 'TICKETMASTER',
        timestamps: false
    });
};