const db = require('../Config/config'); // Import your connection function

class DatabaseTransaction {
  constructor(dbName) {
    this.dbName = dbName; // Store the database name
    this.dbConn = null; // Initialize dbConn as null
    this.transaction = null; // Initialize transaction as null
  }

  // Start a new transaction for the specified database connection
  async begin() {
    // Get the database connection using the dbName
    this.dbConn = db.getConnection(this.dbName);

    if (!this.dbConn) {
      throw new Error(`Failed to get connection for database: ${this.dbName}`);
    }

    // Start a new transaction
    this.transaction = await this.dbConn.transaction();
    console.log(`Transaction started for database: ${this.dbName}`);
  }

  // Commit the transaction
  async commit() {
    if (this.transaction) {
      await this.transaction.commit();
      console.log(`Transaction committed for database: ${this.dbName}`);
    } else {
      console.error('No active transaction to commit.');
    }
  }

  // Rollback the transaction
  async rollback() {
    if (this.transaction) {
      await this.transaction.rollback();
      console.log(`Transaction rolled back for database: ${this.dbName}`);
    } else {
      console.error('No active transaction to rollback.');
    }
  }

  // Optionally, you can expose the transaction for external use (in case you need it outside this class)
  getTransaction() {
    return this.transaction;
  }
}

module.exports = DatabaseTransaction;
