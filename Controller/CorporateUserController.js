const db = require('../Config/config');
const definePLRDBA01 = require('../Models/RDB/PLRDBA01');
const TokenService = require('../Services/tokenServices');
const Encryptor = require('../Services/encryptor');
const ADMIController = require('./ADMIController');
const querystring = require('querystring');

const sequelizeRDB = db.getConnection('RDB');
const PLRDBA01 = definePLRDBA01(sequelizeRDB);

const encryptor = new Encryptor();

class CorporateUserController {

    static async manageCorporateUser(req, res) {

        let response = {
            status: 'SUCCESS',
            message: '',
            data: null
        };

        try {

            /* =========================
               TOKEN VALIDATION
            ========================= */

            const token =
                req.headers['authorization']?.split(' ')[1];

            if (!token) {

                response.status = 'FAIL';
                response.message = 'Token missing';

                return res.status(401).json({
                    encryptedResponse:
                        encryptor.encrypt(
                            JSON.stringify(response)
                        )
                });
            }

            await TokenService.validateToken(token);

            /* =========================
               REQUEST PARAMS
            ========================= */

            /* =========================
                DECRYPT REQUEST PARAMS
            ========================= */

            if (!req.query.pa) {

                response.status = 'FAIL';
                response.message = 'Encrypted parameter missing';

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

            const action =
                String(pa.action || '')
                    .trim()
                    .toUpperCase();

            const corporateId = pa.corporateId;
            const password = pa.password;
            const email = pa.email;

            if (!corporateId) {

                response.status = 'FAIL';
                response.message = 'corporateId required';

                return res.status(400).json({
                    encryptedResponse:
                        encryptor.encrypt(
                            JSON.stringify(response)
                        )
                });
            }

            /* =========================
               CORPORATE LOOKUP
            ========================= */

            const corpId =
                corporateId.trim().toUpperCase();

            const corp =
                await PLRDBA01.findOne({
                    where: {
                        A01F03: corpId
                    },
                    attributes: ['A01F01']
                });

            if (!corp) {

                response.status = 'FAIL';
                response.message =
                    'Corporate not found';

                return res.status(404).json({
                    encryptedResponse:
                        encryptor.encrypt(
                            JSON.stringify(response)
                        )
                });
            }

            const corpUnq =
                String(corp.A01F01).trim();

            /* =========================
               BUILD SDB NAME
            ========================= */

            const parts = corpId.split('-');

            let sdbName =
                parts.length === 3
                    ? `${parts[0]}${parts[1]}${parts[2]}SDB`
                    : `${parts[0]}${parts[1]}SDB`;

            if (sdbName === 'PLP00001SDB') {
                sdbName = 'A00001SDB';
            }

            const admi =
                new ADMIController(sdbName);

            let updateData = {};

            /* =========================
               PASSWORD UPDATE
            ========================= */

            if (action === 'P') {

                if (!password) {

                    response.status = 'FAIL';
                    response.message =
                        'password required';

                    return res.status(400).json({
                        encryptedResponse:
                            encryptor.encrypt(
                                JSON.stringify(response)
                            )
                    });
                }

                updateData.ADMIF05 =
                    encryptor.encrypt(password);

                response.message =
                    'Password updated successfully';
            }

            /* =========================
               EMAIL UPDATE
            ========================= */

            else if (action === 'E') {

                if (!email) {

                    response.status = 'FAIL';
                    response.message =
                        'email required';

                    return res.status(400).json({
                        encryptedResponse:
                            encryptor.encrypt(
                                JSON.stringify(response)
                            )
                    });
                }

                updateData.ADMIF07 =
                    email.trim();

                response.message =
                    'Email updated successfully';
            }

            else {

                response.status = 'FAIL';
                response.message = 'Invalid action';

                return res.status(400).json({
                    encryptedResponse:
                        encryptor.encrypt(
                            JSON.stringify(response)
                        )
                });
            }

            /* =========================
               UPDATE SUPER USER
            ========================= */

            const updated =
                await admi.update(
                    updateData,
                    {
                        ADMIF06: 2,
                        ADMICORP: corpUnq
                    }
                );

            if (!updated || updated === 0) {

                response.status = 'FAIL';
                response.message =
                    'User not found or update failed';

                return res.status(404).json({
                    encryptedResponse:
                        encryptor.encrypt(
                            JSON.stringify(response)
                        )
                });
            }

            return res.status(200).json({
                encryptedResponse:
                    encryptor.encrypt(
                        JSON.stringify(response)
                    )
            });

        } catch (err) {

            console.error(
                'manageCorporateUser error:',
                err
            );

            response.status =  'FAIL';
            response.message = 'Server Error';

            return res.status(500).json({
                encryptedResponse:
                    encryptor.encrypt(
                        JSON.stringify(response)
                    )
            });
        }
    }
}

module.exports = CorporateUserController;