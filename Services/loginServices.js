const db = require('../Config/config');
const definePLRDBA01 = require('../Models/RDB/PLRDBA01');
const definePLSDBM82 = require('../Models/SDB/PLSDBM82');
const definePLSDBCMP = require('../Models/SDB/PLSDBCMP');
const sequelizeRDB = db.getConnection('RDB');
const sequelizeSDB = db.getConnection('A00001SDB');
const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const PLSDBM82 = definePLSDBM82(sequelizeSDB);
const PLSDBCMP = definePLSDBCMP(sequelizeSDB);

class AuthenticationService {
    constructor(corporateID, userUnq) {
        this.corporateID = corporateID
        this.uniqId = userUnq
    }
  
    async authenticateUser() {
      try {
         
        let resultM82 = await PLSDBM82.findAll({
            attributes:['M82F01', 'M82F02', 'M82CMP'],
            where: {M82F01 : this.uniqId}
        }) 
        // this.poolA00001SDB.request()
        //   .input('userId', sql.VarChar, user.M81F01)
        //   .query('SELECT M82F01, M82F02, M82CMP FROM PLSDBM82 WHERE M82F01 = @userId');
  
        let defaultCompany = null;
        const CompList = [];
  
        if (resultM82.length === 0) {
          console.error('No user-company relationships found.');
        } else {
          const userDataList = resultM82.map(record => ({
            UId: record.M82F01,
            GId: record.M82F02,
            isDefault: record.M82CMP === 'Y'
          }));
  
          for (const userData of userDataList) {
            const { GId, isDefault } = userData;
  
            try {
              const resultCMP = await PLSDBCMP.findAll({
                attributes: ['CMPF01', 'CMPF02', 'CMPF04'],
                where: {CMPF01 : GId}
              })
            //    this.poolA00001SDB.request()
            //     .input('GId', sql.Int, GId)
            //     .query('SELECT CMPF01, CMPF02, CMPF04 FROM PLSDBCMP WHERE CMPF01 = @GId');
  
              if (resultCMP.length > 0) {
                const groupDetails = resultCMP[0];
  
                if (isDefault && !defaultCompany) {
                  defaultCompany = {
                    cmpNo: groupDetails.CMPF01,
                    cmpName: groupDetails.CMPF02,
                    cmpGrp: groupDetails.CMPF04
                  };
                }
  
                CompList.push({
                  cmpNo: groupDetails.CMPF01,
                  cmpName: groupDetails.CMPF02,
                  cmpGrp: groupDetails.CMPF04
                });
  
                CompList.sort((a, b) => Number(a.CmpNo) - Number(b.CmpNo));
              } else {
                console.error(`No details found for Group ID: ${GId}`);
              }
            } catch (err) {
              console.error(`Error fetching details for Group ID ${GId}:` + err.message);
            }
          }
        }
  
        return {
        //   CustId: corporateID,
        //   CustomerName: customerName,
        //   SubSDate,
        //   SubEDate,
        //   SoftVer,
        //   UserId: user.M81F01,
        //   UserNm: user.M81F02,
        //   DefComp: defaultCompany,
          CompList,
          // success: true,
          // message: 'Login successful',
        //   token: generatedToken
        };
        // return {
        //   CustId: corporateID,
        //   CustomerName: customerName,
        //   SubSDate,
        //   SubEDate,
        //   SoftVer,
        //   UserId: user.M81F01,
        //   UserNm: user.M81F02,
        //   DefComp: defaultCompany,
        //   CompList,
        //   success: true,
        //   message: 'Login successful',
        //   token: generatedToken
        // };
  
      } catch (err) {
        console.error(err);
        return { success: false, message: 'Internal server error' };
      }
    }
  }
  
  module.exports = AuthenticationService
  // Usage:
  // const authService = new AuthenticationService(poolIDBAPI, poolA00001SDB, generateToken, logger);
  // authService.authenticateUser(corporateID, username, password, YrNo);
  