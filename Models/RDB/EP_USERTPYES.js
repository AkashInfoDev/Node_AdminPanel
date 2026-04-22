module.exports = (sequelize, DataTypes) => {
    return sequelize.define('EP_USERTPYES', {
        ID: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        Type: {
            type: DataTypes.STRING(50)
        }
    }, {
        tableName: 'EP_USERTPYES',
        timestamps: false
    });
};