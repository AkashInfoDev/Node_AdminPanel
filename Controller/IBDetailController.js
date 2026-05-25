const db = require('../Config/config');
const definePermission = require('../Models/IDB/PLSYSM83');
const defineEP_USER = require('../Models/RDB/EP_USER');
const { Op } = require('sequelize');

// DB connections
const sequelizeIDB = db.getConnection('IDBAPI');
const sequelizeRDB = db.getConnection('RDB');

// Models
const Permission = definePermission(sequelizeIDB, require('sequelize').DataTypes);
const TokenService = require('../Services/tokenServices');
const Encryptor = require('../Services/encryptor');

const EP_USER = defineEP_USER(sequelizeRDB);
const encryptor = new Encryptor();

class IBDetailController {

    static async getIBDetail(req, res) {
        try {

            const token = req.headers['authorization']?.split(' ')[1];

            if (!token) {
                return res.status(401).json({ message: 'Token missing' });
            }

            const decoded = await TokenService.validateToken(token);
            let userIdFromToken;

            try {
                userIdFromToken = encryptor.decrypt(decoded.userId);
            } catch {
                userIdFromToken = decoded.userId;
            }

            /* =========================
               👤 FIND USER FROM DB
            ========================= */

            const users = await EP_USER.findAll({
                where: { UTF07: 'N' }
            });

            let user = null;

            for (let u of users) {
                let decryptedId;

                try {
                    decryptedId = encryptor.decrypt(u.UTF04);
                } catch {
                    decryptedId = u.UTF04;
                }

                if (decryptedId === userIdFromToken) {
                    user = u;
                    break;
                }
            }

            if (!user) {
                return res.status(400).json({ message: 'User not found' });
            }

            const roleId = Number(user.UTF03);
            const MENU_ID = 2;

            /* =========================
               🔥 PERMISSION
            ========================= */

            const permission = await Permission.findOne({
                where: {
                    M83F02: roleId,
                    M83F08: MENU_ID
                },
                raw: true
            });

            const isAll = Number(permission?.M83F09) === 1;

            let ibDetail;

            if (isAll) {
                const allUsers = await EP_USER.findAll({
                    where: {
                        UTF07: 'N',
                        UTF03: { [Op.in]: [3, 4] }
                    },
                    raw: true
                });

                ibDetail = [
                    {
                        id: user.UTF01,
                        name: user.UTF02,
                        role: roleId
                    },
                    ...allUsers.map(u => ({
                        id: u.UTF01,
                        name: u.UTF02,
                        role: Number(u.UTF03)
                    }))
                ];

            } else {
                ibDetail = [{
                    id: user.UTF01,
                    name: user.UTF02,
                    role: roleId
                }];
            }

            const response = {
                status: 'SUCCESS',
                message: 'IB Detail fetched successfully',
                data: { ibDetail }
            };

            const encryptedResponse = encryptor.encrypt(JSON.stringify({ response }));

            return res.status(200).json({ encryptedResponse });

        } catch (err) {
            console.error(err);
            return res.status(500).json({ message: 'Error' });
        }
    }
}

module.exports = IBDetailController;