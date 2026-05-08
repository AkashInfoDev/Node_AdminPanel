const querystring = require('querystring');
const db = require('../Config/config');
const Encryptor = require('../Services/encryptor');
const TokenService = require('../Services/tokenServices');

const sequelizeRDB = db.getConnection('RDB');
const sequelizeIDB = db.getConnection('IDBAPI');

const defineUserTypes = require('../Models/RDB/EP_USERTPYES');
const defineMenu = require('../Models/IDB/PLSYSM82');
const definePermission = require('../Models/IDB/PLSYSM83');
const UserTypes = defineUserTypes(sequelizeRDB, require('sequelize').DataTypes);
const Menu = defineMenu(sequelizeIDB, require('sequelize').DataTypes);
const Permission = definePermission(sequelizeIDB, require('sequelize').DataTypes);
const defineTicketPermission =
    require('../Models/RDB/EPTICKPER');

const TicketPermission =
    defineTicketPermission(
        sequelizeRDB,
        require('sequelize').DataTypes
    );

const encryptor = new Encryptor();

class UserTypeController {

    static cachedAdminRoles = null;

    static async checkAdminAccess(roleId) {

        if (!this.cachedAdminRoles) {
            const roles = await UserTypes.findAll({
                attributes: ['ID'],
                // 🔥 IMPORTANT: filter admin roles only
                // where: { Type: ['Admin'] }, // adjust if multiple admin roles
                raw: true
            });

            this.cachedAdminRoles = roles.map(r => Number(r.ID));
        }

        return this.cachedAdminRoles.includes(Number(roleId));
    }
    static async manageUserType(req, res) {

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

            // 🔥 Only Admin
            // if (![1, 2, 3, 4, 5].includes(roleId)) {
            //     response.status = 'FAIL';
            //     response.message = 'Access denied';
            //     return res.status(403).json({
            //         encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            //     });
            // }
            const isAdmin = await UserTypeController.checkAdminAccess(roleId);

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

            const { action, id, type } = pa;

            if (!action) {
                response.status = 'FAIL';
                response.message = 'Action is required';
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            switch (action) {

                case 'C':
                    return UserTypeController.createType(type, res);

                case 'G':
                    return UserTypeController.getTypes(res);

                case 'E':
                    return UserTypeController.updateType(id, type, res);

                case 'D':
                    return UserTypeController.deleteType(id, res);

                case 'GP': // Get Permissions (blank or by role)
                    return UserTypeController.getPermissions(pa.role_id, res);

                case 'SP': // Save Permissions (with role create/update)
                    return UserTypeController.savePermissions(pa, res);


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


    // static async getPermissions(roleId, res) {

    //     const menus = await Menu.findAll({
    //         order: [['M82F00', 'ASC']]
    //     });

    //     // No role → blank permissions
    //     if (!roleId) {
    //         const result = menus.map(m => ({
    //             menu_id: m.M82F00,
    //             menu_name: m.M82F01,
    //             add: 0,
    //             edit: 0,
    //             delete: 0,
    //             view: 0,

    //             // SELF
    //             view_self: 0,
    //         }));

    //         return res.json({
    //             encryptedResponse: encryptor.encrypt(JSON.stringify({
    //                 status: 'SUCCESS',
    //                 data: result
    //             }))
    //         });
    //     }

    //     // Role exists → fetch permissions
    //     const permissions = await Permission.findAll({
    //         where: { M83F02: roleId }
    //     });

    //     const map = {};
    //     permissions.forEach(p => {
    //         map[p.M83F08] = p;   // menu_id mapping
    //     });

    //     const result = menus.map(m => {
    //         const p = map[m.M82F00];

    //         return {
    //             menu_id: m.M82F00,
    //             menu_name: m.M82F01,
    //             add: p ? (p.M83F03 ? 1 : 0) : 0,
    //             edit: p ? (p.M83F04 ? 1 : 0) : 0,
    //             delete: p ? (p.M83F05 ? 1 : 0) : 0,
    //             view: p ? (p.M83F06 ? 1 : 0) : 0,

    //             // SELF ACCESS
    //             view_self: p ? (p.M83F09 ? 1 : 0) : 0,
    //         };
    //     });

    //     return res.json({
    //         encryptedResponse: encryptor.encrypt(JSON.stringify({
    //             status: 'SUCCESS',
    //             data: result
    //         }))
    //     });
    // }

    static async getPermissions(roleId, res) {

        const menus = await Menu.findAll({
            order: [['M82F00', 'ASC']]
        });

        /* =========================
           🎟️ TICKET PERMISSION
        ========================= */

        const ticketPermission = roleId
            ? await TicketPermission.findOne({
                where: {
                    TPER02: roleId
                },
                raw: true
            })
            : null;

        /* =========================
           ❌ NO ROLE
        ========================= */

        if (!roleId) {

            const result = menus.map(m => ({
                menu_id: m.M82F00,
                menu_name: m.M82F01,

                add: 0,
                edit: 0,
                delete: 0,
                view: 0,

                view_self: 0
            }));

            return res.json({
                encryptedResponse:
                    encryptor.encrypt(
                        JSON.stringify({
                            status: 'SUCCESS',
                            data: {

                                menu_permissions: result,

                                ticket_permissions: {

                                    scope: 'SELF',

                                    allowed_roles: [],

                                    create_ticket: 0,

                                    assign_ticket: 0,

                                    change_status: 0,

                                    delete_ticket: 0
                                }
                            }
                        })
                    )
            });
        }

        /* =========================
           📥 MENU PERMISSIONS
        ========================= */

        const permissions =
            await Permission.findAll({
                where: {
                    M83F02: roleId
                }
            });

        const map = {};

        permissions.forEach(p => {
            map[p.M83F08] = p;
        });

        const result = menus.map(m => {

            const p = map[m.M82F00];

            return {

                menu_id: m.M82F00,

                menu_name: m.M82F01,

                add: p ? (p.M83F03 ? 1 : 0) : 0,

                edit: p ? (p.M83F04 ? 1 : 0) : 0,

                delete: p ? (p.M83F05 ? 1 : 0) : 0,

                view: p ? (p.M83F06 ? 1 : 0) : 0,

                view_self:
                    p ? (p.M83F09 ? 1 : 0) : 0
            };
        });

        /* =========================
           🎟️ FINAL TICKET FORMAT
        ========================= */

        const formattedTicketPermission = {

            scope:
                ticketPermission?.TPER03 || 'SELF',

            allowed_roles:
                ticketPermission?.TPER04
                    ? ticketPermission.TPER04
                        .split(',')
                        .map(Number)
                    : [],

            create_ticket:
                ticketPermission?.TPER05 ? 1 : 0,

            assign_ticket:
                ticketPermission?.TPER06 ? 1 : 0,

            change_status:
                ticketPermission?.TPER07 ? 1 : 0,

            delete_ticket:
                ticketPermission?.TPER08 ? 1 : 0
        };

        return res.json({
            encryptedResponse:
                encryptor.encrypt(
                    JSON.stringify({
                        status: 'SUCCESS',

                        data: {

                            menu_permissions: result,

                            ticket_permissions:
                                formattedTicketPermission
                        }
                    })
                )
        });
    }

    //     static async savePermissions(pa, res) {

    //         let { id, type, data } = pa;

    //         // 🔹 Step 1: Create role if not exists
    //         let roleId = id;

    //         if (!roleId) {
    //             const newRole = await UserTypes.create({ Type: type });
    //             roleId = newRole.ID;
    //         } else {
    //             // optional: update role name
    //             if (type) {
    //                 await UserTypes.update(
    //                     { Type: type },
    //                     { where: { ID: roleId } }
    //                 );
    //             }
    //         }

    //         // const parsed = JSON.parse(data);
    //         const parsed = JSON.parse(
    //             decodeURIComponent(data)
    //         );

    //         const menuPermissions =
    //             parsed.menu_permissions || [];

    //         const ticketPermissions =
    //             parsed.ticket_permissions || {};

    //         // 🔹 Step 2: delete old permissions
    //         await Permission.destroy({
    //             where: { M83F02: roleId }
    //         });

    //         // 🔹 Step 3: insert new permissions
    //         // const insert = parsed.map(d => ({
    //         //     M83F08: d.menu_id,
    //         //     M83F02: roleId,
    //         //     M83F03: d.add,
    //         //     M83F04: d.edit,
    //         //     M83F05: d.delete,
    //         //     M83F06: d.view,
    //         //     // SELF ACCESS
    //         //     M83F09: d.view_self,
    //         // }));
    //         const insert = menuPermissions.map(d => ({
    //             M83F08: d.menu_id,
    //             M83F02: roleId,
    //             M83F03: d.add,
    //             M83F04: d.edit,
    //             M83F05: d.delete,
    //             M83F06: d.view,
    //             // SELF ACCESS
    //             M83F09: d.view_self,
    //         }));

    //         await Permission.bulkCreate(insert);
    //         /* =========================
    // 🎟️ SAVE TICKET PERMISSION
    // ========================= */
    //         console.log(
    //             'ticketPermissions =>',
    //             ticketPermissions
    //         );

    //         const ticketPayload = {

    //             TPER02: roleId,

    //             TPER03:
    //                 String(
    //                     ticketPermissions.scope || 'SELF'
    //                 ).toUpperCase(),

    //             TPER04:
    //                 Array.isArray(
    //                     ticketPermissions.allowed_roles
    //                 )
    //                     ? ticketPermissions.allowed_roles.join(',')
    //                     : null,

    //             TPER05:
    //                 Number(
    //                     ticketPermissions.create_ticket || 0
    //                 ),

    //             TPER06:
    //                 Number(
    //                     ticketPermissions.reply_ticket || 0
    //                 ),

    //             TPER07:
    //                 Number(
    //                     ticketPermissions.change_status || 0
    //                 ),

    //             TPER08:
    //                 Number(
    //                     ticketPermissions.delete_ticket || 0
    //                 )
    //         };
    //         const existingTicketPermission =
    //             await TicketPermission.findOne({
    //                 where: {
    //                     TPER02: roleId
    //                 }
    //             });

    //         if (existingTicketPermission) {

    //             await TicketPermission.update(
    //                 ticketPayload,
    //                 {
    //                     where: {
    //                         TPER02: roleId
    //                     }
    //                 }
    //             );

    //         } else {

    //             await TicketPermission.create(
    //                 ticketPayload
    //             );
    //         }

    //         return res.json({
    //             encryptedResponse: encryptor.encrypt(JSON.stringify({
    //                 status: 'SUCCESS',
    //                 message: 'Role & Permissions saved',
    //                 roleId
    //             }))
    //         });
    //     }
    static async savePermissions(pa, res) {

        let { id, type, data } = pa;

        /* =========================
           🔹 CREATE / UPDATE ROLE
        ========================= */

        let roleId = id;

        if (!roleId) {

            const newRole =
                await UserTypes.create({
                    Type: type
                });

            roleId = newRole.ID;

        } else {

            if (type) {

                await UserTypes.update(
                    { Type: type },
                    {
                        where: {
                            ID: roleId
                        }
                    }
                );
            }
        }

        /* =========================
           🔓 PARSE DATA
        ========================= */

        const parsed =
            JSON.parse(data);

        /* =========================
           🎟️ EXTRACT TICKET PERMISSION
        ========================= */

        // let ticketPermissions = {};

        // const menuPermissions =
        //     parsed.filter(item => {

        //         if (item.ticket_permissions) {

        //             ticketPermissions =
        //                 item.ticket_permissions;

        //             return false;
        //         }

        //         return true;
        //     });
        const menuPermissions =
            parsed.menu_permissions || [];

        const ticketPermissions =
            parsed.ticket_permissions || {};

        /* =========================
           🗑️ DELETE OLD MENU PERMISSION
        ========================= */

        await Permission.destroy({
            where: {
                M83F02: roleId
            }
        });

        /* =========================
           💾 INSERT MENU PERMISSION
        ========================= */

        const insert =
            menuPermissions.map(d => ({

                M83F08: d.menu_id,

                M83F02: roleId,

                M83F03: d.add,

                M83F04: d.edit,

                M83F05: d.delete,

                M83F06: d.view,

                M83F09: d.view_self || 0
            }));

        await Permission.bulkCreate(insert);

        /* =========================
           🎟️ SAVE TICKET PERMISSION
        ========================= */

        const ticketPayload = {

            TPER02: roleId,

            TPER03:
                String(
                    ticketPermissions.scope || 'SELF'
                ).toUpperCase(),

            TPER04:
                Array.isArray(
                    ticketPermissions.allowed_roles
                )
                    ? ticketPermissions.allowed_roles.join(',')
                    : null,

            TPER05:
                Number(
                    ticketPermissions.create_ticket || 0
                ),

            TPER06:
                Number(
                    ticketPermissions.assign_ticket || 0
                ),

            TPER07:
                Number(
                    ticketPermissions.change_status || 0
                ),

            TPER08:
                Number(
                    ticketPermissions.delete_ticket || 0
                )
        };

        const existingTicketPermission =
            await TicketPermission.findOne({
                where: {
                    TPER02: roleId
                }
            });

        if (existingTicketPermission) {

            await TicketPermission.update(
                ticketPayload,
                {
                    where: {
                        TPER02: roleId
                    }
                }
            );

        } else {

            await TicketPermission.create(
                ticketPayload
            );
        }

        /* =========================
           ✅ RESPONSE
        ========================= */

        return res.json({
            encryptedResponse:
                encryptor.encrypt(
                    JSON.stringify({
                        status: 'SUCCESS',
                        message:
                            'Role & Permissions saved',
                        roleId
                    })
                )
        });
    }
    /* =========================
       🟢 CREATE
    ========================= */
    static async createType(type, res) {

        if (!type) {
            return res.status(400).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: 'Type required'
                }))
            });
        }

        const newType = await UserTypes.create({ Type: type });

        return res.json({
            encryptedResponse: encryptor.encrypt(JSON.stringify({
                status: 'SUCCESS',
                message: 'User type created',
                data: newType
            }))
        });
    }

    /* =========================
       📥 GET
    ========================= */
    static async getTypes(res) {

        const types = await UserTypes.findAll({
            order: [['ID', 'ASC']]
        });

        return res.json({
            encryptedResponse: encryptor.encrypt(JSON.stringify({
                status: 'SUCCESS',
                data: types
            }))
        });
    }

    /* =========================
       ✏️ UPDATE
    ========================= */
    static async updateType(id, type, res) {

        if (!id || !type) {
            return res.status(400).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: 'id and type required'
                }))
            });
        }

        const updated = await UserTypes.update(
            { Type: type },
            { where: { ID: id } }
        );

        if (!updated[0]) {
            return res.status(404).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: 'Type not found'
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
    static async deleteType(id, res) {

        if (!id) {
            return res.status(400).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: 'id required'
                }))
            });
        }

        const deleted = await UserTypes.destroy({
            where: { ID: id }
        });

        if (!deleted) {
            return res.status(404).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: 'Type not found'
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
}

module.exports = UserTypeController;