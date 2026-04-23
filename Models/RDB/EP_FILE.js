module.exports = (sequelize, DataTypes) => {
    return sequelize.define('EP_FILE', {

        FILE01: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },

        FILE02: {
            type: DataTypes.STRING(255),
            allowNull: true
        },

        FILE03: {
            type: DataTypes.TEXT('long'),
            allowNull: true
        },

        FILE04: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        FILE05: {
            type: DataTypes.DATE,
            allowNull: true   // ✅ let DB handle GETDATE()
        },

        FILE06: {  // 🆕 description
            type: DataTypes.TEXT,
            allowNull: true
        },

        FILE07: {  // 🆕 source
            type: DataTypes.STRING(50),
            allowNull: true
        }

    }, {
        tableName: 'EP_FILE',
        timestamps: false
    });
};