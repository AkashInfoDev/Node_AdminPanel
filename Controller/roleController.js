const db = require('../Config/config'); // Your Database class

const sequelizeSDB = db.getConnection('A00001SDB');

const definePLSDBROLE = require('../Models/SDB/PLSDBROLE'); // Model factory

const PLSDBROLE = definePLSDBROLE(sequelizeSDB);
// controllers/roleController.js

class RoleController {
    // Create a new role
    async createRole(req, res) {
        const { rolename, roledesc, isactive } = req.query;
        try {
            if (!rolename) {
                return res.status(400).json({ message: 'rolename is required' });
            }

            const newRole = await PLSDBROLE.create({
                ROLENAME: rolename,
                ROLEDESC: roledesc || '',
                ISACTIVE: isactive !== undefined ? isactive : true,
            });

            return res.status(201).json(newRole);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }

    // Edit an existing role
    async editRole(req, res) {
        const { id, rolename, roledesc, isactive } = req.body;
        try {
            if (!id) {
                return res.status(400).json({ message: 'id is required' });
            }

            const roleToEdit = await PLSDBROLE.findByPk(id);
            if (!roleToEdit) {
                return res.status(404).json({ message: 'Role not found' });
            }

            roleToEdit.ROLENAME = rolename || roleToEdit.ROLENAME;
            roleToEdit.ROLEDESC = roledesc || roleToEdit.ROLEDESC;
            roleToEdit.ISACTIVE = isactive !== undefined ? isactive : roleToEdit.ISACTIVE;

            await roleToEdit.save();
            return res.status(200).json(roleToEdit);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }

    // Delete a role
    async deleteRole(req, res) {
        const { id } = req.body;
        try {
            if (!id) {
                return res.status(400).json({ message: 'id is required' });
            }

            const roleToDelete = await PLSDBROLE.findByPk(id);
            if (!roleToDelete) {
                return res.status(404).json({ message: 'Role not found' });
            }

            await roleToDelete.destroy();
            return res.status(204).json({ message: 'Role deleted' });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }

    // Get all roles
    async getAllRoles(req, res) {
        try {
            const roles = await PLSDBROLE.findAll();
            return res.status(200).json(roles);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
}

module.exports = new RoleController();
