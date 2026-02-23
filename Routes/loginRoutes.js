// const express = require('express');
// const router = express.Router();
// const { AdminController, UserController } = require('../Controller/loginController');
// const session = require('express-session');
// const RedisStore = require('connect-redis').RedisStore;  // Correct usage in v9.x
// const redis = require('redis');

// const redisClient = redis.createClient();  // Create Redis client

// // Set up the session middleware
// router.use(session({
//     store: new RedisStore({ client: redisClient }),  // Correct instantiation of RedisStore
//     secret: process.env.JWT_SECRET_KEY,
//     resave: false,
//     saveUninitialized: false,
//     cookie: { secure: false }  // Set to 'true' if using https
// }));

// // Middleware to check if the user is already logged in
// function checkLoginStatus(req, res, next) {
//     if (req.session.userLoggedIn) {
//         // If the user is already logged in, prevent further login processing
//         return res.status(403).json({ message: 'User is already logged in' });
//     }
//     next();  // If not logged in, proceed with login logic
// }

// // Apply the checkLoginStatus middleware to the login-related routes
// router.get('/UserInfo', checkLoginStatus, UserController.manageUser);

// // Your other routes
// router.get('/AdminInfo', AdminController.manageAdmin);
// router.post('/GenerateOtp', UserController.sendOtpByCorp);
// router.post('/VerifyOtp', UserController.verifyOtp);
// router.post('/ResetPassword', UserController.resetPassword);

// module.exports = router;


const express = require('express');
const router = express.Router();
const { AdminController, UserController } = require('../Controller/loginController');
// const session = require('express-session');
// const RedisStore = require('connect-redis').RedisStore;  // RedisStore directly, no .default in v9.x
// const { createClient } = require('@redis/client'); // Correct import for Redis client

// Create a Redis client
// const redisClient = createClient({
//     url: 'redis://localhost:6379',  // Adjust this URL as needed, depending on your Redis setup
// });

// Connect the Redis client
// redisClient.connect()
//     .then(() => {
//         console.log('Connected to Redis');
//     })
//     .catch((err) => {
//         console.error('Error connecting to Redis:', err);
//     });

// Apply the checkLoginStatus middleware to the login-related routes
router.get('/UserInfo', UserController.manageUser);

// Other routes
router.get('/AdminInfo', AdminController.manageAdmin);
router.post('/GenerateOtp', UserController.sendOtpByCorp);
router.post('/VerifyOtp', UserController.verifyOtp);
router.post('/ResetPassword', UserController.resetPassword);

module.exports = router;
