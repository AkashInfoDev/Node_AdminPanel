const db = require('../Config/config'); // Your Database class
const definePLSDBUSROLE = require('../Models/SDB/PLSDBUSROLE');
const Encryptor = require('../Services/encryptor');

const sequelizeSDB = db.getConnection('A00001SDB');
const PLSDBUSROLE = definePLSDBUSROLE(sequelizeSDB);

const encryptor = new Encryptor();

class UsrRole {
    static async handleRole(req, res) {
        const parameterString = encryptor.decrypt(req.query.pa);
        let decodedParam = decodeURIComponent(parameterString);
        let pa = querystring.parse(decodedParam);
        const { action, USRF00, USRF01, USRF02, USRF03, USRF04, USRF05, USRF06, USRF07, USRF08 } = pa;
        let response = { data: null, status: 'SUCCESS', message: null };

        if(!action){
            return res.status(400).json({message: 'No Action Passed'})
        }

        try {
            switch (action) {
                case 'A':
                    // Add a new role record
                    const newRole = await PLSDBUSROLE.create({
                        USRF01,  // MENU ID
                        USRF02,  // ADMIN ID
                        USRF03,  // ADD Boolean
                        USRF04,  // EDIT Boolean
                        USRF05,  // DELETE Boolean
                        USRF06,  // PRINT Boolean
                        USRF07,   // VIEW Boolean
                        USRF08
                    });
                    return res.status(201).json({
                        message: 'Role added successfully!',
                        data: newRole
                    });

                case 'E':
                    // Edit an existing role record
                    if (!USRF00) {
                        return res.status(400).json({ message: 'USRF00 (Role ID) is required for editing.' });
                    }
                    const roleToEdit = await PLSDBUSROLE.findOne({ where: { USRF00 } });
                    if (!roleToEdit) {
                        return res.status(404).json({ message: 'Role not found.' });
                    }
                    await roleToEdit.update({
                        USRF01,
                        USRF02,
                        USRF03,
                        USRF04,
                        USRF05,
                        USRF06,
                        USRF07,
                        USRF08
                    });
                    return res.status(200).json({
                        message: 'Role updated successfully!',
                        data: roleToEdit
                    });

                case 'D':
                    // Delete a role record
                    if (!USRF00) {
                        return res.status(400).json({ message: 'USRF00 (Role ID) is required for deletion.' });
                    }
                    const roleToDelete = await PLSDBUSROLE.findOne({ where: { USRF00 } });
                    if (!roleToDelete) {
                        return res.status(404).json({ message: 'Role not found.' });
                    }
                    await roleToDelete.destroy();
                    return res.status(200).json({
                        message: 'Role deleted successfully!'
                    });

                case 'G':
                    // View all records
                    const allRoles = await PLSDBUSROLE.findAll();
                    return res.status(200).json({
                        message: 'All roles fetched.',
                        data: allRoles
                    });

                default:
                    return res.status(400).json({
                        message: 'Invalid action. Please provide a valid action (Add, Edit, Delete, View).'
                    });
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
