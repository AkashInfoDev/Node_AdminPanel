const cron = require('node-cron');
const { Op, QueryTypes } = require('sequelize');
const db = require('../Config/config');
const { generateDatabaseName } = require('./queryService');
const defineCRONLOGS = require('../Models/SDB/CRONLOGS');
const definePLRDBA01 = require('../Models/RDB/PLRDBA01');
const ADMIController = require('../Controller/ADMIController');
const M81Controller = require('../Controller/M81Controller');
const CMPController = require('../Controller/CMPController');
const M82Controller = require('../Controller/M82Controller');
const sequelizeA00001SDB = db.createPool('A00001SDB');
const sequelizeRDB = db.createPool('RDB');
const sequelizeMASTER = db.createPool('MASTER');
const CRONLOGS = defineCRONLOGS(sequelizeA00001SDB);
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
                            let sdbSeq = (log.CRONF02).split('-');
                            let sdbdbname = sdbSeq.length == 3 ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB' : sdbSeq[0] + sdbSeq[1] + 'SDB';
                            let admi = new ADMIController(sdbdbname);
                            let m81 = new M81Controller(sdbdbname);
                            let cmp = new CMPController(sdbdbname);
                            let m82 = new M82Controller(sdbdbname);

                            let ADMI = await admi.findOne({
                                ADMICORP: A01.A01F01,
                                ADMIF06: 2
                            });
                            let M81 = await m81.findOne({
                                M81CHLD: ADMI.ADMIF00
                            });
                            const databaseName = generateDatabaseName(log.CRONF02, log.CRONF03);

                            // Step 5: Delete related rows from PLSDBCMP and PLSDBM82
                            await cmp.destroy({
                                CMPF01: log.CRONF03, CMPF11: M81.M81F01
                            });

                            await m82.destroy({
                                M82F01: M81.M81F01, M82F02: log.CRONF03
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
            } catch (error) {
                console.error('Error executing cron job:', error);
            }
        });
    }
}

module.exports = cronJob;
