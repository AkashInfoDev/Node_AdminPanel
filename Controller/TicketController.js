const db = require('../Config/config');
const { Sequelize, where } = require('sequelize');

/* =========================
   📦 MODELS IMPORT
========================= */
const { Op } = require('sequelize');
const defineTicket = require('../Models/RDB/EP_TICKET');
const defineTicketMsg = require('../Models/RDB/EP_TICKET_MSG');
const defineEP_FILE = require('../Models/RDB/EP_FILE');
const defineUser = require('../Models/RDB/EP_USER');
const defineTicketMaster = require('../Models/RDB/TICKETMASTER');
const defineTicketRepeat = require('../Models/RDB/EP_TICKET_REPEAT');
const defineTicketPermission = require('../Models/RDB/EPTICKPER');
/* =========================
   🔗 DB CONNECTION
========================= */

const sequelizeRDB = db.getConnection('RDB');
const TicketPermission =
    defineTicketPermission(
        sequelizeRDB,
        Sequelize.DataTypes
    );

/* =========================
   🧱 MODEL INITIALIZATION
========================= */

const Ticket = defineTicket(sequelizeRDB, Sequelize.DataTypes);
const TicketMessage = defineTicketMsg(sequelizeRDB, Sequelize.DataTypes);
const EP_FILE = defineEP_FILE(sequelizeRDB, Sequelize.DataTypes);
const User = defineUser(sequelizeRDB, Sequelize.DataTypes);
const TicketMaster = defineTicketMaster(sequelizeRDB, Sequelize.DataTypes);
const TicketRepeat = defineTicketRepeat(sequelizeRDB, Sequelize.DataTypes);

/* =========================
   🔐 SERVICES
========================= */

const Encryptor = require('../Services/encryptor');
const TokenService = require('../Services/tokenServices');
// const { decode } = require('punycode');

const encryptor = new Encryptor();

const formatCategory = (c) => ({
    id: c.CAT01,
    name: c.CAT02,
    assignedRole: c.CAT03
});
const formatTicket = (t, category = null) => ({
    ticket_id: t.TKT01,
    subject: t.TKT02,
    description: t.TKT03,
    priority: t.TKT04,
    status: t.TKT05,
    createdBy: t.TKT06,
    roleId: t.TKT07,
    createdAt: t.TKT08,
    updatedAt: t.TKT09,

    category: category ? {
        id: category.CAT01,
        name: category.CAT02,
        assignedRole: category.CAT03
    } : null
});

const formatMessage = (m) => ({
    id: m.MSG01,
    ticketId: m.MSG02,
    senderId: m.MSG03,
    senderRole: m.MSG04,
    message: m.MSG05,
    createdAt: m.MSG06
});




function normalizeText(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '');
}

const crypto = require('crypto');

function generateHash(subject, description) {
    const clean = normalizeText(subject + description);
    return crypto.createHash('md5').update(clean).digest('hex');
}



class TicketController {


    static async handleTicket(req, res) {

        let response = { status: 'SUCCESS', message: '', data: null };

        try {

            /* =========================
               🔐 TOKEN VALIDATION
            ========================= */
            const token =
                req.headers['authorization']
                    ?.split(' ')[1];

            if (!token) {
                throw new Error(
                    'Authorization token missing'
                );
            }

            /* =========================
               🔓 VALIDATE TOKEN
            ========================= */

            const decoded =
                await TokenService
                    .validateToken(token);

            /* =========================
               🔐 LOAD PERMISSION
            ========================= */

            const permission =
                decoded.corpId
                    ? null
                    : await TicketController
                        .getTicketPermission(
                            decoded.roleId
                        );
            // const roleId = Number(decoded.roleId);

            /* =========================
               🔓 DECRYPT PARAM
            ========================= */
            const encryptedPa = req.body.pa || req.query.pa;

            if (!encryptedPa) {
                throw new Error('pa missing');
            }

            const decrypted = encryptor.decrypt(encryptedPa);
            const pa = require('querystring').parse(decodeURIComponent(decrypted));

            const action = pa.action;
            if (!action) {
                throw new Error('action required');
            }

            /* =========================
               🎯 ACTION ROUTER
            ========================= */

            switch (action) {

                case 'A':

                    return TicketController.assignTicket(
                        pa,
                        res,
                        decoded,
                        permission
                    );

                case 'C':
                    // return TicketController.createTicket(pa, res, decoded, req);
                    return TicketController.createTicket(
                        pa,
                        res,
                        decoded,
                        req,
                        permission
                    );

                case 'G':
                    // return TicketController.getTickets(pa, res, decoded);
                    return TicketController.getTickets(
                        pa,
                        res,
                        decoded,
                        permission
                    );

                case 'R':
                    // return TicketController.replyTicket(pa, res, decoded, req);
                    return TicketController.replyTicket(
                        pa,
                        res,
                        decoded,
                        req,
                        permission
                    );

                case 'S':
                    // return TicketController.updateStatus(pa, res, decoded);
                    return TicketController.updateStatus(
                        pa,
                        res,
                        decoded,
                        permission
                    );

                case 'D': // 🔥 Detail view
                    // return TicketController.getTicketDetail(pa, res, decoded);
                    return TicketController.getTicketDetail(
                        pa,
                        res,
                        decoded,
                        permission
                    );

                case 'TC':
                    return TicketController.handleTicketCategory(pa, res, decoded);

                case 'H':
                    // return await TicketController.getTicketHistory(pa, res, decoded);
                    return TicketController.getTicketHistory(
                        pa,
                        res,
                        decoded,
                        permission
                    );

                case 'U':

                    return TicketController.getAllowedUsers(
                        res,
                        decoded,
                        permission
                    );


                case 'DL':

                    return TicketController.deleteTicket(
                        pa,
                        res,
                        decoded,
                        permission
                    );

                default:
                    throw new Error('Invalid action');
            }


        } catch (err) {

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: err.message
                }))
            });
        }
    }

    static async getTicketPermission(roleId) {

        const permission =
            await TicketPermission.findOne({
                where: {
                    TPER02: roleId
                },
                raw: true
            });

        if (!permission) {
            throw new Error(
                'Ticket permission not configured'
            );
        }

        return permission;
    }

    static async handleTicketCategory(pa, res, decoded) {

        const subAction = pa.subAction;

        if (!subAction) {
            throw new Error('subAction is required');
        }

        switch (subAction) {

            /* =========================
               ➕ CREATE CATEGORY
            ========================= */
            case 'C': {

                const { name } = pa;

                if (!name) {
                    throw new Error('Category name required');
                }
                const exists = await TicketMaster.findOne({
                    where: {
                        CAT02: name,
                        CAT04: 1
                    }
                });

                if (exists) {
                    throw new Error('Category already exists');
                }

                const created = await TicketMaster.create({
                    CAT02: name,
                    CAT03: null   // ✅ optional now
                });

                return res.json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        status: 'SUCCESS',
                        message: 'Category created',
                        data: formatCategory(created)
                    }))
                });
            }

            /* =========================
               📥 GET ALL
            ========================= */
            case 'G': {

                const categories = await TicketMaster.findAll({
                    where: { CAT04: 1 },
                    raw: true
                });

                return res.json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        status: 'SUCCESS',
                        message: 'Categories fetched',
                        data: categories.map(c => formatCategory(c))
                    }))
                });
            }

            /* =========================
               ✏️ UPDATE
            ========================= */
            case 'U': {

                const { id, name } = pa;

                if (!id) {
                    throw new Error('Category ID required');
                }

                if (!name) {
                    throw new Error('Category name required');
                }

                const exists = await TicketMaster.findOne({
                    where: { CAT01: id }
                });

                if (!exists) {
                    throw new Error('Category not found');
                }

                await TicketMaster.update(
                    {
                        CAT02: name
                    },
                    { where: { CAT01: id } }
                );

                const updated = await TicketMaster.findOne({
                    where: { CAT01: id },
                    raw: true
                });

                return res.json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        status: 'SUCCESS',
                        message: 'Category updated',
                        data: formatCategory(updated)
                    }))
                });
            }

            /* =========================
               ❌ DELETE (SOFT DELETE)
            ========================= */
            case 'D': {

                const { id } = pa;

                if (!id) {
                    throw new Error('Category ID required');
                }

                const exists = await TicketMaster.findOne({
                    where: { CAT01: id }
                });

                if (!exists) {
                    throw new Error('Category not found');
                }

                await TicketMaster.update(
                    { CAT04: 0 },
                    { where: { CAT01: id } }
                );
                const existing = await TicketMaster.findOne({
                    where: { CAT01: id },
                    raw: true
                });

                return res.json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify({
                        status: 'SUCCESS',
                        message: 'Category deleted',
                        data: formatCategory(existing)
                    }))
                });
            }

            default:
                throw new Error('Invalid category subAction');
        }
    }


    static async createTicket(pa, res, decoded, req, permission) {

        const { subject, description, priority } = pa;
        const category_id = Number(pa.category_id);

        /* =========================
           VALIDATION
        ========================= */
        if (!subject || !description || isNaN(category_id)) {
            throw new Error('Missing or invalid fields');
        }

        const category = await TicketMaster.findOne({
            where: { CAT01: category_id, CAT04: 1 },
            raw: true
        });

        if (!category) {
            throw new Error('Invalid category');
        }

        /* =========================
           IDENTITY CHECK
        ========================= */
        if (!decoded.corpId && !decoded.Id) {
            throw new Error('Invalid identity');
        }
        /* =========================
   🔐 CREATE PERMISSION
========================= */

        if (
            !decoded.corpId &&
            !permission?.TPER05
        ) {
            throw new Error(
                'No permission to create ticket'
            );
        }

        const corpId = decoded.corpId || null;

        /* =========================
   🧠 HASH GENERATION (NEW)
========================= */
        const cleanSubject = normalizeText(subject);
        const cleanDescription = normalizeText(description);

        const hash = generateHash(cleanSubject, cleanDescription);

        console.log("SUBJECT:", subject);
        console.log("DESCRIPTION:", description);
        console.log("HASH:", hash);
        /* =========================
           🔍 CHECK DUPLICATE (NEW)
        ========================= */
        // const existingTicket = await Ticket.findOne({
        //     where: {
        //         TKT12: hash,
        //         TKT05: 'OPEN'
        //     },
        //     raw: true
        // });
        let existingTicket = await Ticket.findOne({
            where: {
                TKT12: hash,
                TKT05: {
                    [Op.in]: ['OPEN', 'REPEAT']
                }
            },
            order: [['TKT01', 'DESC']],
            raw: true
        });

        if (!existingTicket) {

            existingTicket = await Ticket.findOne({
                where: {
                    TKT12: hash,
                    TKT05: 'RESOLVED'
                },
                order: [['TKT01', 'DESC']],
                raw: true
            });
        }

        // if (existingTicket) {

        //     // 🔁 store repeat
        //     try {
        //         console.log("EXISTING TICKET:", existingTicket);

        //         await TicketRepeat.create({
        //             REP02: existingTicket.TKT01,
        //             REP03: subject,
        //             REP04: description,
        //             REP05: priority || 'MEDIUM',
        //             REP06: existingTicket.TKT05,
        //             REP07: decoded.Id || null,
        //             REP08: decoded.roleId || null,
        //             REP10: category_id,
        //             REP11: decoded.corpId || null
        //         });

        //     } catch (err) {
        //         console.error("🔥 REPEAT INSERT ERROR FULL:", err);
        //         console.error("🔥 ERROR MESSAGE:", err.message);
        //         console.error("🔥 ERROR ORIGINAL:", err.original);
        //         throw err;
        //     }
        //     return res.json({
        //         encryptedResponse: encryptor.encrypt(JSON.stringify({
        //             status: 'SUCCESS',
        //             message: 'Ticket already exists, occurrence recorded',
        //             data: {
        //                 ticket_id: existingTicket.TKT01
        //             }
        //         }))
        //     });
        // }
        if (existingTicket) {

            try {

                console.log("EXISTING TICKET:", existingTicket);

                /* =========================
                   🔥 RESOLVED → REPEAT
                ========================= */
                if (existingTicket.TKT05 === 'RESOLVED') {

                    await Ticket.update(
                        { TKT05: 'REPEAT' },
                        { where: { TKT01: existingTicket.TKT01 } }
                    );

                    existingTicket.TKT05 = 'REPEAT';
                }

                /* =========================
                   🔁 STORE OCCURRENCE
                ========================= */
                await TicketRepeat.create({
                    REP02: existingTicket.TKT01,
                    REP03: subject,
                    REP04: description,
                    REP05: priority || 'MEDIUM',
                    REP06: existingTicket.TKT05,
                    REP07: decoded.Id || null,
                    REP08: decoded.roleId || null,
                    REP10: category_id,
                    REP11: decoded.corpId || null
                });

                if (req.files && req.files.length > 0) {

                    const filesData = req.files.map(file => {

                        const base = {
                            FILE02: file.originalname,
                            FILE03: file.buffer.toString('base64'),

                            FILE06: 'Repeated ticket attachment',
                            FILE07: 'TICKET_REPEAT',

                            // 🔥 LINK TO MAIN TICKET
                            FILE08: existingTicket.TKT01
                        };

                        if (corpId) {
                            base.FILE09 = corpId;
                        } else {
                            base.FILE04 = decoded.Id;
                        }

                        return base;
                    });

                    await EP_FILE.bulkCreate(filesData);
                }

            } catch (err) {

                console.error("🔥 REPEAT INSERT ERROR FULL:", err);
                console.error("🔥 ERROR MESSAGE:", err.message);
                console.error("🔥 ERROR ORIGINAL:", err.original);

                throw err;
            }

            return res.json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',

                    message:
                        existingTicket.TKT05 === 'REPEAT'
                            ? 'Resolved issue occurred again'
                            : 'Ticket already exists, occurrence recorded',

                    data: {
                        ticket_id: existingTicket.TKT01
                    }
                }))
            });
        }

        /* =========================
           CREATE TICKET (FIXED)
        ========================= */
        const ticketPayload = {
            TKT02: subject,
            TKT03: description,
            TKT04: priority || 'MEDIUM',
            TKT05: 'OPEN',
            TKT10: category_id,
            TKT11: corpId || null,
            TKT12: hash   // 🔥 ADD THIS
        };

        if (corpId) {
            ticketPayload.TKT06 = null;
            ticketPayload.TKT07 = 6;
        } else {
            ticketPayload.TKT06 = decoded.Id;
            ticketPayload.TKT07 = Number(decoded.roleId || 0);
        }

        // 🔥 CRITICAL FIX: restrict fields (prevents TKT08 issue)
        const ticket = await Ticket.create(ticketPayload, {
            fields: ['TKT02', 'TKT03', 'TKT04', 'TKT05', 'TKT06', 'TKT07', 'TKT10', 'TKT11', 'TKT12']
        });

        /* =========================
           FILE UPLOAD (SAFE)
        ========================= */
        if (req.files && req.files.length > 0) {

            const filesData = req.files.map(file => {

                const base = {
                    FILE02: file.originalname,
                    FILE03: file.buffer.toString('base64'),

                    FILE06: 'Ticket attachment',
                    FILE07: 'TICKET',
                    FILE08: ticket.TKT01
                };

                // ✅ ONLY ONE FIELD (IMPORTANT)
                if (corpId) {
                    base.FILE09 = corpId;
                } else {
                    base.FILE04 = decoded.Id;
                }

                return base;
            });

            await EP_FILE.bulkCreate(filesData);
        }

        /* =========================
           RESPONSE
        ========================= */
        return res.json({
            encryptedResponse: encryptor.encrypt(JSON.stringify({
                status: 'SUCCESS',
                message: 'Ticket created',
                data: ticket
            }))
        });
    }

    static async getTickets(pa, res, decoded, permission) {

        const roleId = Number(decoded.roleId);

        let where = {};


        /* =========================
    🔐 ACCESS FILTER
 ========================= */

        if (decoded.corpId) {

            /* =========================
               🏢 CORPORATE
            ========================= */

            where.TKT11 = decoded.corpId;

        } else {

            /* =========================
               👨‍💻 PORTAL USER
            ========================= */

            if (!decoded.Id) {
                throw new Error(
                    'Invalid token: userId missing'
                );
            }

            /* =========================
               SELF ACCESS
            ========================= */

            if (permission.TPER03 === 'SELF') {

                // where.TKT06 = decoded.Id;
                where = {
                    [Op.or]: [

                        { TKT06: decoded.Id },

                        { TKT13: decoded.Id }
                    ]
                };
            }

            /* =========================
               CUSTOM ACCESS
            ========================= */

            else if (
                permission.TPER03 === 'CUSTOM'
            ) {

                const allowedRoles =
                    permission.TPER04
                        ?.split(',')
                        .map(Number) || [];

                where.TKT07 = {
                    [Op.in]: allowedRoles
                };
            }

            /* =========================
               ALL ACCESS
            ========================= */

            else if (
                permission.TPER03 === 'ALL'
            ) {

                // NO FILTER
            }

            else {

                throw new Error(
                    'Invalid ticket permission scope'
                );
            }
        }

        /* =========================
           📥 FETCH TICKETS
        ========================= */
        const tickets = await Ticket.findAll({
            where,
            raw: true
        });

        /* =========================
   🎟️ TICKET PERMISSION DATA
========================= */

        const ticket_permission = {

            scope:
                permission?.TPER03 || 'SELF',

            allowed_roles:
                permission?.TPER04
                    ? permission.TPER04
                        .split(',')
                        .map(Number)
                    : [],

            create_ticket:
                permission?.TPER05 ? 1 : 0,

            assign_ticket:
                permission?.TPER06 ? 1 : 0,

            change_status:
                permission?.TPER07 ? 1 : 0,

            delete_ticket:
                permission?.TPER08 ? 1 : 0
        };
        if (!tickets.length) {
            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    message: 'No tickets found',
                    data: []
                }))
            });
        }

        const ticketIds = tickets.map(t => t.TKT01);
        const hashes = tickets.map(t => t.TKT12).filter(h => h);
        const allRelatedTickets = await Ticket.findAll({
            where: {
                TKT12: { [Op.in]: hashes }
            },
            attributes: ['TKT01', 'TKT12', 'TKT05'],
            raw: true
        });
        const allRelatedTicketIds = allRelatedTickets.map(t => t.TKT01);

        const allRepeats = await TicketRepeat.findAll({
            where: {
                REP02: { [Op.in]: allRelatedTicketIds }
            },
            attributes: ['REP02'],
            raw: true
        });
        const countMap = {};

        allRelatedTickets.forEach(t => {
            if (!countMap[t.TKT12]) {
                countMap[t.TKT12] = { total: 0, active: 0 };
            }

            countMap[t.TKT12].total += 1;

            // if (t.TKT05 === 'OPEN') {
            //     countMap[t.TKT12].active += 1;
            // }
            if (['OPEN', 'REPEAT'].includes(t.TKT05)) {
                countMap[t.TKT12].active += 1;
            }
        });

        allRepeats.forEach(r => {
            const parent = allRelatedTickets.find(t => t.TKT01 === r.REP02);
            if (!parent) return;

            countMap[parent.TKT12].total += 1;

            // if (parent.TKT05 === 'OPEN') {
            //     countMap[parent.TKT12].active += 1;
            // }
            if (['OPEN', 'REPEAT'].includes(parent.TKT05)) {
                countMap[parent.TKT12].active += 1;
            }
        });

        /* =========================
           👨‍💻 USER DATA
        ========================= */
        // const userIds = tickets
        //     .map(t => t.TKT06)
        //     .filter(id => id !== null && id !== undefined);
        const userIds = [

            ...tickets.map(t => t.TKT06),

            ...tickets.map(t => t.TKT13),

            ...tickets.map(t => t.TKT15)

        ].filter(id => id);

        const users = userIds.length > 0
            ? await User.findAll({
                where: {
                    UTF01: {
                        [Op.in]: userIds
                    }
                },
                raw: true
            })
            : [];

        /* =========================
           🏢 CORPORATE DATA
        ========================= */
        const corpIds = tickets
            .map(t => t.TKT11)
            .filter(id => id !== null && id !== undefined);

        const corporates = corpIds.length > 0
            ? await sequelizeRDB.query(
                `SELECT * FROM PLRDBA01 WHERE A01F03 IN (:corpIds)`,

                {
                    replacements: { corpIds },
                    type: Sequelize.QueryTypes.SELECT
                }
            )
            : [];
        // console.log("corpIds:", corpIds);
        console.log("corporates result:", corporates);
        /* =========================
           📎 Ticket Files
        ========================= */
        const ticketFiles = await EP_FILE.findAll({
            where: {
                FILE07: 'TICKET',
                FILE08: { [Op.in]: ticketIds }
            },
            raw: true
        });

        /* =========================
           📂 Categories
        ========================= */
        const categoryIds = tickets
            .map(t => t.TKT10)
            .filter(id => id !== null && id !== undefined);

        const categories = categoryIds.length > 0
            ? await TicketMaster.findAll({
                where: {
                    CAT01: { [Op.in]: categoryIds },
                    CAT04: 1
                },
                raw: true
            })
            : [];

        /* =========================
           💬 Messages
        ========================= */
        const messages = await TicketMessage.findAll({
            where: {
                MSG02: { [Op.in]: ticketIds }
            },
            raw: true
        });

        const messageIds = messages.map(m => m.MSG01);

        /* =========================
           📎 Message Files
        ========================= */
        const messageFiles = messageIds.length > 0
            ? await EP_FILE.findAll({
                where: {
                    FILE07: 'TICKET_MSG',
                    FILE08: { [Op.in]: messageIds }
                },
                raw: true
            })
            : [];

        /* =========================
           🔗 Merge Data
        ========================= */
        const finalData = tickets.map(ticket => {

            const user = users.find(u => u.UTF01 === ticket.TKT06);
            // const counts = countMap[ticket.TKT12] || { total: 1, active: 1 };
            const counts = countMap[ticket.TKT12] || {
                total: 1,
                active: ['OPEN', 'REPEAT'].includes(ticket.TKT05) ? 1 : 0
            };

            const corporate = corporates.find(
                c =>
                    String(c.A01F03).trim().toUpperCase() ===
                    String(ticket.TKT11).trim().toUpperCase()
            );

            const files = ticketFiles.filter(f => f.FILE08 === ticket.TKT01);

            const ticketMsgs = messages
                .filter(m => m.MSG02 === ticket.TKT01)
                .map(msg => {
                    const msgFiles = messageFiles.filter(f => f.FILE08 === msg.MSG01);

                    return {
                        ...formatMessage(msg),
                        files: msgFiles
                    };
                });

            const category = categories.find(c => c.CAT01 === ticket.TKT10);

            // return {
            //     ...formatTicket(ticket, category),
            //     repeat_stats: {
            //         total_occurrences: counts.total,
            //         active_occurrences: counts.active
            //     },

            //     /* =========================
            //        👤 CREATOR (FINAL CLEAN)
            //     ========================= */
            //     creator: ticket.TKT11
            //         ? {
            //             type: 'CORPORATE',
            //             id: corporate?.A01F01 || null,
            //             name: corporate?.A01F02 || null,
            //             corpId: ticket.TKT11
            //         }
            //         : {
            //             type: 'USER',
            //             id: user?.UTF01 || null,
            //             name: user?.UTF02 || null,
            //             roleId: user?.UTF03 || null,
            //             phone: user?.UTF09 || null,
            //             email: user?.UTF10 || null
            //         },

            //     files,
            //     messages: ticketMsgs
            // };
            return {

                ...formatTicket(ticket, category),

                repeat_stats: {
                    total_occurrences: counts.total,
                    active_occurrences: counts.active
                },

                /* =========================
                   👤 CREATOR
                ========================= */

                creator: ticket.TKT11
                    ? {
                        type: 'CORPORATE',
                        id: corporate?.A01F01 || null,
                        name: corporate?.A01F02 || null,
                        corpId: ticket.TKT11
                    }
                    : {
                        type: 'USER',
                        id: user?.UTF01 || null,
                        name: user?.UTF02 || null,
                        roleId: user?.UTF03 || null,
                        phone: user?.UTF09 || null,
                        email: user?.UTF10 || null
                    },

                /* =========================
                   👨‍🔧 ASSIGNED USER
                ========================= */

                assigned_to: ticket.TKT13
                    ? {
                        id: users.find(
                            u => u.UTF01 === ticket.TKT13
                        )?.UTF01 || null,

                        name: users.find(
                            u => u.UTF01 === ticket.TKT13
                        )?.UTF02 || null,

                        roleId: users.find(
                            u => u.UTF01 === ticket.TKT13
                        )?.UTF03 || null
                    }
                    : null,

                /* =========================
   👨‍💼 ASSIGNED BY
========================= */

                assigned_by: ticket.TKT15
                    ? {
                        id: users.find(
                            u => u.UTF01 === ticket.TKT15
                        )?.UTF01 || null,

                        name: users.find(
                            u => u.UTF01 === ticket.TKT15
                        )?.UTF02 || null,

                        roleId: users.find(
                            u => u.UTF01 === ticket.TKT15
                        )?.UTF03 || null,

                        phone: users.find(
                            u => u.UTF01 === ticket.TKT15
                        )?.UTF09 || null,

                        email: users.find(
                            u => u.UTF01 === ticket.TKT15
                        )?.UTF10 || null,

                        assigned_at: ticket.TKT16
                    }
                    : null,
                files,

                messages: ticketMsgs
                // ticket_permission
            };

        });

        /* =========================
           📩 Response
        ========================= */
        return res.status(200).json({
            encryptedResponse: encryptor.encrypt(JSON.stringify({
                status: 'SUCCESS',
                message: 'Tickets fetched successfully',
                data: {

                    tickets: finalData,

                    ticket_permission
                }
            }))
        });
    }
    static async replyTicket(pa, res, decoded, req, permission) {

        const { ticket_id, message } = pa;

        if (!ticket_id || !message) {
            throw new Error('Missing fields');
        }

        /* =========================
           🔍 CHECK TICKET EXISTS
        ========================= */
        const ticket = await Ticket.findOne({
            where: { TKT01: ticket_id }
        });

        if (!ticket) {
            throw new Error('Ticket not found');
        }

        /* =========================
           🚫 CHECK IF CLOSED
        ========================= */
        if (ticket.TKT05 === 'RESOLVED') {
            throw new Error('Ticket already closed');
        }

        /* =========================
           💬 CREATE MESSAGE
        ========================= */
        const msg = await TicketMessage.create({
            MSG02: ticket_id,
            MSG03: decoded.Id,
            MSG04: decoded.roleId,
            MSG05: message
        });

        /* =========================
           📎 FILE UPLOAD (EP_FILE)
        ========================= */

        if (req.files && req.files.length > 0) {

            // 🔥 Optional: file type validation
            const allowedTypes = [
                'image/png',
                'image/jpeg',
                'application/pdf'
            ];

            const filesData = req.files
                .filter(file => allowedTypes.includes(file.mimetype))
                .map(file => ({
                    FILE02: file.originalname,
                    FILE03: file.buffer.toString('base64'),
                    FILE04: decoded.Id,
                    FILE06: 'Reply attachment',
                    FILE07: 'TICKET_MSG',
                    FILE08: msg.MSG01
                }));

            if (filesData.length > 0) {
                try {
                    await EP_FILE.bulkCreate(filesData);
                } catch (err) {
                    console.error("🔥 FILE ERROR:", err.message);
                    console.error("🔥 DATA:", filesData);
                    throw err;
                }
            }
        }

        /* =========================
           📩 RESPONSE
        ========================= */

        return res.json({
            encryptedResponse: encryptor.encrypt(JSON.stringify({
                status: 'SUCCESS',
                message: 'Reply sent successfully',
                data: {
                    message_id: msg.MSG01
                }
            }))
        });
    }
    // static async updateStatus(pa, res, decoded, permission) {

    //     const roleId = Number(decoded.roleId);

    //     if (![1].includes(roleId)) {
    //         throw new Error('Only admin can update status');
    //     }

    //     const { ticket_id, status } = pa;

    //     if (!ticket_id || !status) {
    //         throw new Error('Missing fields');
    //     }

    //     // const allowedStatus = ['OPEN', 'RESOLVED'];
    //     const allowedStatus = ['OPEN', 'RESOLVED', 'REPEAT'];

    //     if (!allowedStatus.includes(status)) {
    //         throw new Error('Invalid status');
    //     }

    //     const ticket = await Ticket.findOne({
    //         where: { TKT01: ticket_id }
    //     });

    //     if (!ticket) {
    //         throw new Error('Ticket not found');
    //     }


    //     // await TicketRepeat.update(
    //     //     { REP06: status },
    //     //     { where: { REP02: ticket_id } }
    //     // );

    //     await Ticket.update(
    //         { TKT05: status },
    //         { where: { TKT01: ticket_id } }
    //     );

    //     return res.json({
    //         encryptedResponse: encryptor.encrypt(JSON.stringify({
    //             status: 'SUCCESS',
    //             message: 'Ticket updated'
    //         }))
    //     });
    // }
    static async updateStatus(
        pa,
        res,
        decoded,
        permission
    ) {

        /* =========================
           🔐 STATUS CHANGE PERMISSION
        ========================= */

        if (!permission?.TPER07) {

            throw new Error(
                'No permission to change status'
            );
        }

        const { ticket_id, status } = pa;

        if (!ticket_id || !status) {
            throw new Error('Missing fields');
        }

        const allowedStatus = [
            'OPEN',
            'RESOLVED',
            'REPEAT'
        ];

        if (!allowedStatus.includes(status)) {
            throw new Error('Invalid status');
        }

        const ticket = await Ticket.findOne({
            where: { TKT01: ticket_id }
        });

        if (!ticket) {
            throw new Error('Ticket not found');
        }

        await Ticket.update(
            { TKT05: status },
            { where: { TKT01: ticket_id } }
        );

        return res.json({
            encryptedResponse:
                encryptor.encrypt(
                    JSON.stringify({
                        status: 'SUCCESS',
                        message: 'Ticket updated'
                    })
                )
        });
    }
    static async getTicketDetail(pa, res, decoded, permission) {

        const { ticket_id } = pa;

        if (!ticket_id) {
            throw new Error('ticket_id required');
        }

        /* =========================
           🔍 Fetch Ticket
        ========================= */
        const ticket = await Ticket.findOne({
            where: { TKT01: ticket_id },
            raw: true
        });

        if (!ticket) {
            throw new Error('Ticket not found');
        }
        const user = await User.findOne({
            where: { UTF01: ticket.TKT06 },
            raw: true
        });
        const category = await TicketMaster.findOne({
            where: { CAT01: ticket.TKT10, CAT04: 1 },
            raw: true
        });

        /* =========================
           🔐 Access Control
        ========================= */
        const roleId = Number(decoded.roleId);

        // if (roleId !== 1 && ticket.TKT06 !== decoded.Id) {
        //     throw new Error('Access denied');
        // }
        if (decoded.corpId) {
            if (ticket.TKT11 !== decoded.corpId) {
                throw new Error('Access denied');
            }
        } else {
            if (roleId !== 1 && ticket.TKT06 !== decoded.Id) {
                throw new Error('Access denied');
            }
        }

        /* =========================
           📎 Ticket Files
        ========================= */
        const ticketFiles = await EP_FILE.findAll({
            where: {
                // FILE07: 'TICKET',
                FILE07: {
                    [Op.in]: ['TICKET', 'TICKET_REPEAT']
                },
                FILE08: ticket_id
            },
            raw: true
        });

        /* =========================
           💬 Messages
        ========================= */
        const messages = await TicketMessage.findAll({
            where: { MSG02: ticket_id },
            order: [['MSG06', 'ASC']],
            raw: true
        });

        const messageIds = messages.map(m => m.MSG01);

        /* =========================
           📎 Message Files
        ========================= */
        const messageFiles = messageIds.length > 0
            ? await EP_FILE.findAll({
                where: {
                    FILE07: 'TICKET_MSG',
                    FILE08: { [Op.in]: messageIds }
                },
                raw: true
            })
            : [];

        /* =========================
           🔗 Merge Data
        ========================= */
        const formattedMessages = messages.map(msg => {

            const files = messageFiles.filter(f => f.FILE08 === msg.MSG01);

            return {
                ...formatMessage(msg),
                files
            };
        });

        const finalData = {
            ...formatTicket(ticket, category),

            // 🔥 ADD DEALER HERE
            dealer: user ? {
                id: user.UTF01,
                name: user.UTF02,
                roleId: user.UTF03,
                phone: user.UTF09,
                email: user.UTF10
            } : null,

            files: ticketFiles,
            messages: formattedMessages
        };

        /* =========================
           📩 Response
        ========================= */
        return res.status(200).json({
            encryptedResponse: encryptor.encrypt(JSON.stringify({
                status: 'SUCCESS',
                message: 'Ticket detail fetched successfully',
                data: finalData
            }))
        });
    }
    static async getTicketHistory(pa, res, decoded, permission) {

        const { ticket_id } = pa;

        if (!ticket_id) {
            throw new Error('ticket_id required');
        }

        /* =========================
           🔍 FETCH MAIN TICKET
        ========================= */
        const ticket = await Ticket.findOne({
            where: { TKT01: ticket_id },
            raw: true
        });

        if (!ticket) {
            throw new Error('Ticket not found');
        }

        /* =========================
           🔐 ACCESS CONTROL
        ========================= */
        const roleId = Number(decoded.roleId);

        if (decoded.corpId) {

            if (ticket.TKT11 !== decoded.corpId) {
                throw new Error('Access denied');
            }

        } else {
            // ![1, 2, 3, 5].includes
            // if (roleId !== 1 && ticket.TKT06 !== decoded.Id) {
            //     throw new Error('Access denied');
            // }
            if (![1, 2, 3, 5].includes(roleId) && ticket.TKT06 !== decoded.Id) {
                throw new Error('Access denied');
            }
        }

        /* =========================
           🔁 FETCH REPEAT HISTORY
        ========================= */
        const repeats = await TicketRepeat.findAll({
            where: {
                REP02: ticket_id
            },
            order: [['REP09', 'ASC']],
            raw: true
        });

        /* =========================
           👨‍💻 USER IDS
        ========================= */
        const userIds = [

            ticket.TKT06,

            ...repeats
                .map(r => r.REP07)
                .filter(id => id)

        ].filter(id => id);

        const users = userIds.length > 0
            ? await User.findAll({
                where: {
                    UTF01: {
                        [Op.in]: userIds
                    }
                },
                raw: true
            })
            : [];

        /* =========================
           🏢 CORPORATE IDS
        ========================= */
        const corpIds = [

            ticket.TKT11,

            ...repeats
                .map(r => r.REP11)
                .filter(id => id)

        ].filter(id => id);

        const corporates = corpIds.length > 0
            ? await sequelizeRDB.query(
                `SELECT * FROM PLRDBA01 WHERE A01F03 IN (:corpIds)`,
                {
                    replacements: { corpIds },
                    type: Sequelize.QueryTypes.SELECT
                }
            )
            : [];

        /* =========================
           🕒 HISTORY ARRAY
        ========================= */
        const history = [];

        /* =========================
           👤 ORIGINAL CREATOR
        ========================= */
        const originalUser = users.find(
            u => u.UTF01 === ticket.TKT06
        );

        const originalCorporate = corporates.find(
            c =>
                String(c.A01F03).trim().toUpperCase() ===
                String(ticket.TKT11 || '').trim().toUpperCase()
        );

        /* =========================
           🟢 ORIGINAL TICKET
        ========================= */
        history.push({

            type: 'ORIGINAL',

            ticket_id: ticket.TKT01,

            subject: ticket.TKT02,

            description: ticket.TKT03,

            priority: ticket.TKT04,

            status: 'OPEN',

            time: ticket.TKT08,

            creator: ticket.TKT11
                ? {
                    type: 'CORPORATE',
                    corpId: ticket.TKT11,
                    id: originalCorporate?.A01F01 || null,
                    name: originalCorporate?.A01F02 || null
                }
                : {
                    type: 'USER',
                    id: originalUser?.UTF01 || null,
                    name: originalUser?.UTF02 || null,
                    roleId: originalUser?.UTF03 || null,
                    phone: originalUser?.UTF09 || null,
                    email: originalUser?.UTF10 || null
                },

            message: 'Original ticket created'
        });

        /* =========================
           🔁 REPEAT EVENTS
        ========================= */
        repeats.forEach(rep => {

            const user = users.find(
                u => u.UTF01 === rep.REP07
            );

            const corporate = corporates.find(
                c =>
                    String(c.A01F03).trim().toUpperCase() ===
                    String(rep.REP11 || '').trim().toUpperCase()
            );

            history.push({

                type: 'REPEAT',

                repeat_id: rep.REP01,

                status: rep.REP06,

                time: rep.REP09,

                creator: rep.REP11
                    ? {
                        type: 'CORPORATE',
                        corpId: rep.REP11,
                        id: corporate?.A01F01 || null,
                        name: corporate?.A01F02 || null
                    }
                    : {
                        type: 'USER',
                        id: user?.UTF01 || null,
                        name: user?.UTF02 || null,
                        roleId: user?.UTF03 || null,
                        phone: user?.UTF09 || null,
                        email: user?.UTF10 || null
                    },

                message:
                    rep.REP06 === 'REPEAT'
                        ? 'Issue occurred again after resolution'
                        : 'Issue occurred again'
            });

        });

        /* =========================
           🔃 SORT TIMELINE
        ========================= */
        history.sort((a, b) =>
            new Date(a.time) - new Date(b.time)
        );

        /* =========================
           📩 RESPONSE
        ========================= */
        return res.status(200).json({
            encryptedResponse: encryptor.encrypt(JSON.stringify({

                status: 'SUCCESS',

                message: 'Ticket history fetched successfully',

                data: {

                    ticket_id: ticket.TKT01,

                    subject: ticket.TKT02,

                    current_status: ticket.TKT05,

                    total_repeats: repeats.length,

                    history
                }
            }))
        });
    }
    static async assignTicket(
        pa,
        res,
        decoded,
        permission
    ) {

        /* =========================
           🔐 ASSIGN PERMISSION
        ========================= */

        // if (!permission?.TPER09) {
        if (!permission?.TPER06) {

            throw new Error(
                'No permission to assign ticket'
            );
        }

        const {
            ticket_id,
            assign_user_id
        } = pa;

        if (!ticket_id || !assign_user_id) {

            throw new Error(
                'Missing fields'
            );
        }

        /* =========================
           👤 FIND USER
        ========================= */

        const user = await User.findOne({
            where: {
                UTF01: assign_user_id
            },
            raw: true
        });

        if (!user) {

            throw new Error(
                'Assigned user not found'
            );
        }

        /* =========================
           🎟️ FIND TICKET
        ========================= */

        const ticket = await Ticket.findOne({
            where: {
                TKT01: ticket_id
            }
        });

        if (!ticket) {

            throw new Error(
                'Ticket not found'
            );
        }

        /* =========================
           ✅ ASSIGN
        ========================= */

        console.log({

            TKT13: user.UTF01,
            TKT14: user.UTF03,
            TKT15: decoded.Id,
            TKT16: new Date()

        });

        // await Ticket.update({

        //     TKT13: user.UTF01,

        //     TKT14: user.UTF03,

        //     TKT15: decoded.Id,

        //     TKT16: new Date()

        // }, {
        //     where: {
        //         TKT01: Number(ticket_id)
        //     }
        // });

        await sequelizeRDB.query(`

    UPDATE EP_TICKET
    SET

        TKT13 = :assignedUser,

        TKT14 = :assignedRole,

        TKT15 = :assignedBy,

        TKT16 = GETDATE()

    WHERE TKT01 = :ticketId

`, {
            replacements: {

                assignedUser:
                    Number(user.UTF01),

                assignedRole:
                    Number(user.UTF03),

                assignedBy:
                    Number(decoded.Id),

                ticketId:
                    Number(ticket_id)
            }
        });
        return res.json({
            encryptedResponse:
                encryptor.encrypt(
                    JSON.stringify({
                        status: 'SUCCESS',
                        message:
                            'Ticket assigned successfully'
                    })
                )
        });
    }

    static async getAllowedUsers(
        res,
        decoded,
        permission
    ) {

        /* =========================
           🏢 CORPORATE BLOCK
        ========================= */

        if (decoded.corpId) {

            throw new Error(
                'Corporate user not allowed'
            );
        }

        const roleId =
            Number(decoded.roleId);

        let where = {};

        /* =========================
           🎯 SELF
        ========================= */

        if (permission.TPER03 === 'SELF') {

            where.UTF01 = decoded.Id;
        }

        /* =========================
           🎯 CUSTOM
        ========================= */

        else if (
            permission.TPER03 === 'CUSTOM'
        ) {

            const allowedRoles =
                permission.TPER04
                    ?.split(',')
                    .map(Number) || [];

            where.UTF03 = {
                [Op.in]: allowedRoles
            };
        }

        /* =========================
           🎯 ALL
        ========================= */

        else if (
            permission.TPER03 === 'ALL'
        ) {

            // no filter
        }

        else {

            throw new Error(
                'Invalid permission scope'
            );
        }

        /* =========================
           👤 FETCH USERS
        ========================= */

        const users = await User.findAll({

            where,

            attributes: [

                'UTF01',
                'UTF02',
                'UTF03',
                'UTF10',
                'UTF09'
            ],

            raw: true
        });

        /* =========================
           📦 FORMAT
        ========================= */

        const data = users.map(u => ({

            user_id: u.UTF01,

            name: u.UTF02,

            role_id: u.UTF03,

            email: u.UTF10,

            mobile: u.UTF09
        }));

        return res.json({

            encryptedResponse:
                encryptor.encrypt(
                    JSON.stringify({

                        status: 'SUCCESS',

                        message:
                            'Users fetched successfully',

                        data
                    })
                )
        });
    }
    static async deleteTicket(
        pa,
        res,
        decoded,
        permission
    ) {

        /* =========================
           🔐 DELETE PERMISSION
        ========================= */

        if (!permission?.TPER08) {

            throw new Error(
                'No permission to delete ticket'
            );
        }

        const { ticket_id } = pa;

        if (!ticket_id) {

            throw new Error(
                'ticket_id required'
            );
        }

        /* =========================
           🔍 CHECK TICKET
        ========================= */

        const ticket = await Ticket.findOne({

            where: {
                TKT01: ticket_id
            },

            raw: true
        });

        if (!ticket) {

            throw new Error(
                'Ticket not found'
            );
        }

        /* =========================
           🗑️ DELETE FILES
        ========================= */

        await EP_FILE.destroy({

            where: {

                [Op.or]: [

                    {
                        FILE07: 'TICKET',
                        FILE08: ticket_id
                    },

                    {
                        FILE07: 'TICKET_REPEAT',
                        FILE08: ticket_id
                    }
                ]
            }
        });

        /* =========================
           💬 GET MESSAGE IDS
        ========================= */

        const messages =
            await TicketMessage.findAll({

                where: {
                    MSG02: ticket_id
                },

                attributes: ['MSG01'],
                raw: true
            });

        const messageIds =
            messages.map(m => m.MSG01);

        /* =========================
           🗑️ DELETE MESSAGE FILES
        ========================= */

        if (messageIds.length > 0) {

            await EP_FILE.destroy({

                where: {

                    FILE07: 'TICKET_MSG',

                    FILE08: {
                        [Op.in]: messageIds
                    }
                }
            });
        }

        /* =========================
           🗑️ DELETE MESSAGES
        ========================= */

        await TicketMessage.destroy({

            where: {
                MSG02: ticket_id
            }
        });

        /* =========================
           🗑️ DELETE REPEATS
        ========================= */

        await TicketRepeat.destroy({

            where: {
                REP02: ticket_id
            }
        });

        /* =========================
           🗑️ DELETE TICKET
        ========================= */

        await Ticket.destroy({

            where: {
                TKT01: ticket_id
            }
        });

        /* =========================
           ✅ RESPONSE
        ========================= */

        return res.json({

            encryptedResponse:
                encryptor.encrypt(

                    JSON.stringify({

                        status: 'SUCCESS',

                        message:
                            'Ticket deleted successfully'
                    })
                )
        });
    }

}


module.exports = TicketController;