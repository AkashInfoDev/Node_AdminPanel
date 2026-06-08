const express = require('express');
const cors = require('cors'); // Import cors
const http = require('http');
const { Server } = require('socket.io');
const dbConfig = require('./Config/config');
const apiRoutes = require('./Routes/globalRoutes');
const app = express();
/* =========================
   SOCKET SERVER
========================= */

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

global.io = io;

/* =========================
   SOCKET EVENTS
========================= */

io.on('connection', (socket) => {

    console.log('Socket Connected:', socket.id);

    socket.on('registerUser', (userId) => {

        socket.join(`user_${userId}`);

        console.log(
            `User ${userId} joined room user_${userId}`
        );
    });

    socket.on('disconnect', () => {

        console.log(
            'Socket Disconnected:',
            socket.id
        );
    });
});

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

// app.listen(process.env.PORT, () => {
//     console.log(`Server is running on port ${process.env.PORT}`);
// });
server.listen(process.env.PORT, () => {
    console.log(
        `Server is running on port ${process.env.PORT}`
    );
});