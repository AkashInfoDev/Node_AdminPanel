
const Encryptor = require("../Services/encryptor");
const definePLSDBADMI = require('../Models/SDB/PLSDBADMI'); // Model factory
const { Op } = require("sequelize");
const db = require('../Config/config'); // Your Database class

const sequelizeSDB = db.getConnection('A00001SDB');

const PLSDBADMI = definePLSDBADMI(sequelizeSDB);
const encryptor = new Encryptor();

class AdminPanel {

    static async getUsers(req, res) {
        try {
            // 🔹 Step 1: Decrypt & parse parameter
            // const parameterString = encryptor.decrypt(req.query);
            // let decodedParam = decodeURIComponent(parameterString);
            // let pa = querystring.parse(decodedParam);

            // 🔹 Step 2: Fetch all users with corporate IDs
            const users = await PLSDBADMI.findAll({
                where: {
                    [Op.and]: [
                        { ADMICORP: { [Op.ne]: null } },
                        { ADMICORP: { [Op.ne]: '' } }
                    ]
                }
            });

            // 🔹 Step 3: Build tree structure
            const userTree = AdminPanel.buildUserTree(users);

            // 🔹 Step 4: Return JSON response
            return res.json({
                success: true,
                data: userTree
            });

        } catch (err) {
            console.error(err);
            return res.status(500).json({
                success: false,
                message: "Error fetching users."
            });
        }
    }

    // ------------------------------------------------------------
    // 🔹 Tree Builder Method (class-based, clean separation)
    // ------------------------------------------------------------
    static buildUserTree(users) {
        const grouped = {};

        // Group users by ADMICORP
        users.forEach(user => {
            const corpId = user.ADMICORP;
            if (!grouped[corpId]) grouped[corpId] = [];
            grouped[corpId].push(user);
        });

        const result = [];

        // Build hierarchy per corporate ID
        for (const corpId in grouped) {
            const corpUsers = grouped[corpId];

            // Main authorized user (ADMIF06 == 2)
            const mainUser = corpUsers.find(u => u.ADMIF06 === 2);
            if (!mainUser) continue;

            // All others under the main user
            const children = corpUsers.filter(u => u.ADMIF06 !== 2);

            result.push({
                corpId,
                mainUser,
                children
            });
        }

        return result;
    }
}

module.exports = AdminPanel;