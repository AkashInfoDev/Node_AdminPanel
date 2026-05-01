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

        TKT06: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        TKT07: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        TKT08: {
            type: DataTypes.DATE,
            allowNull: true
        },

        TKT09: {
            type: DataTypes.DATE,
            allowNull: true
        },

        // ✅ ADD THIS
        TKT10: {
            type: DataTypes.INTEGER,
            allowNull: true
        }

    }, {
        tableName: 'EP_TICKET',
        timestamps: false
    });
};
