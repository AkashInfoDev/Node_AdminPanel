const { fn, col, where } = require('sequelize');
const querystring = require('querystring');
const Encryptor = require('../Services/encryptor');
const db = require('../Config/config'); // Your Database class
const TokenService = require('../Services/tokenServices');

const definePLRDBA02 = require('../Models/RDB/PLRDBA02'); // Model factory
const ADMIController = require('./ADMIController');

const sequelizeRDB = db.getConnection('RDB');

const PLRDBA02 = definePLRDBA02(sequelizeRDB);

const encryptor = new Encryptor();

class PricingPlanController {

    static async handleAction(req, res) {
        const parameterString = encryptor.decrypt(req.query.pa);
        let decodedURL = decodeURIComponent(parameterString);
        let pa = querystring.parse(decodedURL);
        let response = { data: null, message: '', status: 'SUCCESS' }
        const {
            action,
            A02F01,
            A02F02,
            A02F03,
            A02F04,
            A02F05,
            A02F06,
            A02F07,
            A02F08,
            A02F09,
            A02F10,
            A02F11,
            A02F12
        } = pa;
        const token = req.headers['authorization']?.split(' ')[1]; // 'Bearer <token>'
        if (!token) {
            response.message = 'No token provided, authorization denied.'
            response.status = 'FAIL'
            const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(401).json({ encryptedResponse });
        }

        const decoded = await TokenService.validateToken(token);
        const decryptedId = encryptor.decrypt(decoded.userId);
        let sdbseq = (decoded.corpId).split('-');
        let sdbdbname = sdbseq.length == 3 ? sdbseq[0] + sdbseq[1] + sdbseq[2] + 'SDB' : sdbseq[0] + sdbseq[1] + 'SDB';
        let admi = new ADMIController(sdbdbname)
        const existing = await admi.findAll();
            for (let i of existing) {
                const decrypted = encryptor.decrypt(i.ADMIF01);
                if (decrypted === decryptedId) {
                    // response.status = 'FAIL';
                    // response.message = 'User ID is already registered';
                    // const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    // return res.status(400).json({ encryptedResponse: encryptedResponse });
                }
            }

        // if (!user) {
        //     response.message = 'Unauthorized: User not found or inactive'
        //     const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        //     return res.status(403).json({ encryptedResponse });
        // }

        try {
            switch (action) {
                case 'A':
                    const planNameUpper = A02F02?.toUpperCase()?.trim();

                    // Check if the plan name already exists
                    const existingPlan = await PLRDBA02.findOne({
                        attributes: ['A02F02'],
                        where: where(
                            fn('UPPER', col('A02F02')),
                            planNameUpper
                        )
                    });

                    if (existingPlan) {
                        response.message = 'Plan name already exists';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(409).json({ encryptedResponse });
                    }

                    // Create the new plan
                    const newPlan = await PLRDBA02.create({
                        A02F02,
                        A02F03,
                        A02F04,
                        A02F05,
                        A02F06,
                        A02F07,
                        A02F08,
                        A02F09,
                        A02F10,
                        A01F11,  // Branch count field
                        A02F12   // Comma-separated menu IDs
                    });

                    response.message = 'Plan created successfully';
                    response.data = newPlan;
                    const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(201).json({ encryptedResponse });

                case 'E':
                    if (!A02F01) {
                        response.message = 'A02F01 (ID) is required for editing.';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(400).json({ encryptedResponse });
                    }

                    // Update the plan with new values, including A01F11 and A02F12
                    const [updated] = await PLRDBA02.update({
                        A02F02,
                        A02F03,
                        A02F04,
                        A02F05,
                        A02F06,
                        A02F07,
                        A02F08,
                        A02F09: A02F09 === '1' ? 1 : 0,
                        A02F10,
                        A01F11,  // Branch count field
                        A02F12   // Comma-separated menu IDs
                    }, {
                        where: { A02F01 }
                    });

                    if (updated) {
                        response.message = 'Record updated successfully';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.json({ encryptedResponse });
                    } else {
                        response.message = 'Record not found';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(404).json({ encryptedResponse });
                    }

                case 'D':
                    if (!A02F01) {
                        response.message = 'A02F01 (ID) is required for deletion.';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(400).json({ encryptedResponse });
                    }

                    const deleted = await PLRDBA02.update({
                        A02F09: '0'  // Soft delete by updating A02F09
                    }, {
                        where: { A02F01 }
                    });

                    if (deleted) {
                        response.message = 'Record deleted successfully';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.json({ encryptedResponse });
                    } else {
                        response.message = 'Record not found';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(404).json({ encryptedResponse });
                    }

                case 'R':
                    if (!A02F01) {
                        response.message = 'A02F01 (ID) is required for restoring.';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(400).json({ encryptedResponse });
                    }

                    const restored = await PLRDBA02.update({
                        A02F09: 1  // Restore by updating A02F09
                    }, {
                        where: { A02F01: A02F01 }
                    });

                    if (restored) {
                        response.message = 'Record restored successfully';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.json({ encryptedResponse });
                    } else {
                        response.message = 'Record not found';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(404).json({ encryptedResponse });
                    }

                case 'G':
                    const getAllList = await PLRDBA02.findAll({
                        where: { A02F09: '1' }
                    });

                    if (getAllList) {
                        response.message = 'All Price List';
                        response.data = getAllList
                        const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.json({ encryptedResponse });
                    } else {
                        response.message = 'No Records Found';
                        const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(404).json({ encryptedResponse });
                    }

                default:
                    response.message = 'Invalid or missing action. Use A, E, D, or G.'
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(400).json({ encryptedResponse });
            }
        } catch (error) {
            console.error('Error in PricingPlanController:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = PricingPlanController;
