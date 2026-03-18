// controllers/apiController.js
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

// Path to the demo .xlsm file
const demoFilePath = path.join(__dirname, '../eway_bill.xlsm');

const createXlsmResponse = async (req, res) => {
  try {
    const data = req.body.data; // Assuming data is passed in the request body

    // Validate the input data
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Invalid data format' });
    }

    // Create the .xlsm file from the demo template
    const buffer = await updateXlsmFile(demoFilePath, data);

    // Send the updated .xlsm file as a response
    res.setHeader('Content-Disposition', 'attachment; filename=updated-file.xlsm');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error updating XLSM file', details: error.message });
  }
};

// Function to read the demo .xlsm file, update its contents, and return the updated buffer
const updateXlsmFile = async (filePath, data) => {
  const workbook = new ExcelJS.Workbook();
  
  // Read the existing .xlsm file
  await workbook.xlsx.readFile(filePath);

  // Get the first sheet (modify according to your file's structure)
  const worksheet = workbook.getWorksheet(1); // Assuming data goes into the first sheet

  // Clear any existing rows (if needed)
  worksheet.spliceRows(2, worksheet.rowCount - 1);  // Remove rows starting from the second row (to keep headers)

  // Insert new rows from the data
  data.forEach((item, index) => {
    const row = worksheet.addRow(item);
  });

  // Return the updated workbook as a buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

module.exports = {
  createXlsmResponse,
};