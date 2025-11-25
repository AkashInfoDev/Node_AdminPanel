const db = require('../Config/config');
const definePLSYS01 = require('../Models/IDB/PLSYS01');
const Encryptor = require('../Services/encryptor');
// const { sequelizeSource, sequelizeTarget } = require('../Config/dbConnections'); // Assuming these are set up

// Define source database connection and model
const sequelizeIDB = db.getConnection('IDBAPI');
const PLSYS01 = definePLSYS01(sequelizeIDB);
const encryptor = new Encryptor();

// Batch size for processing menu items (can be adjusted)
const BATCH_SIZE = 100;

class MenuController {
  static buildMenuTree(menus) {
    const parentMenus = []; // Array to store all parent menus
    const menuMap = new Map(); // Map to easily find child menus by parent ID

    // Step 1: Identify and log each parent menu (where S01F03 is a parent identifier)
    menus.forEach(menu => {
      // We assume root menus have S01F03 being either '0000' or other alphanumeric strings like '000C', etc.
      if (menu.S01F03 === '0000' || menu.S01F03.match(/^[A-F0-9]+$/)) {
        // If parent menu is identified as root (either '0000' or any alphanumeric string)
        parentMenus.push({
          id: menu.S01F02,
          name: menu.S01F04E,
          children: [],
        });
      }

      // Step 2: Add child menus to the map by parent ID (S01F03)
      if (menu.S01F03 !== '0000' && !menu.S01F03.match(/^[A-F0-9]+$/)) {
        if (!menuMap.has(menu.S01F03)) {
          menuMap.set(menu.S01F03, []);
        }
        menuMap.get(menu.S01F03).push({
          id: menu.S01F02,
          name: menu.S01F04E,
          children: [],
        });
      }
    });

    // Step 3: Add children to their respective parent menus
    parentMenus.forEach(parentMenu => {
      const children = menuMap.get(parentMenu.id);
      if (children) {
        parentMenu.children = children; // Attach children to the parent
      }
    });

    return parentMenus;
  }

  // GET API: Fetch and return the full menu tree
  static async getMenuTree(req, res) {
    try {
      // Fetch menus with only S01F02, S01F03, and S01F04E columns
      // const menus = await PLSYS01.findAll({
      //   attributes: ['S01F02', 'S01F03', 'S01F04E'], // Fetch only necessary columns
      //   order: [['S01F03', 'ASC']], // Sort menus by parent-child order
      // });

      // // Step 1: Create a map to hold menu objects by their IDs
      // const menuMap = {};

      // // Step 2: Loop over the menus and initialize them in the menuMap
      // menus.forEach(menu => {
      //   const menuId = menu.S01F02; // Current menu ID
      //   const parentId = menu.S01F03; // Parent menu ID
      //   const menuName = menu.S01F04E; // Menu name

      //   // Initialize the menu object in the map if it doesn't exist yet
      //   if (!menuMap[menuId]) {
      //     menuMap[menuId] = {
      //       S01F02: menuId,
      //       S01F03: parentId,
      //       S01F04E: menuName,
      //       children: [] // Placeholder for any child menus
      //     };
      //   }

      //   // If this menu has a parent, ensure it is initialized in the map
      //   if (parentId !== menuId && !menuMap[parentId]) {
      //     menuMap[parentId] = {
      //       S01F02: parentId,
      //       S01F03: null, // Parent has no parent itself
      //       S01F04E: 'Parent Menu', // Placeholder name
      //       children: []
      //     };
      //   }
      // });

      // // Step 3: Build the hierarchical structure
      // // Loop through all menus and place them under their parent
      // menus.forEach(menu => {
      //   const menuId = menu.S01F02;
      //   const parentId = menu.S01F03;

      //   // Skip the menu if it's its own parent
      //   if (parentId !== menuId) {
      //     // Add the current menu to its parent menu's 'children' array
      //     if (menuMap[parentId]) {
      //       menuMap[parentId].children.push(menuMap[menuId]);
      //     }
      //   }
      // });

      // // Step 4: Extract only the top-level menus (those that are not children of any other menu)
      // const topLevelMenus = Object.values(menuMap).filter(menu => menu.S01F03 === null || menu.S01F03 !== menu.S01F02);

      // // Step 5: Recursively structure all menus to ensure the hierarchy is correct
      // const buildMenuHierarchy = (menu) => {
      //   if (menu.children.length > 0) {
      //     menu.children.forEach(child => {
      //       buildMenuHierarchy(child); // Recursively add children
      //     });
      //   }
      //   return menu;
      // };

      // Step 1: Create a map to store menus by ID
      const menuMap = {};

      // Populate the map with menu objects, using original column names
      menus.forEach(menu => {
        const { S01F02: menuId, S01F03: parentId, S01F04E: menuName } = menu;
        menuMap[menuId] = { S01F02: menuId, S01F03: parentId, S01F04E: menuName, children: [] }; // Include S01F04E (menuName)
      });

      // Step 2: Build the menu tree
      const menuTree = [];

      // Iterate over the menu map and build parent-child relationships
      Object.values(menuMap).forEach(menu => {
        const { S01F03: parentId } = menu;

        // Check if the parent exists in the map
        if (menuMap[parentId]) {
          // If the parent exists in the map, add this menu as a child
          menuMap[parentId].children.push(menu);
        } else {
          // If the parent does not exist, treat this menu as a root menu
          menuTree.push(menu);
        }
      });

      // Step 6: Recursively build the hierarchy for each top-level menu
      // const result = topLevelMenus.map(menu => buildMenuHierarchy(menu));
      // Send the menu tree as the response
      let response = { data: menuTree, status: 'SUCCESS' }
      let encryptedResponse = encryptor.encrypt(JSON.stringify(response))
      return res.status(200).json({ encryptedResponse: encryptedResponse });
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
