const { DataTypes, Sequelize } = require('sequelize');

/**
 * Factory function to define the PLRDBPYMT model on a specific Sequelize instance.
 * @param {Sequelize} sequelize - The Sequelize instance for a specific database
 */
module.exports = (sequelize) => {
    return sequelize.define('PLRDBPYMT', {
        PYMT00: { //-- Payment ID (Auto Increment)
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        PYMT01: { // Corporation ID
            type: DataTypes.STRING(15),
            allowNull: false,
        },
        PYMT02: { // User ID
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        PYMT03: { //Transaction ID
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        PYMT04: { // Payment Modes
            type: DataTypes.STRING(15),
            allowNull: false,
        },
        PYMT05: { // Amount
            type: DataTypes.DECIMAL(18, 2),
            allowNull: false,
        },
        PYMT06: { // Payment Status (e.g., 'Pending', 'Completed', 'Failed')
            type: DataTypes.STRING(20),
            allowNull: false,
        },
        PYMT07: { // Payment Method (e.g., 'Credit Card', 'Bank Transfer', 'PayPal')
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        PYMT08: { // Payment Date and Time (Auto-generated, default to current timestamp)
            type: DataTypes.DATE,
            defaultValue: Sequelize.NOW,
        },
        PYMT09: { // Payment Description (text)
            type: DataTypes.TEXT,
        },
        PYMT10: { // Next Payment Date
            type: DataTypes.STRING(50),
        }
    }, {
        tableName: 'PLRDBPYMT',
        timestamps: false, // Disable automatic timestamp fields like createdAt, updatedAt
    });
};
