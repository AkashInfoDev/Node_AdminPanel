const express = require('express');
const router = express.Router();
const roleController = require('../Controller/roleController');
const UsrRole = require('../Controller/UserRoleController');

router.get('/roles', async (req, res) => {
    const { action } = req.query;
    
    try {
        switch (action) {
            case 'A': // Create
                return await roleController.createRole(req, res);
            case 'E': // Edit
                return await roleController.editRole(req, res);
            case 'D': // Delete
                return await roleController.deleteRole(req, res);
            case 'G': // Get all
                return await roleController.getAllRoles(req, res);
            default:
                return res.status(400).json({ message: 'Invalid action' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/UsrRole', UsrRole.handleRole)

module.exports = router;