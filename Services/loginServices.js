const db = require('../Config/config');
const definePLSDBM82 = require('../Models/SDB/PLSDBM82');
const definePLSDBCMP = require('../Models/SDB/PLSDBCMP');
const M82Controller = require('../Controller/M82Controller');
const CMPController = require('../Controller/CMPController');
const sequelizeSDB = db.getConnection('A00001SDB');

class AuthenticationService {
  constructor(corporateID, userUnq, sdbdbname) {
    this.corporateID = corporateID
    this.uniqId = userUnq
    this.sdbdb = sdbdbname
  }

  async authenticateUser() {
    try {
      let m82 = new M82Controller(this.sdbdb);
      let cmp = new CMPController(this.sdbdb);
      let resultM82 = await m82.findAll(
        {
          M82F01: this.uniqId,
          M82ADA: 'A'
        }, [],
        ['M82F01', 'M82F02', 'M82CMP'],
      )
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

        const resultCMP = await cmp.findAll(
          {}, [],
          ['CMPF01', 'CMPF02', 'CMPF04'],
        )
        for (const userData of userDataList) {
          const { GId, isDefault } = userData;

          try {

            if (resultCMP.length > 0) {
              for (const CmpRow of resultCMP) {
                const groupDetails = CmpRow;
                if (CmpRow.CMPF01 == GId) {
                  if (CompList.length > 0) {
                    const found = CompList.find(obj => obj.cmpNo === GId);
                    if (found) {
                      continue;
                    } else {
                      CompList.push({
                        cmpNo: groupDetails.CMPF01,
                        cmpName: groupDetails.CMPF02,
                        cmpGrp: groupDetails.CMPF04
                      });
                    }
                  } else {
                    CompList.push({
                      cmpNo: groupDetails.CMPF01,
                      cmpName: groupDetails.CMPF02,
                      cmpGrp: groupDetails.CMPF04
                    });
                  }

                  if (isDefault && !defaultCompany) {
                    defaultCompany = {
                      cmpNo: groupDetails.CMPF01,
                      cmpName: groupDetails.CMPF02,
                      cmpGrp: groupDetails.CMPF04
                    };
                  }
                }
              }
            } else {
              console.error(`No details found for Group ID: ${GId}`);
            }
            CompList.sort((a, b) => parseInt(a.cmpNo) - parseInt(b.cmpNo));

          } catch (err) {
            console.error(`Error fetching details for Group ID ${GId}:` + err.message);
          }
        }
      }

      return {
        DefComp: defaultCompany,
        CompList,
      };
    } catch (err) {
      console.error(err);
      return { success: false, message: 'Internal server error' };
    }
  }

  async loginCollision() {
    try {

    } catch (error) {

    }
  }
}

module.exports = AuthenticationService