const { Sequelize, QueryTypes } = require('sequelize');
const { createPool } = require('../Config/config');

class DBQuery {
  constructor() {
    this.sequelize = createPool(); // Create the Sequelize instance
  }

  // Helper method to execute a SQL query
  async executeQuery(query, replacements = {}) {
    try {
      const result = await this.sequelize.query(query, {
        replacements,
        type: QueryTypes.SELECT // Default to SELECT
      });
      return result;
    } catch (error) {
      console.error('Error executing query:', error);
      throw error; // Throw the error to be handled by the controller
    }
  }

  // Method to build and execute SELECT queries
  async select(tableName, columns = ['*'], conditions = '') {
    let query = `SELECT ${columns.join(', ')} FROM ${tableName}`;
    if (conditions) {
      query += ` WHERE ${conditions}`;
    }
    return this.executeQuery(query);
  }

  // Method to build and execute INSERT queries
  async insert(tableName, data) {
    const columns = Object.keys(data).join(', ');
    const values = Object.values(data);
    const placeholders = values.map(() => '?').join(', ');

    const query = `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`;
    return this.executeQuery(query, values);
  }

  // Method to build and execute UPDATE queries
  async update(tableName, data, conditions) {
    const setClause = Object.keys(data)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = Object.values(data);

    const query = `UPDATE ${tableName} SET ${setClause} WHERE ${conditions}`;
    return this.executeQuery(query, [...values]);
  }

  // Method to build and execute DELETE queries
  async delete(tableName, conditions) {
    const query = `DELETE FROM ${tableName} WHERE ${conditions}`;
    return this.executeQuery(query);
  }
}

module.exports = DBQuery;
