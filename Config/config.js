const { Sequelize } = require('sequelize');
require('dotenv').config();

class Database {
    constructor() {
        this.connections = {};  // Object to store different Sequelize instances
    }

    // Creates a Sequelize pool for a specific database
    createPool(dbName) {
        // If a connection already exists for the database, return it
        if (this.connections[dbName]) {
            return this.connections[dbName];
        }

        // // Define the config based on environment variables and the specific db
        // const dbConfig = {
        //     [dbName]: {
        //         username: process.env.DB_USER,
        //         password: process.env.DB_PASSWORD,
        //         host: process.env.DB_SERVER,
        //         dialect: 'mssql',
        //         dialectOptions: {
        //             options: {
        //                 encrypt: false,
        //                 instanceName: 'sqlexpress',
        //                 trustServerCertificate: true
        //             }
        //         },
        //         logging: process.env.LOG_LEVEL === 'info' ? console.log : false
        //     }
        // };

        const dbConfig = {
            [dbName]: {
                username: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                host: process.env.DB_SERVER,
                dialect: 'mssql',
                dialectOptions: {
                    options: {
                        encrypt: false,
                        // instanceName: 'sqlexpress',
                        trustServerCertificate: true
                    }
                },
                logging: process.env.LOG_LEVEL === 'info' ? console.log : false
            }
        };


        // Create a new Sequelize instance for the provided database
        this.connections[dbName] = new Sequelize(
            dbName,  // Database name from environment
            dbConfig[dbName].username,
            dbConfig[dbName].password,
            dbConfig[dbName]
        );

        return this.connections[dbName];
    }

    // Test connection for a specific database
    async testConnection(dbName) {
        try {
            await this.createPool(dbName).authenticate();
            console.log(`Connection to ${dbName} established successfully.`);
        } catch (error) {
            console.error(`Unable to connect to ${dbName}:`, error);
        }
    }

    // Switch database dynamically based on the name
    getConnection(dbName) {
        console.log(dbName);
        return this.createPool(dbName);
    }
}

module.exports = new Database();
