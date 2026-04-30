module.exports = (sequelize, DataTypes) => {
    return sequelize.define('EP_TICKET_MSG', {

        MSG01: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },

        MSG02: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        MSG03: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        MSG04: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        MSG05: {
            type: DataTypes.TEXT,
            allowNull: false
        },

        MSG06: {
            type: DataTypes.DATE,
            allowNull: true
        }

    }, {
        tableName: 'EP_TICKET_MSG',
        timestamps: false
    });
};