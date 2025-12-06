const db = require('../Config/config');
const definePLSYS01 = require('../Models/IDB/PLSYS01');
const Encryptor = require('../Services/encryptor');
const TokenService = require('../Services/tokenServices');
// const { sequelizeSource, sequelizeTarget } = require('../Config/dbConnections'); // Assuming these are set up

// Define source database connection and model
const sequelizeIDB = db.getConnection('IDBAPI');
const PLSYS01 = definePLSYS01(sequelizeIDB);
const encryptor = new Encryptor();

// Batch size for processing menu items (can be adjusted)
const BATCH_SIZE = 100;

class MenuController {

  static addPermissionsToLeafMenus(menuTree) {
    // Iterate through each menu item in the tree
    menuTree.forEach(item => {
      // Check if the item has children and whether it is a leaf node
      if (item.children && item.children.length === 0) {
        // Add permissions to leaf node (menu with empty children array)
        item.l_Add = 0;
        item.l_Edit = 0;
        item.l_Delete = 0;
        item.l_View = 0;
        item.l_Print = 0;
        item.l_UserField = 0;
      }

      // Check if the item has children, indicating it's a parent menu
      if (item.children && item.children.length > 0) {
        // Add the new parent key and value
        item.S01F0P = 'P';

        // Recursively process the children
        this.addPermissionsToLeafMenus(item.children);
      }
    });

    return menuTree;
  }

  // Static method to remove '&' from menu names
  static removeAmpersand(menuName) {
    return menuName.replace(/&/g, ''); // Removes all '&' characters
  }

  // Static method to build the menu tree from a flat list of menus
  static buildMenuTree(menus) {
    // First, convert all Sequelize instances to plain objects and initialize empty children
    const menuMap = {};
    menus.forEach(menu => {
      // Convert Sequelize instance to plain object
      const menuPlain = menu.get({ plain: true });

      // Initialize the children array and clean the menu name
      menuPlain.children = [];
      menuPlain.S01F04E = MenuController.removeAmpersand(menuPlain.S01F04E); // Clean up menu name
      menuMap[menuPlain.S01F02] = menuPlain; // Store in the map with S01F02 as key
    });

    // Now, link child menus to their parents using the map
    menus.forEach(menu => {
      const menuPlain = menu.get({ plain: true });
      const parentId = menuPlain.S01F03;

      if (parentId !== '0000' && menuMap[parentId]) {
        // If the parent exists and the menu has a parent (S01F03 != '0000')
        menuMap[parentId].children.push(menuPlain); // Add the current menu to the parent’s children array
      }
    });

    // Sort the children of each parent based on S01F02 (menu ID)
    Object.values(menuMap).forEach(menu => {
      menu.children.sort((a, b) => a.S01F02.localeCompare(b.S01F02)); // Sort by S01F02 (menu ID)
    });

    // Filter the root menus (menus that do not have a parent)
    const rootMenus = menus
      .map(menu => menu.get({ plain: true }))
      .filter(menuPlain => menuPlain.S01F03 === '0000');

    return rootMenus; // Return root menus with nested children
  }

  // GET API: Fetch and return the full menu tree
  static async getMenuTree(req, res) {
    try {
      // Fetch menu data from database
      const menus = await PLSYS01.findAll({
        attributes: ['S01F02', 'S01F03', 'S01F04E'], // Select relevant columns
        order: [['S01F03', 'ASC']], // Order by parent-child relationship
      });

      const token = req.headers['authorization']?.split(' ')[1]; // 'Bearer <token>'

      if (!token) {
        response.message = 'No token provided, authorization denied.'
        response.status = 'FAIL'
        const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
        return res.status(401).json({ encryptedResponse });
      }
      let decoded = await TokenService.validateToken(token);

      // Build the menu tree from the fetched menus
      const menuTree = MenuController.buildMenuTree(menus);

      // Prepare response data
      let response = { data: menuTree, status: 'SUCCESS' };

      // Encrypt the response (assuming you have an `encryptor` utility set up)
      let encryptedResponse = encryptor.encrypt(JSON.stringify(response));

      // Return the encrypted response
      return res.status(200).json({ encryptedResponse });
    } catch (error) {
      console.error('Error fetching menu tree:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
}



/**
 * Processes menu items in batches and inserts them into the target database
 * @param {Array} menuItems - The array of menu items to be inserted
 * @param {Sequelize} targetDb - The Sequelize instance of the target database
 * @param {Transaction} transaction - The Sequelize transaction object
 */
async function processInBatches(menuItems, targetDb, transaction) {
  // Process the menu items in batches of BATCH_SIZE
  for (let i = 0; i < menuItems.length; i += BATCH_SIZE) {
    const batch = menuItems.slice(i, i + BATCH_SIZE);

    // Insert the batch into the target database
    for (const menu of batch) {
      await targetDb.models.YR29C01.create({
        S01F02: menu.S01F02,
        S01F03: menu.S01F03,
        S01F04E: menu.S01F04E,
        S01F07: menu.S01F07,
      }, { transaction });
    }
  }
}

module.exports = MenuController;
