const db = require('../Config/config');
const { Sequelize } = require('sequelize');

const defineEPTRNS = require('../Models/RDB/EP_TRNS');
const definePLRDBPYMT = require('../Models/RDB/PLRDBPYMT');
const definePLRDBA01 = require('../Models/RDB/PLRDBA01');
const defineEPUser = require('../Models/RDB/EP_USER');
const defineEP_FILE = require('../Models/RDB/EP_FILE');

const Encryptor = require('../Services/encryptor');
const TokenService = require('../Services/tokenServices');


const sequelizeRDB = db.getConnection('RDB');
const EP_FILE = defineEP_FILE(sequelizeRDB, require('sequelize').DataTypes);

const EP_TRNS = defineEPTRNS(sequelizeRDB);
const PLRDBPYMT = definePLRDBPYMT(sequelizeRDB);
const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const EPUser = defineEPUser(sequelizeRDB);

const encryptor = new Encryptor();

class WalletController {

    static async handleWallet(req, res) {

        let response = { status: 'SUCCESS', message: '', data: null };

        try {

            const token = req.headers['authorization']?.split(' ')[1];

            if (!token) {
                response.status = 'FAIL';
                response.message = 'Authorization token missing';
                return res.status(401).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            const decoded = await TokenService.validateToken(token);

            if (!req.query.pa) {
                response.status = 'FAIL';
                response.message = 'Encrypted parameter missing';
                return res.status(400).json({
                    encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                });
            }

            const decrypted = encryptor.decrypt(req.query.pa);
            const pa = require('querystring').parse(decodeURIComponent(decrypted));

            const action = pa.action;

            /* =========================
               🎯 WALLET ACTION ROUTER
            ========================= */

            switch (action) {

                case 'W':
                    // return WalletController.requestWithdraw(pa, res, decoded);
                    return WalletController.requestWithdraw(req, pa, res, decoded);

                case 'G':
                    return WalletController.getWallet(res, decoded);

                case 'WA':
                    return WalletController.approveWithdraw(pa, res, decoded);

                case 'WR':
                    return WalletController.rejectWithdraw(pa, res, decoded);
                case 'WT': // Wallet Transactions
                    return WalletController.getDealerTransactions(res, decoded);



                default:
                    response.status = 'FAIL';
                    response.message = 'Invalid action';

                    return res.status(400).json({
                        encryptedResponse: encryptor.encrypt(JSON.stringify(response))
                    });
            }

        } catch (err) {

            console.error(err);

            response.status = 'FAIL';
            response.message = 'Server error';

            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify(response))
            });
        }
    }


    static async getDealerWallet(dealerId) {

        const rows = await sequelizeRDB.query(`
        SELECT 
            p.PYMT05 AS amount,
            u.UTF12 AS commission
        FROM PLRDBPYMT p
        LEFT JOIN PLRDBA01 c 
            ON p.PYMT01 = LTRIM(RTRIM(c.A01F03))
        LEFT JOIN EP_USER u 
            ON c.A01F19 = u.UTF01
        WHERE u.UTF01 = :dealerId
    `, {
            replacements: { dealerId },
            type: Sequelize.QueryTypes.SELECT
        });

        let totalEarning = 0;
        let commissionPercent = 0;

        for (let r of rows) {
            const amt = parseFloat(r.amount) || 0;
            const comm = parseFloat(r.commission) || 0;

            // ✅ capture commission %
            if (!commissionPercent && comm) {
                commissionPercent = comm;
            }

            totalEarning += (amt * comm) / 100;
        }

        const withdrawn = await EP_TRNS.sum('TRN03', {
            where: { TRN02: dealerId, TRN05: 'COMPLETED' }
        }) || 0;

        const pending = await EP_TRNS.sum('TRN03', {
            where: { TRN02: dealerId, TRN05: 'PENDING' }
        }) || 0;

        return {
            commissionPercent, // 🔥 ADDED
            totalEarning,
            withdrawn,
            pending,
            availableBalance: totalEarning - withdrawn - pending
        };
    }

    /* =========================
       💰 WALLET CALCULATION
    ========================= */


    static async getDealerId(decoded) {

        const user = await EPUser.findOne({
            where: {
                UTF04: decoded.userId, // 🔥 MATCH ENCRYPTED VALUE
                UTF07: 'N'
            }
        });

        if (!user) {
            throw new Error("Dealer not found");
        }

        return user.UTF01; // ✅ actual numeric ID
    }
    /* =========================
       📊 WALLET SUMMARY
    ========================= */
    static async getWallet(res, decoded) {

        const dealerId = await WalletController.getDealerId(decoded);

        // 🔥 MISSING LINE (THIS IS THE FIX)
        const wallet = await WalletController.getDealerWallet(dealerId);

        return res.json({
            encryptedResponse: encryptor.encrypt(JSON.stringify({
                status: 'SUCCESS',
                data: wallet
            }))
        });
    }

    /* =========================
       🏦 WITHDRAW REQUEST
    ========================= */
   
    static async requestWithdraw(req, res) {
        try {

            const token = req.headers['authorization']?.split(' ')[1];

            if (!token) {
                throw new Error("Token missing");
            }

            const decoded = await TokenService.validateToken(token);

            const encryptedPa = req.body.pa;

            if (!encryptedPa) {
                throw new Error("pa missing");
            }

            const parameterString = encryptor.decrypt(encryptedPa);
            const pa = require('querystring').parse(decodeURIComponent(parameterString));

            const dealerId = await WalletController.getDealerId(decoded);
            const amount = Number(pa.amount);

            if (!amount || amount <= 0) {
                throw new Error("Invalid amount");
            }

            const wallet = await WalletController.getDealerWallet(dealerId);

            if (amount > wallet.availableBalance) {
                throw new Error("Insufficient balance");
            }

            /* =========================
               🧾 CREATE TRANSACTION
            ========================= */

            const txn = await EP_TRNS.create({
                TRN02: dealerId,
                TRN03: amount,
                TRN05: 'PENDING',
                TRN07: Sequelize.literal('GETDATE()'),
                TRN15: 'WITHDRAW_REQUEST'
            });

            /* =========================
               📄 FILE UPLOAD
            ========================= */

            if (req.file) {

                const base64 = req.file.buffer.toString('base64');

                await EP_FILE.create({
                    FILE02: req.file.originalname,
                    FILE03: base64,
                    FILE04: dealerId
                });
            }

            return res.json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    message: 'Withdraw request submitted',
                    data: txn
                }))
            });

        } catch (err) {
            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: err.message
                }))
            });
        }
    }

    /* =========================
       ✅ APPROVE
    ========================= */
    static async approveWithdraw(pa, res, decoded) {
        try {
            const adminId = await WalletController.getDealerId(decoded);
            const txn = await EP_TRNS.findByPk(pa.trnId);

            if (!txn) throw new Error("Transaction not found");

            await txn.update({
                TRN05: 'COMPLETED',
                // TRN06: new Date(),
                TRN06: Sequelize.literal('GETDATE()'), // ✅ FIX
                // TRN08: decoded.userId,
                TRN04: pa.method,
                TRN08: adminId,
                TRN09: pa.referenceNo || ('TXN' + Date.now()),
                TRN15: 'WITHDRAW_APPROVED'
            });

            return res.json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    message: 'Withdraw approved'
                }))
            });

        } catch (err) {
            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: err.message
                }))
            });
        }
    }

    /* =========================
       ❌ REJECT
    ========================= */
    static async rejectWithdraw(pa, res, decoded) {
        try {

            const txn = await EP_TRNS.findByPk(pa.trnId);

            if (!txn) throw new Error("Transaction not found");

            await txn.update({
                TRN05: 'REJECTED',
                TRN08: decoded.userId,
                TRN15: 'WITHDRAW_REJECTED'
            });

            return res.json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    message: 'Withdraw rejected'
                }))
            });

        } catch (err) {
            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: err.message
                }))
            });
        }
    }
   
    static async getDealerTransactions(res, decoded) {
        try {

            const roleId = Number(decoded.roleId);

            let whereClause = `t.TRN11 = 'N'`;

            /* =========================
               🔥 ROLE BASED FILTER
            ========================= */

            if (![1, 2].includes(roleId)) {
                const dealerId = await WalletController.getDealerId(decoded);
                whereClause += ` AND t.TRN02 = ${dealerId}`;
            }

            /* =========================
               1️⃣ RAW QUERY (JOIN)
            ========================= */

            const rows = await sequelizeRDB.query(`
            SELECT 
                t.*,
                u.UTF02 AS dealerName
            FROM EP_TRNS t
            LEFT JOIN EP_USER u 
                ON t.TRN02 = u.UTF01
            WHERE ${whereClause}
            ORDER BY t.TRN01 DESC
        `, {
                type: Sequelize.QueryTypes.SELECT
            });

            /* =========================
               2️⃣ SUMMARY
            ========================= */

            let totalRequested = 0;
            let totalApproved = 0;
            let totalPending = 0;

            const formatted = rows.map(t => {

                const amount = parseFloat(t.TRN03) || 0;

                totalRequested += amount;

                if (t.TRN05 === 'COMPLETED') totalApproved += amount;
                if (t.TRN05 === 'PENDING') totalPending += amount;

                return {
                    id: t.TRN01,
                    dealerId: t.TRN02,
                    dealerName: t.dealerName || null, // 🔥 FIXED
                    amount,
                    method: t.TRN04,
                    status: t.TRN05,
                    requestDate: t.TRN07,
                    approvedDate: t.TRN06,
                    reference: t.TRN09,
                    type: t.TRN15
                };
            });

            /* =========================
               3️⃣ RESPONSE
            ========================= */

            return res.json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'SUCCESS',
                    data: {
                        summary: {
                            totalRequested,
                            totalApproved,
                            totalPending
                        },
                        transactions: formatted
                    }
                }))
            });

        } catch (err) {
            return res.status(500).json({
                encryptedResponse: encryptor.encrypt(JSON.stringify({
                    status: 'FAIL',
                    message: err.message
                }))
            });
        }
    }
}

module.exports = WalletController;