const cron = require('node-cron');
const { Op, QueryTypes } = require('sequelize');
const db = require('../Config/config');
const definePLSDBCMP = require('../Models/SDB/PLSDBCMP');
const definePLSDBM82 = require('../Models/SDB/PLSDBM82');
const defineCRONLOGS = require('../Models/SDB/CRONLOGS');
const sequelizeA00001SDB = db.createPool('A00001SDB');
const sequelizeMASTER = db.createPool('MASTER');
const PLSDBCMP = definePLSDBCMP(sequelizeA00001SDB);
const PLSDBM82 = definePLSDBM82(sequelizeA00001SDB);
const CRONLOGS = defineCRONLOGS(sequelizeA00001SDB);
const { MApp } = require('../PlusData/commonClass/plusCommon');
const { generateDatabaseName } = require('./queryService');
const jwt = require('jsonwebtoken');
const TokenService = require('./tokenServices');

class cronJob {
  static async runCron(req, res) {
    // Extract token from the request headers
    let response = {
      data: null,
      status: 'SUCCESS',
      message: ''
    }
    let decoded;
    let token = req.headers['authorization']?.split(' ')[1]; // 'Bearer <token>'


    // Schedule the task to run every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
      try {
        if (!token) {
          response.message = 'No token provided, authorization denied.'
          response.status = 'FAIL'
          const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }))
          return res.status(401).json({ encryptedResponse });
        } else {
          decoded = await TokenService.validateToken(token, true);
        }
        // const token = req.headers['authorization']?.split(' ')[1]; // Assuming the format "Bearer <token>"

        if (!decoded) {
          cron.stop();
          return res.status(400).json({ message: 'Restart the CRON' });
        }

        const corpId = decoded.corpId;
        if (!corpId) {
          return res.status(400).json({ message: 'Invalid token: corpId is missing' });
        }
        // Step 1: Fetch all rows where M82ADA is 'D'
        let delRows = await PLSDBM82.findAll({
          where: { M82ADA: 'D' }
        });

        // Step 2: Process each row and collect necessary values
        let Uid = [];
        let Cid = [];
        for (let row of delRows) {
          Uid.push(row.M82F01);  // Store all Uid
          Cid.push(row.M82F02);  // Store all Cid
        }

        // Step 3: Query CMP table using IN operator for arrays of Uid and Cid
        let delcmpRows = await PLSDBCMP.findAll({
          where: {
            CMPF01: { [Op.in]: Uid },
            CMPF11: { [Op.in]: Cid }
          }
        });

        // Step 4: Process each delcmpRow and perform deletion
        for (let del of delcmpRows) {
          let todayDate = Date.now();
          let todaydateString = MApp.DTOS(todayDate);
          let count = parseInt(todaydateString) - parseInt(del.CMPDEL);

          // If count > 30, delete the associated database and records
          if (count > 30) {
            let createDBName = generateDatabaseName(decoded.corpId, del.CMPF01); // Use corpId from the decoded token
            let delDB = await sequelizeMASTER.query(`DROP DATABASE ${createDBName}`, { type: QueryTypes.RAW });

            if (delDB) {
              // Delete from PLSDBM82
              await PLSDBM82.destroy({
                where: {
                  M82F01: del.CMPF11,
                  M82F02: del.CMPF01
                }
              });
              // Delete from PLSDBCMP
              await PLSDBCMP.destroy({
                where: {
                  CMPF01: del.CMPF01,
                  CMPF11: del.CMPF11
                }
              });
              let allCronLogs = await CRONLOGS.findAll({
                where: {
                  CRONF02: decoded.corpId,
                  CRONF03: del.CMPF01
                }
              });
              if (allCronLogs) {
                for (const cl of allCronLogs) {
                  if (cl && cl.CRONF07 == 'Y') {
                    await CRONLOGS.update({
                      CRONF07: 'N'
                    }, {
                      where: { CRONF01: cl.CRONF01 }
                    })
                  } else {
                    await CRONLOGS.create({
                      CRONF02: decoded.corpId,
                      CRONF03: del.CMPF01,
                      CRONF04: del.CMPDEL,
                      CRONF05: todaydateString,
                      CRONF07: 'N'
                    });
                  }
                }
              }
            }
          }
        }
        console.log('Cron job is running every 15 minutes!');
      } catch (error) {
        console.error('Error running cron job:', error);
      }
    });

    // Respond with success message
    return res.status(200).json({ message: 'Cron job started successfully!' });
  }
}

module.exports = cronJob;