// const db = require('../Config/config'); // your Database instance

// class DbCloneService {
//   async createCloneProcedure() {
//     const sequelize = db.getConnection('MASTER');

//     const createProcSQL = `EXEC CloneDatabase 'A00001CMP0031', 'DEMOCLONE2', 'YR29'`;

//     // try {
//     //   await sequelize.query(createProcSQL);
//     //   console.log('Stored procedure dbo.CloneDatabase executed successfully.');
//     // } catch (error) {
//     //   console.error('Error executing stored procedure:', error);
//     //   throw error;
//     // }
//   }

//   /**
//    * Clone a database by calling the stored procedure with dynamic parameters
//    * @param {string} sourceDB - Name of the source database
//    * @param {string} targetDB - Name of the target database to be created
//    * @param {string} replaceSuffix - Suffix to replace 'YR25' in table names
//    */
//   async cloneDatabase(sourceDB, targetDB, replaceSuffix) {
//     const sequelize = db.getConnection('MASTER'); // Should connect to 'master' to execute clone

//     const t = await sequelize.transaction();

//     try {
//       const sql = `
//   EXEC dbo.CloneDatabase 
//     @SourceDB = '${sourceDB}', 
//     @TargetDB = '${targetDB}', 
//     @ReplaceSuffix = '${replaceSuffix}'`;

//       console.log('Executing SQL:', sql);

//       await sequelize.query(sql, { transaction: t });


//       await t.commit();
//       console.log(`Database cloned from '${sourceDB}' to '${targetDB}' successfully.`);
//     } catch (error) {
//       await t.rollback();
//       console.error('Transaction rolled back due to error:', error);
//       throw error;
//     }
//   }
// }

// module.exports = new DbCloneService();


const db = require('../Config/config'); // your Database instance

class DbCloneService {
  async createCloneProcedure() {
    const sequelize = db.getConnection('MASTER');

    const createProcSQL = `EXEC CloneDatabase 'A00001CMP0031', 'DEMOCLONE2', 'YR29'`;

    // Uncomment if you want to test running the procedure here
    // try {
    //   await sequelize.query(createProcSQL);
    //   console.log('Stored procedure dbo.CloneDatabase executed successfully.');
    // } catch (error) {
    //   console.error('Error executing stored procedure:', error);
    //   throw error;
    // }
  }

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
}

module.exports = new DbCloneService();
