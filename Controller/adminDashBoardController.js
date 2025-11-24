const querystring = require('querystring');
const db = require('../Config/config'); // Your Database class
const definePLSDBADMI = require('../Models/SDB/PLSDBADMI'); // Model factory
// const definePLSDBADMI = require('../Models/SDB/PLSDBADMI'); // Model factory
const definePLSDBM81 = require('../Models/SDB/PLSDBM81'); // Model factory
const definePLRDBA01 = require('../Models/RDB/PLRDBA01'); // Model factory
const definePLSDBBRC = require('../Models/SDB/PLSDBBRC');
const definePLRDBA02 = require('../Models/RDB/PLRDBA02');
const Encryptor = require('../Services/encryptor');
const sequelizeSDB = db.getConnection('A00001SDB');
const sequelizeRDB = db.getConnection('RDB');

// Initialize model using the Sequelize instance
const PLSDBADMI = definePLSDBADMI(sequelizeSDB);
const PLSDBM81 = definePLSDBM81(sequelizeSDB);
const PLSDBBRC = definePLSDBBRC(sequelizeSDB);
const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const PLRDBA02 = definePLRDBA02(sequelizeRDB);
const encryptor = new Encryptor();

class dashboardController {
    static async dashboardData(req, res) {
        let response = { data: null, status: 'SUCCESS', message: '' };
        let encryptedResponse;
        const parameterString = encryptor.decrypt(req.query.pa);
        let decodedParam = decodeURIComponent(parameterString);
        let pa = querystring.parse(decodedParam);
        let { corpId } = pa;
        if (!corpId) {
            response.message = 'Corporate Id is required'
            encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(400).json({ encryptedResponse });
        }
        let compDetail = await PLRDBA01.findOne({
            where: { A01F03: corpId }
        });
        let userDetails = await PLSDBADMI.findAll({
            where: { ADMICORP: compDetail.A01F01 }
        });
        let brcDetail = await PLSDBBRC.findAll({
            where: { BRCORP: compDetail.A01F01 }
        });
        let planDetail = await PLRDBA02.findOne({
            where: { A02F01: compDetail.A02F01 }
        });
        // let subDetail = await PLSDBM81.findAll({
        //     where: { M81F03: encryptor.decrypt(userDetails[0].ADMIF01) }
        // })
        response.data = { userDetails, compDetail, brcDetail, planDetail };
        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        return res.status(200).json({ encryptedResponse });
    }
}

module.exports = dashboardController;