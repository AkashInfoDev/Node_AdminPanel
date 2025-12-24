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

    generateDatabaseName(corporateID, companyID = '6001') {
        if (!corporateID || !companyID) {
            throw new Error("Both corporateID and companyID must be provided");
        }
        // Ensure values are strings and remove any extraneous whitespace
        const cleanCorporateID = corporateID.toString().trim();
        const cleanCompanyID = companyID.toString().trim();

        // Take the last 5 characters of the corporate ID. If the ID is shorter than 5, it returns the full string.
        const corporateIDLastFive = cleanCorporateID.slice(-5);

        // Format the company ID to be at least 4 digits long (pads with zeros on the left)
        const formattedCompanyID = cleanCompanyID.padStart(4, '0');

        // Construct the database name in the format "A{last5 of corporateID}CMP{companyID}"
        return `A${corporateIDLastFive}CMP${formattedCompanyID}`;
    };

    getQuery(fields, tableName, cWhere, orderBy, cExFld) {


        fields = fields || '*';
        cExFld = cExFld ? ` ,${cExFld}` : '';
        cWhere = cWhere ? ` WHERE ${cWhere}` : '';
        orderBy = orderBy ? ` ORDER BY ${orderBy}` : '';
      
        let query = `SELECT ${fields} ${cExFld} FROM ${tableName}${cWhere}${orderBy}`;
        return query;
      }
}

module.exports = new QueryService();
