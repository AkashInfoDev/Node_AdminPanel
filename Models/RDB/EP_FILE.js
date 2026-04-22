module.exports = (sequelize, DataTypes) => {
    return sequelize.define('EP_FILE', {

        FILE01: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },

        FILE02: {
            type: DataTypes.STRING(255),
            allowNull: false
        },

        FILE03: {
            type: DataTypes.TEXT('long'),
            allowNull: false
        },

        FILE04: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        FILE05: {
            type: DataTypes.DATE,
            allowNull: true   // ✅ let DB handle GETDATE()
        }

    }, {
        tableName: 'EP_FILE',
        timestamps: false
    });
};