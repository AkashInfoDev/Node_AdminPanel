module.exports = (sequelize, DataTypes) => {
    return sequelize.define('EP_PAYREQ', {

        PRQF00: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true   // internally needed
        },

        PRQF01: { // corporateId
            type: DataTypes.STRING(20),
            allowNull: false
        },

        PRQF02: { // requestType
            type: DataTypes.STRING(20),
            allowNull: false
        },

        PRQF03: { // requestData (JSON)
            type: DataTypes.TEXT('long'),
            allowNull: true
        },

        PRQF04: { // paymentData (JSON)
            type: DataTypes.TEXT('long'),
            allowNull: true
        },

        PRQF05: { // amount
            type: DataTypes.DECIMAL(18, 2),
            allowNull: true
        },

        PRQF06: { // description
            type: DataTypes.TEXT,
            allowNull: true
        },

        PRQF07: { // status
            type: DataTypes.STRING(1),
            defaultValue: 'P'  // PENDING
        },

        PRQF08: { // createdBy
            type: DataTypes.STRING(50),
            allowNull: true
        },

        PRQF09: { // approvedBy
            type: DataTypes.STRING(50),
            allowNull: true
        },

        PRQF10: { // createdAt
            type: DataTypes.DATE,
            allowNull: true
            // defaultValue: DataTypes.NOW
        },

        PRQF11: { // approvedAt
            type: DataTypes.DATE,
            allowNull: true
        },

        PRQF12: { // FILE01 reference
            type: DataTypes.INTEGER,
            allowNull: true
        }

    }, {
        tableName: 'EP_PAYREQ',
        timestamps: false
    });
};