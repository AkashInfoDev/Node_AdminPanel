const dbConfig = require('../Config/config');

class QueryService {
    constructor() {
        this.connections = dbConfig.connections;
    }

    // Execute query on a specified database
    async executeQuery(dbName, query) {
        try {
            const sequelize = dbConfig.getConnection(dbName);  // Get the connection for the specific database
            const result = await sequelize.query(query);
            return result[0];  // Sequelize returns an array with result and metadata
        } catch (error) {
            console.error(`Error executing query on ${dbName}:`, error);
            throw new Error(`Query execution failed on ${dbName}`);
        }
    }

    // Generate a simple SELECT query
    generateSelectQuery(tableName) {
        return `SELECT * FROM ${tableName}`;
    }

    // Generate a SELECT query with conditions
    generateSelectWithConditionsQuery(tableName, conditions) {
        let whereClause = '';
        if (conditions && Object.keys(conditions).length > 0) {
            whereClause = 'WHERE ' + Object.keys(conditions)
                .map(key => `${key} = '${conditions[key]}'`)
                .join(' AND ');
        }
        return `SELECT * FROM ${tableName} ${whereClause}`;
    }
}

module.exports = new QueryService();
