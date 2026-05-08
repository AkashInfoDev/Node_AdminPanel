const querystring = require('querystring');

const db = require('../Config/config');
const Encryptor = require('../Services/encryptor');
const TokenService = require('../Services/tokenServices');

const sequelizeRDB = db.getConnection('RDB');

const defineTicketPermission =
    require('../Models/RDB/EPTICKPER');

const TicketPermission =
    defineTicketPermission(
        sequelizeRDB,
        require('sequelize').DataTypes
    );

const encryptor = new Encryptor();

class TicketPermissionController {

    /* =====================================================
       🎯 MAIN CONTROLLER
    ===================================================== */

    static async managePermission(req, res) {

        let response = {
            status: 'SUCCESS',
            message: '',
            data: null
        };

        try {

            /* =========================
               🔐 TOKEN
            ========================= */

            const token =
                req.headers['authorization']
                    ?.split(' ')[1];

            if (!token) {

                response.status = 'FAIL';
                response.message =
                    'Authorization token missing';

                return res.status(401).json({
                    encryptedResponse:
                        encryptor.encrypt(
                            JSON.stringify(response)
                        )
                });
            }

            const decoded =
                await TokenService.validateToken(token);

            const roleId =
                Number(decoded.roleId);

            /* =========================
               🔒 ADMIN ONLY
            ========================= */

            if (roleId !== 1) {

                response.status = 'FAIL';
                response.message = 'Access denied';

                return res.status(403).json({
                    encryptedResponse:
                        encryptor.encrypt(
                            JSON.stringify(response)
                        )
                });
            }

            /* =========================
               🔓 DECRYPT PARAM
            ========================= */

            if (!req.query.pa) {

                response.status = 'FAIL';
                response.message =
                    'Encrypted parameter missing';

                return res.status(400).json({
                    encryptedResponse:
                        encryptor.encrypt(
                            JSON.stringify(response)
                        )
                });
            }

            const decrypted =
                encryptor.decrypt(req.query.pa);

            const pa =
                querystring.parse(
                    decodeURIComponent(decrypted)
                );

            const { action } = pa;

            if (!action) {

                response.status = 'FAIL';
                response.message =
                    'Action is required';

                return res.status(400).json({
                    encryptedResponse:
                        encryptor.encrypt(
                            JSON.stringify(response)
                        )
                });
            }

            /* =========================
               🎯 ACTION SWITCH
            ========================= */

            switch (action) {

                /* =========================
                   📥 GET PERMISSION
                ========================= */

                case 'G':

                    return TicketPermissionController
                        .getPermission(
                            pa.role_id,
                            res
                        );

                /* =========================
                   💾 SAVE PERMISSION
                ========================= */

                case 'S':

                    return TicketPermissionController
                        .savePermission(
                            pa,
                            res
                        );

                default:

                    response.status = 'FAIL';
                    response.message =
                        'Invalid action';

                    return res.status(400).json({
                        encryptedResponse:
                            encryptor.encrypt(
                                JSON.stringify(response)
                            )
                    });
            }

        } catch (err) {

            console.error(err);

            return res.status(500).json({
                encryptedResponse:
                    encryptor.encrypt(
                        JSON.stringify({
                            status: 'FAIL',
                            message:
                                err.message ||
                                'Server error'
                        })
                    )
            });
        }
    }

    /* =====================================================
       📥 GET PERMISSION
    ===================================================== */

    static async getPermission(roleId, res) {

        if (!roleId) {

            return res.status(400).json({
                encryptedResponse:
                    encryptor.encrypt(
                        JSON.stringify({
                            status: 'FAIL',
                            message: 'role_id required'
                        })
                    )
            });
        }

        const permission =
            await TicketPermission.findOne({
                where: {
                    TPER02: Number(roleId)
                },
                raw: true
            });

        /* =========================
           ❌ NOT FOUND
        ========================= */

        if (!permission) {

            return res.json({
                encryptedResponse:
                    encryptor.encrypt(
                        JSON.stringify({
                            status: 'SUCCESS',
                            data: null
                        })
                    )
            });
        }

        /* =========================
           🎯 SCOPE LABEL
        ========================= */

        let scopeLabel = '';

        switch (permission.TPER03) {

            case 'ALL':
                scopeLabel = 'All Tickets';
                break;

            case 'SELF':
                scopeLabel = 'Own Tickets';
                break;

            case 'CUSTOM':
                scopeLabel = 'Selected Roles';
                break;

            default:
                scopeLabel = permission.TPER03;
        }

        /* =========================
           🔥 FORMAT RESPONSE
        ========================= */

        const formatted = {

            role_id: permission.TPER02,

            scope: permission.TPER03,

            scope_label: scopeLabel,

            allowed_roles:
                permission.TPER04
                    ? permission.TPER04
                        .split(',')
                        .map(Number)
                    : [],

            permissions: {

                create_ticket:
                    Boolean(permission.TPER05),

                reply_ticket:
                    Boolean(permission.TPER06),

                change_status:
                    Boolean(permission.TPER07),

                delete_ticket:
                    Boolean(permission.TPER08)
            }
        };

        return res.json({
            encryptedResponse:
                encryptor.encrypt(
                    JSON.stringify({
                        status: 'SUCCESS',
                        data: formatted
                    })
                )
        });
    }

    /* =====================================================
       💾 SAVE PERMISSION
    ===================================================== */

    static async savePermission(pa, res) {

        const roleId =
            Number(pa.role_id);

        if (!roleId) {
            throw new Error(
                'role_id required'
            );
        }

        /* =========================
           🎯 VALIDATE SCOPE
        ========================= */

        const validScopes = [
            'SELF',
            'ALL',
            'CUSTOM'
        ];

        const scope =
            String(
                pa.scope || 'SELF'
            ).toUpperCase();

        if (!validScopes.includes(scope)) {
            throw new Error(
                'Invalid scope'
            );
        }

        /* =========================
           🔥 CUSTOM VALIDATION
        ========================= */

        let allowedRoles = null;

        if (scope === 'CUSTOM') {

            if (!pa.allowed_roles) {
                throw new Error(
                    'allowed_roles required for CUSTOM scope'
                );
            }

            allowedRoles =
                pa.allowed_roles
                    .split(',')
                    .map(r => r.trim())
                    .filter(Boolean)
                    .join(',');
        }

        /* =========================
           📦 PAYLOAD
        ========================= */

        const payload = {

            TPER02: roleId,

            TPER03: scope,

            TPER04: allowedRoles,

            TPER05: Number(
                pa.create_ticket || 0
            ),

            TPER06: Number(
                pa.reply_ticket || 0
            ),

            TPER07: Number(
                pa.change_status || 0
            ),

            TPER08: Number(
                pa.delete_ticket || 0
            )
        };

        /* =========================
           🔍 CHECK EXISTING
        ========================= */

        const existing =
            await TicketPermission.findOne({
                where: {
                    TPER02: roleId
                }
            });

        /* =========================
           ✏️ UPDATE
        ========================= */

        if (existing) {

            await TicketPermission.update(
                payload,
                {
                    where: {
                        TPER02: roleId
                    }
                }
            );

        }

        /* =========================
           ➕ CREATE
        ========================= */

        else {

            await TicketPermission.create(
                payload
            );
        }

        /* =========================
           📩 RESPONSE
        ========================= */

        return res.json({
            encryptedResponse:
                encryptor.encrypt(
                    JSON.stringify({
                        status: 'SUCCESS',
                        message:
                            'Ticket permission saved'
                    })
                )
        });
    }
}

module.exports = TicketPermissionController;