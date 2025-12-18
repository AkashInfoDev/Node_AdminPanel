const db = require('../Config/config');
const definePLSDBM82 = require('../Models/SDB/PLSDBM82');
const definePLSDBCMP = require('../Models/SDB/PLSDBCMP');
const sequelizeSDB = db.getConnection('A00001SDB');
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
        attributes: ['M82F01', 'M82F02', 'M82CMP'],
        where: {
          M82F01: this.uniqId,
          M82ADA: 'A'
        }
      })
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
              where: { CMPF01: GId }
            })
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
}

module.exports = AuthenticationService