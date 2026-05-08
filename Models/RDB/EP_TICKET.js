module.exports = (sequelize, DataTypes) => {
    return sequelize.define('EP_TICKET', {

        TKT01: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },

        TKT02: {
            type: DataTypes.STRING(255),
            allowNull: false
        },

        TKT03: {
            type: DataTypes.TEXT,
            allowNull: false
        },

        TKT04: {
            type: DataTypes.STRING(20),
            defaultValue: 'MEDIUM'
        },

        TKT05: {
            type: DataTypes.STRING(20),
            defaultValue: 'OPEN'
        },

        // 👨‍💻 Portal user
        TKT06: {
            type: DataTypes.INTEGER,
            allowNull: true
        },

        TKT07: {
            type: DataTypes.INTEGER,
            allowNull: true
        },

        // 🏢 Corporate user
        TKT11: {
            type: DataTypes.STRING(50),
            allowNull: true
        },

        TKT08: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW   // ✅ fix
        },

        TKT09: {
            type: DataTypes.DATE,
            allowNull: true
        },

        TKT10: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        TKT12: {
            type: DataTypes.STRING(64),
            allowNull: true
        },
        TKT13: {
            type: DataTypes.INTEGER,
            allowNull: true
        },

        TKT14: {
            type: DataTypes.INTEGER,
            allowNull: true
        },

        TKT15: {
            type: DataTypes.INTEGER,
            allowNull: true
        },

        TKT16: {
            type: DataTypes.DATE,
            allowNull: true
        },

    }, {
        tableName: 'EP_TICKET',
        timestamps: false
    });
};