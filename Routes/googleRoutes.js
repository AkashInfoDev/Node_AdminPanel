const express = require("express");
const router = express.Router();


const { oauthCallback } = require("../Controller/googleCallbackController");
const { oauth2Client } = require('../utils/googleAuth')
const { validateToken } = require('../Services/tokenServices');



// LOGIN

router.get("/login", async (req, res) => {

    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Authorization token required"
        });
    }

    const decoded = await validateToken(token);
    const corporateID = decoded.corpId;

    const state = Buffer.from(
        JSON.stringify({ corporateID })
    ).toString("base64");

    const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: ["https://www.googleapis.com/auth/drive"],
        prompt: "consent",
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        state
    });

    res.redirect(authUrl);
});
// console.log("oauthCallback =", oauthCallback);

// CALLBACK
router.get("/oauth2callback", oauthCallback);

module.exports = router; // 🔥 THIS LINE IS CRITICAL
