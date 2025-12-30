const cron = require('node-cron');
const { Op, QueryTypes } = require('sequelize');
const db = require('../Config/config');
const { generateDatabaseName } = require('./queryService');
const definePLSDBCMP = require('../Models/SDB/PLSDBCMP');
const definePLSDBM82 = require('../Models/SDB/PLSDBM82');
const definePLSDBM81 = require('../Models/SDB/PLSDBM81');
const defineCRONLOGS = require('../Models/SDB/CRONLOGS');
const definePLSDBADMI = require('../Models/SDB/PLSDBADMI');
const definePLRDBA01 = require('../Models/RDB/PLRDBA01');
const sequelizeA00001SDB = db.createPool('A00001SDB');
const sequelizeRDB = db.createPool('RDB');
const sequelizeMASTER = db.createPool('MASTER');
const PLSDBCMP = definePLSDBCMP(sequelizeA00001SDB);
const PLSDBM82 = definePLSDBM82(sequelizeA00001SDB);
const PLSDBM81 = definePLSDBM81(sequelizeA00001SDB);
const CRONLOGS = defineCRONLOGS(sequelizeA00001SDB);
const PLSDBADMI = definePLSDBADMI(sequelizeA00001SDB);
const PLRDBA01 = definePLRDBA01(sequelizeRDB);

class cronJob {
    // Function to calculate the difference in days
    getDateDifference(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diffTime = Math.abs(end - start);
        return Math.floor(diffTime / (1000 * 60 * 60 * 24)); // difference in days
    }

    // Cron job running every 15 minutes
    static async runCronJob() {
        cron.schedule('*/15 * * * *', async () => {
            try {
                // Step 1: Get current date in 'YYYYMMDD' format
                const currentDate = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // '20251226'

                // Step 2: Query CRONLOGS table for rows where CRONF04 is not null
                const cronLogs = await CRONLOGS.findAll({
                    where: {
                        CRONF04: {
                            [Op.ne]: null,
                        }
                    }
                });

                // Step 3: Loop through CRONLOGS rows
                if (cronLogs) {
                    for (const log of cronLogs) {
                        const cronDateStr = log.CRONF04;

                        // Step 4: Calculate date difference (if more than 30 days, proceed)
                        const dateDiff = this.getDateDifference(cronDateStr, currentDate);

                        if (dateDiff > 30) {
                            let A01 = await PLRDBA01.findOne({
                                where: {
                                    A01F03: log.CRONF02
                                }
                            });
                            let ADMI = await PLSDBADMI.findOne({
                                where: {
                                    ADMICORP: A01.A01F01,
                                    ADMIF06: '2'
                                }
                            });
                            let M81 = await PLSDBM81.findOne({
                                where: { M81CHLD: ADMI.ADMIF00 }
                            });
                            const databaseName = generateDatabaseName(log.CRONF02, log.CRONF03);

                            // Step 5: Delete related rows from PLSDBCMP and PLSDBM82
                            await PLSDBCMP.destroy({
                                where: { CMPF01: log.CRONF03, CMPF11: M81.M81F01 }
                            });

                            await PLSDBM82.destroy({
                                where: { M82F01: M81.M81F01, M82F02: log.CRONF03 }
                            });

                            // Step 6: Delete the database itself
                            await sequelizeMASTER.query(`DROP DATABASE IF EXISTS ${databaseName}`, { type: QueryTypes.RAW });

                            // Step 7: Update CRONLOGS table (set CRONF07 to 'N')
                            await CRONLOGS.update(
                                { CRONF07: 'N' },
                                { where: { id: log.CRONF01 } }
                            );
                        }
                    }
                }
                console.log('Cron job completed successfully.');

            } catch (error) {
                console.error('Error executing cron job:', error);
            }
        });
    }
}

module.exports = cronJob;
