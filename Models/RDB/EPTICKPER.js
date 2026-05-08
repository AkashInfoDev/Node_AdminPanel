module.exports = (sequelize, DataTypes) => {

    return sequelize.define('EPTICKPER', {

        TPER01: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },

        // ROLE ID
        TPER02: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        // ACCESS SCOPE
        TPER03: {
            type: DataTypes.STRING(20),
            defaultValue: 'SELF'
            // SELF
            // ALL
            // CUSTOM
        },

        // ALLOWED ROLE IDS
        TPER04: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        // CREATE TICKET
        TPER05: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },

        // assign ticket
        TPER06: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },

        // CHANGE STATUS
        TPER07: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },

        // DELETE
        TPER08: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        TPER09: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },

    }, {
        tableName: 'EPTICKPER',
        timestamps: false
    });

};