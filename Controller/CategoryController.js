const querystring = require('querystring');
const db = require('../Config/config');
const { Sequelize } = require('sequelize');

const defineTicketMaster = require('../Models/RDB/TICKETMASTER');
const sequelizeRDB = db.getConnection('RDB');
const TicketMaster = defineTicketMaster(sequelizeRDB, Sequelize.DataTypes);

const Encryptor = require('../Services/encryptor');
const TokenService = require('../Services/tokenServices');

const encryptor = new Encryptor();

/* =========================
   🔧 FORMATTER
========================= */
const formatCategory = (c) => ({
    id: c.CAT01,
    name: c.CAT02,
    assignedRole: c.CAT03
});

class CategoryController {

    static async manageCategory(req, res) {

        let response = { status: 'SUCCESS', message: '', data: null };

        try {

            /* =========================
               🔐 TOKEN VALIDATION
            ========================= */
            const token = req.headers['authorization']?.split(' ')[1];

            if (!token) {
                response.status = 'FAIL';
                response.message = 'Authorization token missing';

                return res.status(401).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            const decoded = await TokenService.validateToken(token);

            /* =========================
               🔓 GET PARAM (QUERY)
            ========================= */
            if (!req.query.pa) {
                response.status = 'FAIL';
                response.message = 'Encrypted parameter missing';

                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            const decrypted = encryptor.decrypt(req.query.pa);
            const pa = querystring.parse(decodeURIComponent(decrypted));

            const { action, id, name } = pa;

            if (!action) {
                response.status = 'FAIL';
                response.message = 'Action is required';

                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            /* =========================
               🎯 ACTION ROUTER
            ========================= */

            switch (action) {

                /* =========================
                   ➕ CREATE
                ========================= */
                case 'C': {

                    if (!name) {
                        throw new Error('Category name required');
                    }

                    const exists = await TicketMaster.findOne({
                        where: { CAT02: name, CAT04: 1 }
                    });

                    if (exists) {
                        throw new Error('Category already exists');
                    }

                    const created = await TicketMaster.create({
                        CAT02: name,
                        CAT03: null
                    });

                    response.message = 'Category created';
                    response.data = formatCategory(created);

                    return res.status(200).json({
                        encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                    });
                }

                /* =========================
                   📥 GET
                ========================= */
                case 'G': {

                    const categories = await TicketMaster.findAll({
                        where: { CAT04: 1 },
                        raw: true
                    });

                    response.message = 'Categories fetched';
                    response.data = categories.map(formatCategory);

                    return res.status(200).json({
                        encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                    });
                }

                /* =========================
                   ✏️ UPDATE
                ========================= */
                case 'U': {

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
                        { CAT02: name },
                        { where: { CAT01: id } }
                    );

                    const updated = await TicketMaster.findOne({
                        where: { CAT01: id },
                        raw: true
                    });

                    response.message = 'Category updated';
                    response.data = formatCategory(updated);

                    return res.status(200).json({
                        encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                    });
                }

                /* =========================
                   ❌ DELETE
                ========================= */
                case 'D': {

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

                    response.message = 'Category deleted';
                    response.data = { id };

                    return res.status(200).json({
                        encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                    });
                }

                default:
                    throw new Error('Invalid action');
            }

        } catch (error) {

            console.error("manageCategory Error:", error.message);

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: error.message
                }))
            });
        }
    }
}

module.exports = CategoryController;