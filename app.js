const express = require('express');
const cors = require('cors'); // Import cors
const dbConfig = require('./Config/config');
const apiRoutes = require('./Routes/globalRoutes');
const app = express();

// Enable CORS for all origins (for local development)
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

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