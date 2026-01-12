const querystring = require('querystring');
const db = require('../Config/config'); // Your Database class
const definePLSDBADMI = require('../Models/SDB/PLSDBADMI'); // Model factory
// const definePLSDBADMI = require('../Models/SDB/PLSDBADMI'); // Model factory
const definePLSDBM81 = require('../Models/SDB/PLSDBM81'); // Model factory
const definePLRDBA01 = require('../Models/RDB/PLRDBA01'); // Model factory
const definePLSDBBRC = require('../Models/SDB/PLSDBBRC');
const definePLSDBCROLE = require('../Models/SDB/PLSDBCROLE');
const definePLRDBA02 = require('../Models/RDB/PLRDBA02');
const Encryptor = require('../Services/encryptor');
const TokenService = require('../Services/tokenServices');
const CROLEController = require('./CROLOEController');
const ADMIController = require('./ADMIController');
const BRCController = require('./BRCController');
const sequelizeSDB = db.getConnection('A00001SDB');
const sequelizeRDB = db.getConnection('RDB');

// Initialize model using the Sequelize instance
const PLSDBADMI = definePLSDBADMI(sequelizeSDB);
const PLSDBM81 = definePLSDBM81(sequelizeSDB);
const PLSDBCROLE = definePLSDBCROLE(sequelizeSDB);
const PLSDBBRC = definePLSDBBRC(sequelizeSDB);
const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const PLRDBA02 = definePLRDBA02(sequelizeRDB);
const encryptor = new Encryptor();

class dashboardController {
    static async dashboardData(req, res) {
        let response = { data: null, status: 'SUCCESS', message: '' };
        let encryptedResponse;
        // const parameterString = encryptor.decrypt(req.query.pa);
        // let decodedParam = decodeURIComponent(parameterString);
        // let pa = querystring.parse(decodedParam);
        // let { corpId } = pa;

        const token = req.headers['authorization']?.split(' ')[1]; // 'Bearer <token>'

        if (!token) {
            response.message = 'No token provided, authorization denied.'
            response.status = 'FAIL'
            const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(401).json({ encryptedResponse });
        }
        let decoded = await TokenService.validateToken(token);
        let sdbSeq = (decoded.corpId).split('-');
        let sdbdbname = sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB';
        let tblbrc = new BRCController(sdbdbname);
        let crole = new CROLEController(sdbdbname);
        let admi = new ADMIController(sdbdbname);
        let corpId = decoded.corpId
        if (!corpId) {
            response.message = 'Corporate Id is required'
            encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(400).json({ encryptedResponse });
        }
        let compDetail = await PLRDBA01.findOne({
            where: { A01F03: corpId }
        });
        let userDetails = await admi.findAll({
            ADMICORP: compDetail.A01F01.trim()
        });
        let brcDetail = await tblbrc.findAll({
            BRCORP: (compDetail.A01F01).trim()
        });
        let planDetail = await PLRDBA02.findOne({
            where: { A02F01: compDetail.A02F01 }
        });

        for (let user of userDetails) {
            if (user.ADMIF06 != '2') {
                let cusRole = await crole.findOne({
                        CROLF02: user.ADMICORP,
                        CROLF00: user.ADMIROL
                    }
                );
                if (cusRole) {
                    user.dataValues.ROLENM = cusRole.CROLF01
                    user.dataValues.CROLF00 = cusRole.CROLF00
                    delete user.dataValues.ADMIROL
                }
            }
        }
        // let subDetail = await PLSDBM81.findAll({
        //     where: { M81F03: encryptor.decrypt(userDetails[0].ADMIF01) }
        // })
        response.data = { userDetails, compDetail, brcDetail, planDetail };
        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        return res.status(200).json({ encryptedResponse });
    }
}

module.exports = dashboardController;