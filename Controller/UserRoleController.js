const querystring = require('querystring');
const { Op } = require('sequelize');
const db = require('../Config/config'); // Your Database class
const definePLSDBUSROLE = require('../Models/SDB/PLSDBUSROLE');
const definePLSDBCROLE = require('../Models/SDB/PLSDBCROLE');
const definePLSYS01 = require('../Models/IDB/PLSYS01');
const Encryptor = require('../Services/encryptor');
const MenuController = require('./menuController');
const TokenService = require('../Services/tokenServices');

const sequelizeSDB = db.getConnection('A00001SDB');
const sequelizeIDB = db.getConnection('IDBAPI');
const PLSYS01 = definePLSYS01(sequelizeIDB);
const PLSDBUSROLE = definePLSDBUSROLE(sequelizeSDB);
const PLSDBCROLE = definePLSDBCROLE(sequelizeSDB);

const encryptor = new Encryptor();

class UsrRole {
    static async handleRole(req, res) {
        const parameterString = encryptor.decrypt(req.query.pa);
        let decodedParam = decodeURIComponent(parameterString);
        let pa = querystring.parse(decodedParam);
        const { action, cusRoleId, USRF00, USRF01, USRF02, USRF03, USRF04, USRF05, USRF06, USRF07, menuIds } = pa;
        let response = { data: null, status: 'SUCCESS', message: null };
        let encryptedResponse;

        if (!action) {
            response.message = 'No Action Passed';
            response.status = 'FAIL'
            encryptedResponse = encryptor.encrypt(JSON.stringify(response));
            return res.status(400).json({ encryptedResponse });
        }

        let existingrole = await PLSDBUSROLE.findAll({
            attributes: ['USRF00', 'USRF01']
        });
        for (const ex of existingrole) {
            if (ex.USRF00 === USRF00) {
                action = 'E';
                USRF01 = ex.USRF01
            }
        }

        try {
            switch (action) {
                case 'A':
                    // Add a new role record
                    let existingCusRoleId = await PLSDBUSROLE.findOne({
                        where: { USRF01: USRF01 }
                    })
                    if (!existingCusRoleId) {
                        const newRole = await PLSDBUSROLE.create({
                            USRF01: USRF01,
                            USRF02: USRF02,
                            USRF03: USRF03,
                            USRF04: USRF04,
                            USRF05: USRF05,
                            USRF06: USRF06,
                            USRF07: USRF07,
                        });
                        response.message = 'Role added successfully!'
                        response.data = newRole
                        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(201).json({ encryptedResponse });
                    } else {
                        let updatedRole = await PLSDBUSROLE.update({
                            USRF02: USRF02,
                            USRF03: USRF03,
                            USRF04: USRF04,
                            USRF05: USRF05,
                            USRF06: USRF06,
                            USRF07: USRF07,
                        }, {
                            where: { USRF01: USRF01 }
                        });
                        response.message = 'Role added successfully!'
                        response.data = updatedRole
                        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(201).json({ encryptedResponse });
                    }
                    response.message = 'Role added successfully!'
                    response.data = newRole
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(201).json({ encryptedResponse });

                case 'E':
                    // Edit an existing role record
                    if (!USRF00) {
                        response.message = 'Role ID is required for editing.'
                        response.status = 'FAIL'
                        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(400).json({ encryptedResponse });
                    }
                    const roleToEdit = await PLSDBUSROLE.findOne({ where: { USRF00 } });
                    if (!roleToEdit) {
                        response.message = 'Role not found.'
                        response.status = 'FAIL'
                        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(404).json({ encryptedResponse });
                    }
                    await roleToEdit.update({
                        USRF01,
                        USRF02,
                        USRF03,
                        USRF04,
                        USRF05,
                        USRF06,
                        USRF07,
                    });
                    response.message = 'Role updated successfully!'
                    response.data = roleToEdit
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(200).json({ encryptedResponse });

                case 'D':
                    // Delete a role record
                    if (!USRF00) {
                        response.message = 'USRF00 (Role ID) is required for deletion.'
                        response.status = 'FAIL'
                        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(400).json({ encryptedResponse });
                    }
                    const roleToDelete = await PLSDBUSROLE.findOne({ where: { USRF00 } });
                    if (!roleToDelete) {
                        response.message = 'Role not found.'
                        response.status = 'FAIL'
                        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(404).json({ encryptedResponse });
                    }
                    await roleToDelete.destroy();
                    response.message = 'Role deleted successfully!'
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(200).json({ encryptedResponse });

                case 'G':
                    // View all records
                    const allRoles = await PLSDBUSROLE.findOne({
                        where: { USRF01: USRF01 }
                    });
                    let menus
                    let menuIdsArray = menuIds.split(','); // This splits the string into an array
                    let menuRows = await PLSYS01.findAll({
                        attributes: ['S01F02', 'S01F03', 'S01F04E'],
                        where: {
                            S01F02: {
                                [Op.in]: menuIdsArray // Using the `Op.in` to check if S01F02 is in the array of menuIds
                            }
                        },
                        order: [['S01F03', 'ASC']]
                    });
                    if (!allRoles) {
                        const menuTree = MenuController.buildMenuTree(menuRows);

                        menus = MenuController.addPermissionsToLeafMenus(menuTree);
                    } else {
                        // If roles exist, check the specific role columns for permissions
                        const menuTree = MenuController.buildMenuTree(menuRows);

                        menus = MenuController.addPermissionsToLeafMenus(menuTree);
                        menus = MenuController.assignPermissionsToMenus(menus, allRoles); 
                        // menus = menus.map(item => {
                            
                        //     // Check if any children exist
                        //     if (item.children && item.children.length > 0) {
                                
                        //         item.children = item.children.map(child => {
                                    
                        //             // Log if the role exists in allRoles.USRF02, USRF03, etc.
                                    
                        //             if(child.S01F02 == '1242'){
                        //                 console.log('');
                        //             }
                        //             if (allRoles.USRF02.includes(child.S01F02)) {
                        //                 child.l_Add = 1;
                        //             }
                        //             if (allRoles.USRF03.includes(child.S01F02)) {
                        //                 child.l_Edit = 1;
                        //             }
                        //             if (allRoles.USRF04.includes(child.S01F02)) {
                        //                 child.l_Delete = 1;
                        //             }
                        //             if (allRoles.USRF05.includes(child.S01F02)) {
                        //                 child.l_View = 1;
                        //             }
                        //             if (allRoles.USRF06.includes(child.S01F02)) {
                        //                 child.l_Print = 1;
                        //             }
                        //             if (allRoles.USRF07.includes(child.S01F02)) {
                        //                 child.l_UserField = 1;
                        //             }
                        
                        //             return child; // Return updated child
                        //         });
                        //     }
                            
                        //     return item; // Return updated item
                        // });
                        

                        // menus = menuTree; // The updated menu tree with permissions
                    }
                    response.message = 'All roles fetched.'
                    response.data = menus
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(200).json({ encryptedResponse });

                default:
                    response.message = 'Invalid action. Please provide a valid action (Add, Edit, Delete, View).'
                    response.status = 'FAIL'
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(400).json({ encryptedResponse });
            }
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                message: 'An error occurred while processing your request.',
                error: error.message
            });
        }
    }
    static async handleCusRole(req, res) {
        const parameterString = encryptor.decrypt(req.query.pa);
        let decodedParam = decodeURIComponent(parameterString);
        let pa = querystring.parse(decodedParam);
        const { action, CROLF00, CROLF01 } = pa;
        let response = { data: null, status: 'SUCCESS', message: null };
        let encryptedResponse;
        let decoded;
        try {
            const token = req.headers['authorization']?.split(' ')[1]; // 'Bearer <token>'

                if (!token) {
                    response.message = 'No token provided, authorization denied.'
                    response.status = 'FAIL'
                    const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(401).json({ encryptedResponse });
                }
                decoded = await TokenService.validateToken(token);
            if (!action) {
                response.message = 'No Action Passed';
                response.status = 'FAIL'
                encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                return res.status(400).json({ encryptedResponse });
            }
            let existingRole;
            switch (action) {
                case 'A':
                    // Add a new role record
                    existingRole = await PLSDBCROLE.findAll({
                        attributes: ['CROLF01']
                    });
                    for (const role of existingRole) {
                        if (role.CROLF01 === CROLF01) {
                            response.message = 'Roll Name Already Exist';
                            response.status = 'FAIL'
                            encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                            return res.status(400).json({ encryptedResponse });
                        }
                    }
                    const newRole = await PLSDBCROLE.create({
                        CROLF01: CROLF01,
                        CROLF02: decoded.corpId
                    });
                    let newcrole = await PLSDBUSROLE.create({
                        USRF01: newRole.CROLF00,
                        USRF02: '',
                        USRF03: '',
                        USRF04: '',
                        USRF05: '',
                        USRF06: '',
                        USRF07: ''

                    })
                    response.data = newRole;
                    response.message = 'Role added successfully!';
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(201).json({ encryptedResponse });

                case 'E':
                    // Edit an existing role record
                    if (!CROLF00) {
                        response.message = 'CROLF00 (Role ID) is required for editing.';
                        response.status = 'FAIL';
                        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(400).json({ encryptedResponse });
                    }
                    existingRole = await PLSDBCROLE.findAll({
                        attributes: ['CROLF01']
                    });
                    for (const role of existingRole) {
                        if (role.CROLF01 === CROLF01) {
                            response.message = 'Roll Name Already Exist';
                            response.status = 'FAIL'
                            encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                            return res.status(400).json({ encryptedResponse });
                        }
                    }
                    const roleToEdit = await PLSDBCROLE.findOne({ where: { CROLF00 } });
                    if (!roleToEdit) {
                        response.message = 'Role not found.';
                        response.status = 'FAIL';
                        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(404).json({ encryptedResponse });
                    }
                    let editedRole = await PLSDBCROLE.update({
                        CROLF01: CROLF01,
                        CROLF02: decoded.corpId
                    }, {
                        where: { CROLF00 }
                    });
                    response.message = 'Role updated successfully!';
                    response.data = editedRole;
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(200).json({ encryptedResponse });

                case 'D':
                    // Delete a role record
                    if (!CROLF00) {
                        response.message = 'Role ID is required for deletion.';
                        response.status = 'FAIL';
                        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(400).json({ encryptedResponse });
                    }
                    const roleToDelete = await PLSDBCROLE.findOne({ where: { CROLF00 } });
                    if (!roleToDelete) {
                        response.message = 'Role not found.';
                        response.status = 'FAIL';
                        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(404).json({ encryptedResponse });
                    }
                    await roleToDelete.destroy();
                    response.message = 'Role deleted successfully!';
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(200).json({ encryptedResponse });

                case 'G':
                    // View all records
                    const allRoles = await PLSDBCROLE.findAll();
                    response.message = 'All roles fetched.';
                    response.data = allRoles
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(200).json({ encryptedResponse });

                default:
                    response.message = 'Invalid action. Please provide a valid action (Add, Edit, Delete, View).';
                    response.status = 'FAIL';
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(400).json({ encryptedResponse });
            }
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                message: 'An error occurred while processing your request.',
                error: error.message
            });
        }
    }
}

module.exports = UsrRole;
