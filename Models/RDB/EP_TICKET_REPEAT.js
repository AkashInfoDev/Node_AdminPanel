module.exports = (sequelize, DataTypes) => {
    return sequelize.define('EP_TICKET_REPEAT', {

        REP01: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

        REP02: { type: DataTypes.INTEGER, allowNull: false },

        REP03: DataTypes.STRING(255),
        REP04: DataTypes.TEXT,

        REP05: DataTypes.STRING(20),
        REP06: DataTypes.STRING(20),

        REP07: DataTypes.INTEGER,
        REP08: DataTypes.INTEGER,

        REP09: {
            type: DataTypes.DATE,
            allowNull: true
        },

        REP10: DataTypes.INTEGER,
        REP11: DataTypes.STRING(50)

    }, {
        tableName: 'EP_TICKET_REPEAT',
        timestamps: false
    });
};