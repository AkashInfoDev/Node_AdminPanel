const express = require('express');
const cors = require('cors'); // Import cors
const dbConfig = require('./Config/config');
const apiRoutes = require('./Routes/globalRoutes');
const app = express();
const path = require('path');

// Enable CORS for all origins (for local development)
app.use(cors());

// Parse JSON request bodies
app.use(express.json());
app.use('/logo', express.static(path.join(__dirname, 'Logo')));
// API Routes
app.use('/api', apiRoutes);

// Test the database connections
const databases = ['IDBAPI', 'RDB', 'A00001SDB', 'MASTER'];
databases.forEach(db => {
    dbConfig.testConnection(db);  // Test each connection at startup
});

app.listen(process.env.PORT, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
});