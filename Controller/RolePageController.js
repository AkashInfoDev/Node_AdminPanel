const querystring = require('querystring');
const db = require('../Config/config');
const Encryptor = require('../Services/encryptor');
const TokenService = require('../Services/tokenServices');
const defineUserTypes = require('../Models/RDB/EP_USERTPYES');
const UserTypes = defineUserTypes(db.getConnection('RDB'), require('sequelize').DataTypes);
const sequelizeRDB = db.getConnection('IDBAPI');

const definePages = require('../Models/IDB/PLSYSM82');
// const definePLSTATE = require('../Models/IDB/PLSTATE');

// const definePages = require('../Models/IDB/PLSYSM821')
const Pages = definePages(sequelizeRDB, require('sequelize').DataTypes);

const encryptor = new Encryptor();

class RolePageController {
    static cachedAdminRoles = null;

    static async checkAdminAccess(roleId) {

        if (!this.cachedAdminRoles) {
            const roles = await UserTypes.findAll({
                attributes: ['ID'],
                // where: { Type: ['Admin'] }, // 🔥 adjust if needed
                raw: true
            });

            this.cachedAdminRoles = roles.map(r => Number(r.ID));
        }

        return this.cachedAdminRoles.includes(Number(roleId));
    }

    static async managePages(req, res) {

        let response = { status: 'SUCCESS', message: '', data: null };

        try {

            /* 🔐 TOKEN */
            const token = req.headers['authorization']?.split(' ')[1];

            if (!token) {
                response.status = 'FAIL';
                response.message = 'Authorization token missing';
                return res.status(401).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            const decoded = await TokenService.validateToken(token);
            const roleId = Number(decoded.roleId);

            // // 🔥 Only Admin
            // if (![1, 2, 3, 4, 5].includes(roleId)) {
            //     response.status = 'FAIL';
            //     response.message = 'Access denied';
            //     return res.status(403).json({
            //         encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            //     });
            // }
            const isAdmin = await RolePageController.checkAdminAccess(roleId);

            if (!isAdmin) {
                response.status = 'FAIL';
                response.message = 'Access denied';
                return res.status(403).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            /* 🔓 DECRYPT */
            if (!req.query.pa) {
                response.status = 'FAIL';
                response.message = 'Encrypted parameter missing';
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            const decrypted = encryptor.decrypt(req.query.pa);
            const pa = querystring.parse(decodeURIComponent(decrypted));

            const { action, id, name, roleid } = pa;

            if (!action) {
                response.status = 'FAIL';
                response.message = 'Action is required';
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            switch (action) {

                case 'C':
                    return RolePageController.createPage(name, roleid, res);

                case 'G':
                    return RolePageController.getMyPermissions(req, res);

                case 'E':
                    return RolePageController.updatePage(id, name, roleid, res);

                case 'D':
                    return RolePageController.deletePage(id, res);

                default:
                    response.status = 'FAIL';
                    response.message = 'Invalid action';
                    return res.status(400).json({
                        encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                    });
            }

        } catch (err) {
            console.error(err);

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: 'Server error'
                }))
            });
        }
    }

    static async getMyPermissions(req, res) {
        try {

            const token = req.headers['authorization']?.split(' ')[1];

            if (!token) {
                return res.status(401).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        status: 'FAIL',
                        message: 'Token missing'
                    }))
                });
            }

            const decoded = await TokenService.validateToken(token);
            const roleId = Number(decoded.roleId);

            /* =========================
               GET MENUS
            ========================= */
            const menus = await Pages.findAll({
                order: [['M82F00', 'ASC']]
            });

            /* =========================
               GET PERMISSIONS
            ========================= */
            const Permission = require('../Models/IDB/PLSYSM83')(
                sequelizeRDB,
                require('sequelize').DataTypes
            );

            const permissions = await Permission.findAll({
                where: { M83F02: roleId }
            });

            const map = {};
            permissions.forEach(p => {
                map[p.M83F08] = p;
            });

            /* =========================
               MERGE
            ========================= */
            const result = menus.map(m => {
                const p = map[m.M82F00];

                return {
                    menu_id: m.M82F00,
                    menu_name: m.M82F01,

                    add: p ? (p.M83F03 ? 1 : 0) : 0,
                    edit: p ? (p.M83F04 ? 1 : 0) : 0,
                    delete: p ? (p.M83F05 ? 1 : 0) : 0,
                    view: p ? (p.M83F06 ? 1 : 0) : 0
                };
            });

            return res.json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    roleId,
                    data: result
                }))
            });

        } catch (err) {
            console.error(err);

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: 'Server error'
                }))
            });
        }
    }
    /* =========================
       🟢 CREATE
    ========================= */
    static async createPage(name, roleid, res) {

        if (!name || !roleid) {
            return res.status(400).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: 'name and roleid required'
                }))
            });
        }

        const newPage = await Pages.create({
            M82F01: name,
            M82F02: roleid
        });

        return res.json({
            encryptedResponse: encryptor.encrypt(JSON.stringify({
                status: 'SUCCESS',
                message: 'Page created',
                data: newPage
            }))
        });
    }

    /* =========================
       📥 GET
    ========================= */
    static async getPages(res) {

        const pages = await Pages.findAll({
            order: [['M82F00', 'ASC']]
        });

        return res.json({
            encryptedResponse: encryptor.encrypt(JSON.stringify({
                status: 'SUCCESS',
                data: pages
            }))
        });
    }

    /* =========================
       ✏️ UPDATE
    ========================= */
    static async updatePage(id, name, roleid, res) {

        if (!id) {
            return res.status(400).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: 'id required'
                }))
            });
        }

        const updated = await Pages.update(
            {
                M82F01: name,
                M82F02: roleid
            },
            { where: { M82F00: id } }
        );

        if (!updated[0]) {
            return res.status(404).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: 'Page not found'
                }))
            });
        }

        return res.json({
            encryptedResponse: encryptor.encrypt(JSON.stringify({
                status: 'SUCCESS',
                message: 'Updated successfully'
            }))
        });
    }

    /* =========================
       ❌ DELETE
    ========================= */
    static async deletePage(id, res) {

        if (!id) {
            return res.status(400).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: 'id required'
                }))
            });
        }

        const deleted = await Pages.destroy({
            where: { M82F00: id }
        });

        if (!deleted) {
            return res.status(404).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: 'Page not found'
                }))
            });
        }

        return res.json({
            encryptedResponse: encryptor.encrypt(JSON.stringify({
                status: 'SUCCESS',
                message: 'Deleted successfully'
            }))
        });
    }

    /* =========================
       🔥 GET BY ROLE (IMPORTANT)
    ========================= */
    static async getPagesByRole(roleId, res) {

        const pages = await sequelizeRDB.query(`
            SELECT *
            FROM PLSYSM82
            WHERE ',' + M82F02 + ',' LIKE '%,' + :roleId + ',%'
        `, {
            replacements: { roleId: String(roleId) },
            type: sequelizeRDB.QueryTypes.SELECT
        });

        return res.json({
            encryptedResponse: encryptor.encrypt(JSON.stringify({
                status: 'SUCCESS',
                data: pages
            }))
        });
    }
}

module.exports = RolePageController;