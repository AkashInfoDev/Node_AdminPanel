module.exports = (sequelize, DataTypes) => {
    return sequelize.define('PLSYSM83', {

        M83F00: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true   // required for Sequelize
        },

        M83F01: {
            type: DataTypes.STRING(100), // MENU NAME
            allowNull: false
        },

        M83F02: {
            type: DataTypes.INTEGER, // ROLE ID
            allowNull: false
        },

        M83F03: {
            type: DataTypes.BOOLEAN, // ADD
            defaultValue: false
        },

        M83F04: {
            type: DataTypes.BOOLEAN, // EDIT
            defaultValue: false
        },

        M83F05: {
            type: DataTypes.BOOLEAN, // DELETE
            defaultValue: false
        },

        M83F06: {
            type: DataTypes.BOOLEAN, // VIEW
            defaultValue: false
        },
         M83F08: {
            type: DataTypes.INTEGER, // menuid
            defaultValue: false
        }

    }, {
        tableName: 'PLSYSM83',
        timestamps: false
    });
};