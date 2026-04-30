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

/* =========================
   🔗 DB CONNECTION
========================= */

const sequelizeRDB = db.getConnection('RDB');

/* =========================
   🧱 MODEL INITIALIZATION
========================= */

const Ticket = defineTicket(sequelizeRDB, Sequelize.DataTypes);
const TicketMessage = defineTicketMsg(sequelizeRDB, Sequelize.DataTypes);
const EP_FILE = defineEP_FILE(sequelizeRDB, Sequelize.DataTypes);
const User = defineUser(sequelizeRDB, Sequelize.DataTypes);

/* =========================
   🔐 SERVICES
========================= */

const Encryptor = require('../Services/encryptor');
const TokenService = require('../Services/tokenServices');
// const { decode } = require('punycode');

const encryptor = new Encryptor();

const formatTicket = (t) => ({
    ticket_id: t.TKT01,
    subject: t.TKT02,
    description: t.TKT03,
    priority: t.TKT04,
    status: t.TKT05,
    createdBy: t.TKT06,
    roleId: t.TKT07,
    createdAt: t.TKT08,
    updatedAt: t.TKT09
});

const formatMessage = (m) => ({
    id: m.MSG01,
    ticketId: m.MSG02,
    senderId: m.MSG03,
    senderRole: m.MSG04,
    message: m.MSG05,
    createdAt: m.MSG06
});
class TicketController {

    static async handleTicket(req, res) {

        let response = { status: 'SUCCESS', message: '', data: null };

        try {

            /* =========================
               🔐 TOKEN VALIDATION
            ========================= */
            const token = req.headers['authorization']?.split(' ')[1];

            if (!token) {
                throw new Error('Authorization token missing');
            }

            const decoded = await TokenService.validateToken(token);
            const roleId = Number(decoded.roleId);

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

            /* =========================
               🎯 ACTION ROUTER
            ========================= */

            switch (action) {

                case 'C':
                    return TicketController.createTicket(pa, res, decoded, req);

                case 'G':
                    return TicketController.getTickets(pa, res, decoded);

                case 'R':
                    return TicketController.replyTicket(pa, res, decoded, req);

                case 'S':
                    return TicketController.updateStatus(pa, res, decoded);

                case 'D': // 🔥 Detail view
                    return TicketController.getTicketDetail(pa, res, decoded);

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
    static async createTicket(pa, res, decoded, req) {

        const { subject, description, priority } = pa;

        if (!subject || !description) {
            throw new Error('Missing fields');
        }

        const ticket = await Ticket.create({
            TKT02: subject,
            TKT03: description,
            TKT04: priority || 'MEDIUM',
            TKT05: 'OPEN',
            TKT06: decoded.Id,
            TKT07: decoded.roleId
        });

        /* =========================
           📎 FILE UPLOAD (EP_FILE)
        ========================= */

        if (req.files && req.files.length > 0) {

            const filesData = req.files.map(file => ({
                FILE02: file.originalname,
                FILE03: file.buffer.toString('base64'),
                FILE04: decoded.Id,
                FILE06: 'Ticket attachment',
                FILE07: 'TICKET',
                FILE08: ticket.TKT01
            }));

            await EP_FILE.bulkCreate(filesData);
        }

        return res.json({
            encryptedResponse: encryptor.encrypt(JSON.stringify({
                status: 'SUCCESS',
                message: 'Ticket created',
                data: ticket
            }))
        });
    }
    // static async getTickets(pa, res, decoded) {

    //     const roleId = Number(decoded.roleId);



    //     // 🔥 Admin → all tickets
    //     let where = {};

    //     if (roleId === 1) {
    //         // Admin → see all
    //         where = {};
    //     } else {
    //         // 🔥 Others → only their tickets
    //         where.TKT06 = decoded.Id;
    //     }

    //     const tickets = await Ticket.findAll({
    //         where,
    //         raw: true
    //     });

    //     /* =========================
    //        📦 FETCH FILES (TICKET)
    //     ========================= */

    //     const ticketIds = tickets.map(t => t.TKT01);

    //     const ticketFiles = await EP_FILE.findAll({
    //         where: {
    //             FILE07: 'TICKET',
    //             FILE08: {
    //                 [Op.in]: ticketIds
    //             }
    //         },
    //         raw: true
    //     });

    //     /* =========================
    //        💬 FETCH MESSAGES
    //     ========================= */

    //     const messages = await TicketMessage.findAll({
    //         where: {
    //             MSG02: {
    //                 [Op.in]: ticketIds
    //             }
    //         },
    //         raw: true
    //     });

    //     const messageIds = messages.map(m => m.MSG01);

    //     /* =========================
    //        📎 FETCH MESSAGE FILES
    //     ========================= */

    //     const messageFiles = await EP_FILE.findAll({
    //         where: {
    //             FILE07: 'TICKET_MSG',
    //             FILE08: {
    //                 [Op.in]: messageIds
    //             }
    //         },
    //         raw: true
    //     });

    //     /* =========================
    //        🔗 MERGE DATA
    //     ========================= */

    //     const finalData = tickets.map(ticket => {

    //         // ticket level files
    //         const files = ticketFiles.filter(f => f.FILE08 === ticket.TKT01);

    //         // messages for ticket
    //         const ticketMsgs = messages
    //             .filter(m => m.MSG02 === ticket.TKT01)
    //             .map(msg => {

    //                 const msgFiles = messageFiles.filter(f => f.FILE08 === msg.MSG01);

    //                 return {
    //                     ...msg,
    //                     files: msgFiles
    //                 };
    //             });

    //         return {
    //             ...ticket,
    //             files,
    //             messages: ticketMsgs
    //         };
    //     });

    //     return res.json({
    //         encryptedResponse: encryptor.encrypt(JSON.stringify({
    //             status: 'SUCCESS',
    //             data: finalData
    //         }))
    //     });
    // }
    static async getTickets(pa, res, decoded) {

        const roleId = Number(decoded.roleId);

        let where = {};

        // 🔐 Role-based filter
        if (roleId !== 1) {
            where.TKT06 = decoded.Id;
        }

        const tickets = await Ticket.findAll({
            where,
            raw: true
        });

        const ticketIds = tickets.map(t => t.TKT01);
        const userIds = tickets.map(t => t.TKT06);
        const users = await User.findAll({
            where: {
                UTF01: {
                    [Op.in]: userIds
                }
            },
            raw: true
        });

        // ✅ No tickets case
        if (!ticketIds.length) {
            return res.status(200).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    message: 'No tickets found',
                    data: []
                }))
            });
        }

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

            return {
                ...formatTicket(ticket),

                // 🔥 ADD DEALER INFO HERE
                User: user ? {
                    id: user.UTF01,
                    name: user.UTF02,
                    roleId: user.UTF03,
                    phone: user.UTF09,
                    email: user.UTF10
                } : null,

                files,
                messages: ticketMsgs
            };
        });

        /* =========================
           📩 Response
        ========================= */
        return res.status(200).json({
            encryptedResponse: encryptor.encrypt(JSON.stringify({
                status: 'SUCCESS',
                message: 'Tickets fetched successfully',
                data: finalData
            }))
        });
    }
    static async replyTicket(pa, res, decoded, req) {

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
        if (ticket.TKT05 === 'CLOSED') {
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
                await EP_FILE.bulkCreate(filesData);
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
    static async updateStatus(pa, res, decoded) {

        const roleId = Number(decoded.roleId);

        if (![1].includes(roleId)) {
            throw new Error('Only admin can update status');
        }

        const { ticket_id, status } = pa;

        if (!ticket_id || !status) {
            throw new Error('Missing fields');
        }

        const allowedStatus = ['OPEN', 'RESOLVED'];

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
            encryptedResponse: encryptor.encrypt(JSON.stringify({
                status: 'SUCCESS',
                message: 'Ticket updated'
            }))
        });
    }
    // static async getTicketDetail(pa, res, decoded) {

    //     const { ticket_id } = pa;

    //     if (!ticket_id) {
    //         throw new Error('ticket_id required');
    //     }

    //     /* =========================
    //        🔍 FETCH TICKET
    //     ========================= */
    //     const ticket = await Ticket.findOne({
    //         where: { TKT01: ticket_id },
    //         raw: true
    //     });

    //     if (!ticket) {
    //         throw new Error('Ticket not found');
    //     }

    //     /* =========================
    //        🔐 ACCESS CONTROL
    //     ========================= */
    //     const roleId = Number(decoded.roleId);

    //     if (![1].includes(roleId) && ticket.TKT06 !== decoded.Id) {
    //         throw new Error('Access denied');
    //     }

    //     /* =========================
    //        📎 TICKET FILES
    //     ========================= */
    //     const ticketFiles = await EP_FILE.findAll({
    //         where: {
    //             FILE07: 'TICKET',
    //             FILE08: ticket_id
    //         },
    //         raw: true
    //     });

    //     /* =========================
    //        💬 MESSAGES
    //     ========================= */
    //     const messages = await TicketMessage.findAll({
    //         where: { MSG02: ticket_id },
    //         order: [['MSG06', 'ASC']],
    //         raw: true
    //     });

    //     const messageIds = messages.map(m => m.MSG01);

    //     /* =========================
    //        📎 MESSAGE FILES
    //     ========================= */
    //     let messageFiles = [];

    //     if (messageIds.length > 0) {
    //         messageFiles = await EP_FILE.findAll({
    //             where: {
    //                 FILE07: 'TICKET_MSG',
    //                 FILE08: {
    //                     [Op.in]: messageIds
    //                 }
    //             },
    //             raw: true
    //         });
    //     }

    //     /* =========================
    //        🔗 MERGE DATA
    //     ========================= */
    //     const formattedMessages = messages.map(msg => {

    //         const files = messageFiles.filter(f => f.FILE08 === msg.MSG01);

    //         return {
    //             ...msg,
    //             files
    //         };
    //     });

    //     const finalData = {
    //         ...ticket,
    //         files: ticketFiles,
    //         messages: formattedMessages
    //     };

    //     return res.json({
    //         encryptedResponse: encryptor.encrypt(JSON.stringify({
    //             status: 'SUCCESS',
    //             data: finalData
    //         }))
    //     });
    // }
    static async getTicketDetail(pa, res, decoded) {

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

        /* =========================
           🔐 Access Control
        ========================= */
        const roleId = Number(decoded.roleId);

        if (roleId !== 1 && ticket.TKT06 !== decoded.Id) {
            throw new Error('Access denied');
        }

        /* =========================
           📎 Ticket Files
        ========================= */
        const ticketFiles = await EP_FILE.findAll({
            where: {
                FILE07: 'TICKET',
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
            ...formatTicket(ticket),

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


}


module.exports = TicketController;