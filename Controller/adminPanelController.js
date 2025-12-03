
const Encryptor = require("../Services/encryptor");
const definePLSDBADMI = require('../Models/SDB/PLSDBADMI'); // Model factory
const { Op } = require("sequelize");

const sequelizeSDB = db.getConnection('A00001SDB');

const PLSDBADMI = definePLSDBADMI(sequelizeSDB);
const encryptor = new Encryptor();

class AdminPanel {
    static async getUsers() {
        const parameterString = encryptor.decrypt(req.query.pa);
        let decodedParam = decodeURIComponent(parameterString);
        let pa = querystring.parse(decodedParam);
        let UserInfo = await PLSDBADMI.findAll({
            where: {
                [Op.and]: [
                    { ADMICORP: { [Op.ne]: null } },
                    { ADMICORP: { [Op.ne]: '' } }
                ]
            }
        });
    }
}

module.exports = AdminPanel;