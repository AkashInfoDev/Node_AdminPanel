const { QueryTypes } = require('sequelize');
const db = require('../Config/config'); // your Database instance
class DbCloneService {

  /**
   * Clone a database by calling the stored procedure with dynamic parameters
   * @param {string} sourceDB - Name of the source database
   * @param {string} targetDB - Name of the target database to be created
   * @param {string} replaceSuffix - Suffix to replace 'YR25' in table names
   * @param {string} startDate - Suffix to replace 'YR25' in table names
   * @param {string} endDate - Suffix to replace 'YR25' in table names
   */
  async cloneDatabase(sourceDB, targetDB, replaceSuffix, startDate, endDate) {
    const sequelize = db.getConnection('MASTER'); // Connect to 'master' DB

    const sql = `
      EXEC dbo.CloneDatabase 
      @SourceDB = ${sourceDB},
      @TargetDB = ${targetDB},
      @ReplaceSuffix = ${replaceSuffix},
      @StartDate = ${startDate},
      @EndDate = ${endDate}
    `;

    console.log('Executing SQL:', sql);

    try {
      // Note: NO transaction wrapping here!
      await sequelize.query(sql);
      console.log(`Database cloned from '${sourceDB}' to '${targetDB}' successfully.`);
    } catch (error) {
      console.error('Error executing CloneDatabase stored procedure:', error);
      throw error;
    }
  }
  async usrSDB(targetDB) {
    const sequelize = db.getConnection('MASTER'); // Connect to 'master' DB

    const sql = `
      EXEC dbo.usrSDB
      @NewDatabaseName = ${targetDB};
    `;

    console.log('Executing SQL:', sql);

    try {
      // Note: NO transaction wrapping here!
      await sequelize.query(sql);
    } catch (error) {
      await sequelize.query(`DROP DATABASE ${targetDB}`, { type: QueryTypes.RAW })
      console.error('Error executing CloneDatabase stored procedure:', error);
      throw error;
    }
  }
}

module.exports = new DbCloneService();
