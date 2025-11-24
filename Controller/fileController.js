// const FileWriter = require('../Services/FileWriter');
// const fileWriter = new FileWriter('output.txt');
const db = require('../Config/config');
const sequelizeRDB = db.getConnection('RDB');
const definePLRDBRPAY = require('../Models/RDB/PLRDBRPAY');
const PLRDBRPAY = definePLRDBRPAY(sequelizeRDB);

async function writeToFile(req, res) {
  const { payload } = req.body;

  if (!payload) {
    return res.status(400).json({ error: 'No payload provided' });
  }

  try {
    // Ensure the necessary entity is present in the payload
    if (!payload.payment || !payload.payment.entity) {
      return res.status(400).json({ error: 'Invalid payload format' });
    }

    let data = payload.payment.entity;
    console.log('Data from Payload:', data);

    // Insert data into the database - handle potential DB insert error
    try {
      await PLRDBRPAY.create({
        RPAYF01: data.id,
        RPAYF02: JSON.stringify(payload),
      });
      console.log('Data inserted into database successfully.');
    } catch (dbError) {
      console.error('Error inserting data into database:', dbError);
      return res.status(500).json({ error: 'Failed to insert data into database' });
    }

    // Return success response
    return res.status(200).json({ message: 'Process Complete' });

  } catch (error) {
    console.error('Unexpected error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

module.exports = { writeToFile };
