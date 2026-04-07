const querystring = require('querystring');
const TokenService = require('../Services/tokenServices');
const Encryptor = require('../Services/encryptor');
const PLRDBA02Controller = require('./PLRDBA02Controller');
const { fn, col, where } = require('sequelize');

const encryptor = new Encryptor();
const planRepo = new PLRDBA02Controller();

class AdminPlanController {

    static async managePlans(req, res) {
        let response = { status: 'SUCCESS', message: '', data: null };

        try {
            /* ==========================
             * 🔐 TOKEN VALIDATION
             * ========================== */
            const token = req.headers['authorization']?.split(' ')[1];
            if (!token) {
                response.status = 'FAIL';
                response.message = 'Authorization token missing';
                return AdminPlanController.send(res, response, 401);
            }

            const decoded = await TokenService.validateToken(token);
            if (decoded.roleId !== 1) {
                response.status = 'FAIL';
                response.message = 'Access denied';
                return AdminPlanController.send(res, response, 403);
            }

            /* ==========================
             * 🔓 DECRYPT PARAMS
             * ========================== */
            if (!req.query.pa) {
                response.status = 'FAIL';
                response.message = 'Encrypted parameter missing';
                return AdminPlanController.send(res, response, 400);
            }

            const pa = querystring.parse(
                decodeURIComponent(encryptor.decrypt(req.query.pa))
            );

            const action = pa.action;

            /* ==========================
             * 📥 COMMON PARAMS
             * ========================== */
            const planId = pa.planId;           // A02F01
            const planName = pa.planName;       // A02F02
            const planTagline = pa.planTagline; // A02F03
            const description = pa.description; // A02F04
            const yearlyPrice = pa.yearlyPrice; // A02F05
            const monthlyPrice = pa.monthlyPrice; // A02F06
            const noOfUsers = pa.noOfUsers;     // A02F07
            const noOfCompanies = pa.noOfCompanies; // A02F08
            const isActive = pa.isActive;       // A02F09
            const planType = pa.planType;       // A02F10
            const noOfBranches = pa.noOfBranches; // A02F11
            const modules = pa.modules;         // A02F12
            const planCategory = pa.planCategory; // A02F13
            const planValue = pa.planValue;     // A02F14

            /* ==========================
             * 🎯 ACTION ROUTER
             * ========================== */
            switch (action) {

                /* ==========================
                 * G → GET ALL (CATEGORY-WISE)
                 * ========================== */
                case 'G': {
                    const records = await planRepo.findAll(
                        { A02F09: 1 },
                        [['A02F13', 'ASC'], ['A02F01', 'ASC']]
                    );

                    const plans = [];
                    const generalAddOns = [];
                    const companyAddOns = [];

                    records.forEach(r => {
                        if (r.A02F13 === 1) plans.push(r);
                        else if (r.A02F13 === 2) generalAddOns.push(r);
                        else if (r.A02F13 === 3) companyAddOns.push(r);
                    });
                    response.status = 'SUCCESS';
                    response.message = 'Plan master details fetched successfully';
                    response.data = {
                        planDetails: {
                            data: plans
                        },
                        generalAddOnDetails: {
                            data: generalAddOns
                        },
                        companyAddOnDetails: {
                            data: companyAddOns
                        }
                    };

                    return AdminPlanController.send(res, response);
                }
                /* ==========================
                 * A → ADD
                 * ========================== */
                case 'A': {
                    if (!planName || !planCategory) {
                        response.status = 'FAIL';
                        response.message = 'planName and planCategory are required';
                        return AdminPlanController.send(res, response, 400);
                    }

                    const existing = await planRepo.findOne(
                        where(fn('UPPER', col('A02F02')), planName.trim().toUpperCase())
                    );

                    if (existing && existing.A02F13 === Number(planCategory)) {
                        response.status = 'FAIL';
                        response.message = 'Record already exists in this category';
                        return AdminPlanController.send(res, response, 409);
                    }

                    const created = await planRepo.create({
                        A02F02: planName,
                        A02F03: planTagline,
                        A02F04: description,
                        A02F05: yearlyPrice,
                        A02F06: monthlyPrice,
                        A02F07: noOfUsers,
                        A02F08: noOfCompanies,
                        A02F09: 1,
                        A02F10: planType,
                        A02F11: noOfBranches || 0,
                        A02F12: modules || null,
                        A02F13: planCategory,
                        A02F14: planValue || 0
                    });
                    response.status = 'SUCCESS';
                    response.message = 'Record created successfully';
                    response.data = created;
                    return AdminPlanController.send(res, response, 201);
                }

                /* ==========================
                 * E → EDIT
                 * ========================== */
                case 'E': {
                    if (!planId) {
                        response.status = 'FAIL';
                        response.message = 'planId is required';
                        return AdminPlanController.send(res, response, 400);
                    }

                    const affected = await planRepo.update(
                        {
                            A02F02: planName,
                            A02F03: planTagline,
                            A02F04: description,
                            A02F05: yearlyPrice,
                            A02F06: monthlyPrice,
                            A02F07: noOfUsers,
                            A02F08: noOfCompanies,
                            A02F09: isActive,
                            A02F10: planType,
                            A02F11: noOfBranches,
                            A02F12: modules,
                            A02F14: planValue
                        },
                        { A02F01: planId }
                    );

                    if (!affected) {
                        response.status = 'FAIL';
                        response.message = 'Record not found';
                        return AdminPlanController.send(res, response, 404);
                    }

                    response.message = 'Record updated successfully';
                    return AdminPlanController.send(res, response);
                }

                /* ==========================
                 * P → SOFT DELETE
                 * ========================== */
                case 'P': {
                    if (!planId) {
                        response.status = 'FAIL';
                        response.message = 'planId is required';
                        return AdminPlanController.send(res, response, 400);
                    }

                    await planRepo.update({ A02F09: 0 }, { A02F01: planId });
                    response.message = 'Record deactivated successfully';
                    return AdminPlanController.send(res, response);
                }


                /* ==========================
                 * R → RESTORE
                 * ========================== */
                case 'R': {
                    if (!pa.A02F01) {
                        response.status = 'FAIL';
                        response.message = 'A02F01 is required';
                        return AdminPlanController.send(res, response, 400);
                    }

                    await planRepo.update({ A02F09: 1 }, { A02F01: planId });
                    response.status = 'SUCCESS';
                    response.message = 'Record restored successfully';
                    return AdminPlanController.send(res, response);
                }

                /* ==========================
                 * D → PERMANENT DELETE
                 * ========================== */
                case 'D': {
                    if (!planId) {
                        response.status = 'FAIL';
                        response.message = 'planId is required';
                        return AdminPlanController.send(res, response, 400);
                    }

                    const deleted = await planRepo.destroy({ A02F01: planId });
                    if (!deleted) {
                        response.status = 'FAIL';
                        response.message = 'Record not found';
                        return AdminPlanController.send(res, response, 404);
                    }
                    response.status = 'SUCCESS';
                    response.message = 'Record permanently deleted';
                    return AdminPlanController.send(res, response);
                }


                default:
                    response.status = 'FAIL';
                    response.message = 'Invalid action';
                    return AdminPlanController.send(res, response, 400);
            }

        } catch (err) {
            console.error('AdminPlanController error:', err);
            response.status = 'FAIL';
            response.message = 'Server error';
            return AdminPlanController.send(res, response, 500);
        }
    }

    static send(res, response, status = 200) {
        const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        return res.status(status).json({ encryptedResponse });
    }
}

module.exports = AdminPlanController;