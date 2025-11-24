const QueryService = require('../Services/queryService'); // Make sure path is lowercase: services

class DatabaseController {
    // Get all records from PLSYS01 in IDBAPI
    async getAllFromTable(req, res) {
        const dbName = 'IDBAPI';
        const tableName = 'PLSYS01';

        try {
            const query = QueryService.generateSelectQuery(tableName);
            const data = await QueryService.executeQuery(dbName, query);
            res.status(200).json(data);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    // Get records from PLSYS01 in IDBAPI with fixed conditions (optional extension)
    async getFromTableWithConditions(req, res) {
        const dbName = 'IDBAPI';
        const tableName = 'PLSYS01';

        // You can remove this if you don't need conditions anymore
        const { conditions } = req.body;

        try {
            const query = QueryService.generateSelectWithConditionsQuery(tableName, conditions || {});
            const data = await QueryService.executeQuery(dbName, query);
            res.status(200).json(data);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}

module.exports = new DatabaseController();
