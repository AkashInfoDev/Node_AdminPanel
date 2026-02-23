// CompanyService.js
const { QueryTypes } = require('sequelize');
const Encryptor = require('../Services/encryptor');

const encryptor = new Encryptor();
// const { evlStr, evlSTU, dtSeekFld } = require('./utils');
const F02Table = require('../PlusData/Class/MTableCls/F02Table'); // You need to implement similar functionality
const db = require('../Config/config'); // Your Database class
const { MApp } = require('../PlusData/commonClass/plusCommon');
const definePLSYSF02 = require('../Models/IDB/PLSYSF02');
const sequelizeIDB = db.getConnection('IDBAPI');

const PLSYSF02 = definePLSYSF02(sequelizeIDB);

class CompanyService {
  constructor({ year, oCmp, oEntDict, dbName, databaseName }) {
    this.year = year;
    this.oCmp = oCmp;
    this.oEntDict = oEntDict;
    this.dbName = dbName;
    this.databaseName = databaseName;
  }

  async getSetF02(lGet, dbName, cBeginID = '', langtpe) {
    // const sequelizeDynamic = db.getConnection(dbName);
    // const sequelize = db.sequelize;


    const dtF02 = await PLSYSF02.findAll({
      attributes: ['F02F01', 'F02F04', 'F02F07'],
      where: { F02F00: 'CCCC', F02F02: 'SCMP' },
      order: ['F02F16', 'F02F17']
    });

    if (lGet) {
      // GET: Load and populate oEntDict
      let dtCF02 = [];

      if (this.oCmp) {
        //let defYrno = await this.oCmp.oCon.query(`SELECT * FROM CMPCMM WHERE FIELD01 = '_CMPYEAR'`, { type: QueryTypes.SELECT });
        const f02Table = new F02Table('YR' + this.year, this.databaseName, langtpe);
        let table = f02Table.cTable
        dtCF02 = await this.oCmp.oCon.query(`SELECT * FROM ${table}`, { type: QueryTypes.SELECT });
        // dtCF02 = await f02Table.getList(); // Should return array of objects
      }

      for (const row of dtF02) {
        const cKey = MApp._evlSTU(row.F02F04);
        if (!cKey) continue;

        let cVal = '';
        if (dtCF02.length === 0) {
          cVal = MApp._evlStr(row.F02F07);
        } else {
          const field01 = MApp._evlSTU(row.F02F01);

          let filterStr;
          let fieldToFetch;

          if (field01 === 'SCMPA021') {
            filterStr = `FIELD01=${field01}`;
            fieldToFetch = 'FIELD13';
          } else {
            filterStr = `FIELD01=${field01}`;
            fieldToFetch = 'FIELD07';
          }
          
          cVal = MApp.DTSeekFld(dtCF02, filterStr, fieldToFetch);
        }
        this.oEntDict["M00"][cKey] = cVal;
      }
    } else {
      // SET: Save oEntDict back to DB

      // Populate extra fields
      const stateCode = MApp._evlSTU(this.oEntDict['M00']._STATE);
      const stcdRow = await sequelizeIDB.query(
        `SELECT PLSF06 FROM PLSTATE WHERE PLSF01 = :stateCode`,
        {
          type: QueryTypes.SELECT,
          replacements: { stateCode },
        }
      );

      this.oEntDict['M00']._STCD = stcdRow.length ? MApp._evlStr(stcdRow[0].PLSF06) : '';
      this.oEntDict['M00']._SYNCID = this.oEntDict['M00'].FIELD07 || '';
      this.oEntDict['M00']._BSYNCID = this.oEntDict['M00'].FIELD08 || '';

      const f02Table = new F02Table('YR' + new Date().getFullYear() % 100, this.databaseName, langtpe);
      await f02Table.getDictionary('', '', true, true);

      for (const row of dtF02) {
        const cKey = MApp._evlSTU(row.F02F04);
        if (!cKey) continue;

        const cID = MApp._evlSTU(row.F02F01);
        const dict = {
          FIELD01: cID,
          FIELD07: '',
          FIELD13: ''
        };

        if (cID === 'SCMPA021') {
          dict.FIELD13 = MApp._evlStr(this.oEntDict["M00"][cKey]);
        } else {
          dict.FIELD07 = MApp._evlStr(this.oEntDict["M00"][cKey]);
        }
        await f02Table.saveDataDict(dict, false, cBeginID, true, "FIELD01 = '" + cID + "'");
      }

      // f02Table.release();
      return false;
    }
  }
}


module.exports = CompanyService;
