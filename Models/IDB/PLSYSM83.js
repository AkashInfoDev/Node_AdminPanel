module.exports = (sequelize, DataTypes) => {
    return sequelize.define('PLSYSM83', {

        M83F00: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
        },

        M83F01: {
            type: DataTypes.STRING(100),
            allowNull: true
        },

        M83F02: {
            type: DataTypes.INTEGER, // ROLE ID
            allowNull: false
        },

        // ALL ACCESS
        M83F03: {
            type: DataTypes.BOOLEAN,
            defaultValue: false // ADD ALL
        },

        M83F04: {
            type: DataTypes.BOOLEAN,
            defaultValue: false // EDIT ALL
        },

        M83F05: {
            type: DataTypes.BOOLEAN,
            defaultValue: false // DELETE ALL
        },

        M83F06: {
            type: DataTypes.BOOLEAN,
            defaultValue: false // VIEW ALL
        },

        M83F08: {
            type: DataTypes.INTEGER, // MENU ID
            allowNull: false
        },

        // SELF ACCESS
        M83F09: {
            type: DataTypes.BOOLEAN,
            defaultValue: false // VIEW SELF
        },



    }, {
        tableName: 'PLSYSM83',
        timestamps: false
    });
};