const querystring = require('querystring');
const TokenService = require('../Services/tokenServices');
const Encryptor = require('../Services/encryptor');
const PLRDBPLRELController = require('./PLRDBPLRELController');
const db = require('../Config/config');
const sequelizeRDB = db.getConnection('RDB');
const defineUserTypes = require('../Models/RDB/EP_USERTPYES');
const UserTypes = defineUserTypes(sequelizeRDB, require('sequelize').DataTypes);
const encryptor = new Encryptor();
const ModuleRepo = new PLRDBPLRELController();


function validateComboModule(ModuleType, ModuleCode) {
    if (ModuleType !== 'C') return null;

    if (!ModuleCode)
        return 'Combo module requires at least 2 module IDs';

    // const ids = ModuleCode
    //     .split(',')
    //     .map(v => v.trim())
    //     .filter(v => v.length);

    const ids = extractSetupIds(ModuleCode);

    if (ids.length < 2)
        return 'Combo module must contain minimum 2 module IDs';

    return null;
}


function extractSetupIds(value) {
    if (!value) return [];

    const afterDash = value.includes('-')
        ? value.split('-').pop().trim()
        : value.trim();

    return afterDash
        .split(',')
        .map(v => v.trim())
        .filter(v => v.length);
}
async function checkDuplicate(ModuleType, ModuleCode) {

    const rows = await ModuleRepo.findAll();

    if (ModuleType === 'M') {
        return rows.some(r =>
            r.RELF03 === ModuleType &&
            r.RELF01.trim() === ModuleCode.trim()
        );
    }

    if (ModuleType === 'C') {

        const normalize = str => {
            const ids = extractSetupIds(str);
            return ids.sort().join(',');
        };

        const newCombo = normalize(ModuleCode);

        return rows.some(r =>
            r.RELF03 === 'C' &&
            normalize(r.RELF01) === newCombo
        );
    }

    return false;
}



class AdminModuleController {
    static cachedRoles = null;

    static async checkRoleAccess(roleId) {

        if (!this.cachedRoles) {
            const roles = await UserTypes.findAll({
                attributes: ['ID'],
                raw: true
            });

            this.cachedRoles = roles.map(r => Number(r.ID));
        }

        return this.cachedRoles.includes(Number(roleId));
    }

    static async manageAddOns(req, res) {
        let response = { status: 'SUCCESS', message: '', data: null };

        try {
            /* =========================
             * 🔐 TOKEN VALIDATION
             * ========================= */
            const token = req.headers['authorization']?.split(' ')[1];
            if (!token) {
                response.status = 'FAIL';
                response.message = 'Authorization token missing';
                return AdminModuleController.send(res, response, 401);
            }

            const decoded = await TokenService.validateToken(token);
            // Allow all roles to READ
            const roleId = Number(decoded.roleId);

            const isAllowed = await AdminModuleController.checkRoleAccess(roleId);

            if (!isAllowed) {
                response.status = 'FAIL';
                response.message = 'Access denied';
                return AdminModuleController.send(res, response, 403);
            }

            /* =========================
             * 🔓 DECRYPT PARAMS
             * ========================= */
            if (!req.query.pa) {
                response.status = 'FAIL';
                response.message = 'Encrypted parameter missing';
                return AdminModuleController.send(res, response, 400);
            }

            const pa = querystring.parse(
                decodeURIComponent(encryptor.decrypt(req.query.pa))
            );

            /* =========================
             * 📥 PARAMS
             * ========================= */
            const action = pa.action;
            const moduleID = pa.moduleID;       // RELF00
            const ModuleCode = pa.ModuleCode;   // RELF01
            const price = pa.price;           // RELF02
            const ModuleType = pa.ModuleType;   // RELF03 (M / C / S)


            /* =========================
             * 🎯 ACTION ROUTER
             * ========================= */
            switch (action) {

                /* =========================
                 * G → GET ALL (GROUPED)
                 * ========================= */

                case 'G': {
                    // 1️⃣ Fetch all records
                    const records = await ModuleRepo.findAll(
                        {},
                        [['RELF03', 'ASC'], ['RELF00', 'ASC']]
                    );

                    // 2️⃣ Group with transformed keys
                    const menuDetails = [];
                    const comboMenuDetails = [];
                    const setupDetails = [];

                    records.forEach(row => {
                        const mapped = {
                            moduleID: row.RELF00,
                            ModuleCode: row.RELF01,
                            price: row.RELF02,
                            ModuleType: row.RELF03,
                            menuId: row.RELF04
                        };

                        switch (row.RELF03) {
                            case 'M':
                                menuDetails.push(mapped);
                                break;
                            case 'C':
                                comboMenuDetails.push(mapped);
                                break;
                            case 'S':
                                setupDetails.push(mapped);
                                break;
                        }
                    });

                    // 3️⃣ Final response
                    response.status = 'SUCCESS';
                    response.message = 'Module details fetched successfully';
                    response.data = {
                        menuDetails: {
                            ModuleType: 'M',
                            data: menuDetails
                        },
                        comboMenuDetails: {
                            ModuleType: 'C',
                            data: comboMenuDetails
                        },
                        setupDetails: {
                            ModuleType: 'S',
                            data: setupDetails
                        }
                    };

                    return AdminModuleController.send(res, response);
                }

                case 'A': {

                    if (!ModuleCode || !ModuleType) {
                        response.status = 'FAIL';
                        response.message = 'ModuleCode and ModuleType are required';
                        return AdminModuleController.send(res, response, 400);
                    }

                    /* validate combo */
                    const comboError = validateComboModule(ModuleType, ModuleCode);

                    /* duplicate check */
                    const exists = await checkDuplicate(ModuleType, ModuleCode);

                    if (exists) {
                        response.status = 'FAIL';
                        response.message = 'Module already added';
                        return AdminModuleController.send(res, response, 400);
                    }

                    if (comboError) {
                        response.status = 'FAIL';
                        response.message = comboError;
                        return AdminModuleController.send(res, response, 400);
                    }


                    if (ModuleType === 'S') {

                        const codes = extractSetupIds(ModuleCode);

                        if (codes.length > 0) {
                            await sequelizeRDB.query(`
            UPDATE IDBAPI.dbo.PLSYSF02
            SET F02PYBL = 'Y'
            WHERE F02F01 IN (:codes)
            AND F02PYBL <> 'Y'
        `, {
                                replacements: { codes }
                            });
                        }
                    }
                    let relf04Value = null;

                    if (ModuleType === 'S' && pa.menuId) {
                        relf04Value = pa.menuId
                            .split(',')
                            .map(id => id.trim())
                            .filter(id => id.length)
                            .sort()          // optional but recommended
                            .join(',');      // 👈 NO SPACE
                    }

                    /* =========================
                       Insert Module (FULL LABEL)
                       ========================= */
                    const record = await ModuleRepo.create({
                        RELF01: ModuleCode,
                        RELF02: price || 0,
                        RELF03: ModuleType,
                        RELF04: relf04Value   // 👈 store menuId or NULL
                    });
                    response.status = 'SUCCESS';
                    response.message = 'Module created successfully';
                    response.data = record;
                    return AdminModuleController.send(res, response, 201);
                }

                case 'E': {

                    if (!moduleID) {
                        response.status = 'FAIL';
                        response.message = 'moduleID is required';
                        return AdminModuleController.send(res, response, 400);
                    }

                    // 1️⃣ Fetch existing record
                    const existing = await ModuleRepo.findOne({ RELF00: moduleID });

                    if (!existing) {
                        response.status = 'FAIL';
                        response.message = 'Module not found';
                        return AdminModuleController.send(res, response, 404);
                    }

                    let relf04Value = existing.RELF04;

                    // ✅ Allow edit for ALL module types
                    let updatedModuleCode = pa.ModuleCode
                        ? pa.ModuleCode.trim()
                        : existing.RELF01;

                    /* =========================
                       🟢 SETUP TYPE HANDLING
                       ========================= */
                    if (existing.RELF03 === 'S') {

                        // 2️⃣ If ModuleCode changed → revert old & activate new
                        if (
                            pa.ModuleCode &&
                            pa.ModuleCode.trim() !== existing.RELF01.trim()
                        ) {

                            // 🔴 Revert old setup IDs
                            const oldCodes = extractSetupIds(existing.RELF01);

                            if (oldCodes.length > 0) {

                                await sequelizeRDB.query(`
                    UPDATE IDBAPI.dbo.PLSYSF02
                    SET F02PYBL = 'N'
                    WHERE F02F01 IN (:oldCodes)
                `, {
                                    replacements: { oldCodes }
                                });
                            }

                            // 🟢 Activate new setup IDs
                            const newCodes = extractSetupIds(pa.ModuleCode);

                            if (newCodes.length > 0) {

                                await sequelizeRDB.query(`
                    UPDATE IDBAPI.dbo.PLSYSF02
                    SET F02PYBL = 'Y'
                    WHERE F02F01 IN (:newCodes)
                `, {
                                    replacements: { newCodes }
                                });
                            }
                        }

                        // 3️⃣ Update menuId (RELF04)
                        if (pa.menuId !== undefined) {

                            relf04Value = pa.menuId
                                ? pa.menuId
                                    .split(',')
                                    .map(id => id.trim())
                                    .filter(id => id.length)
                                    .sort()
                                    .join(',')
                                : null;
                        }
                    }

                    /* =========================
                       🔄 UPDATE RECORD
                       ========================= */
                    await ModuleRepo.update(
                        {
                            RELF01: updatedModuleCode,
                            RELF02: price ?? existing.RELF02,
                            RELF04: relf04Value
                        },
                        {
                            RELF00: moduleID
                        }
                    );

                    response.status = 'SUCCESS';
                    response.message = 'Module updated successfully';

                    return AdminModuleController.send(res, response);
                }

                case 'D': {

                    if (!moduleID) {
                        response.status = 'FAIL';
                        response.message = 'moduleID is required';
                        return AdminModuleController.send(res, response, 400);
                    }

                    /* 1️⃣ Get module record */
                    const module = await ModuleRepo.findOne({ RELF00: moduleID });

                    if (!module) {
                        response.status = 'FAIL';
                        response.message = 'Module not found';
                        return AdminModuleController.send(res, response, 404);
                    }

                    // const moduleCode = module.RELF01;
                    // const moduleCode = extractSetupCode(module.RELF01);
                    const codes = extractSetupIds(module.RELF01);
                    const moduleType = module.RELF03;

                    /* 2️⃣ If Setup module → update PLSYSF02 payable flag */
                    //             if (moduleType === 'S' && moduleCode) {

                    //                 await sequelizeRDB.query(`
                    //     UPDATE IDBAPI.dbo.PLSYSF02
                    //     SET F02PYBL = 'N'
                    //     WHERE F02F01 = :code
                    //     AND F02PYBL <> 'N'
                    // `, {
                    //                     replacements: { code: moduleCode }
                    //                 });

                    //             }
                    if (moduleType === 'S' && codes.length > 0) {

                        await sequelizeRDB.query(`
        UPDATE IDBAPI.dbo.PLSYSF02
        SET F02PYBL = 'N'
        WHERE F02F01 IN (:codes)
        AND F02PYBL <> 'N'
    `, {
                            replacements: { codes }
                        });
                    }
                    /* 3️⃣ Delete module */
                    const deleted = await ModuleRepo.destroy({ RELF00: moduleID });

                    if (!deleted) {
                        response.status = 'FAIL';
                        response.message = 'Delete failed';
                        return AdminModuleController.send(res, response, 500);
                    }

                    response.status = 'SUCCESS';
                    response.message = 'Module deleted successfully';
                    return AdminModuleController.send(res, response);
                }

                case 'S': {

                    const setups = await sequelizeRDB.query(`
                        SELECT 
                        F02F03E + ' - ' + F02F01 AS label
                        FROM IDBAPI.dbo.PLSYSF02
                        WHERE F02F00 = 'CCCC'
                        ORDER BY F02F01
                     `);
                    response.status = 'SUCCESS';
                    response.message = 'Setup list fetched successfully';
                    response.data = setups[0];

                    return AdminModuleController.send(res, response);
                }

                default:
                    response.status = 'FAIL';
                    response.message = 'Invalid action';
                    return AdminModuleController.send(res, response, 400);
            }

        } catch (err) {
            console.error('AdminModuleController error:', err);
            response.status = 'FAIL';
            response.message = 'Server error';
            return AdminModuleController.send(res, response, 500);
        }
    }

    /* =========================
     * 🔐 ENCRYPT RESPONSE
     * ========================= */
    static send(res, response, status = 200) {
        const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        return res.status(status).json({ encryptedResponse });
    }
}

module.exports = AdminModuleController;
