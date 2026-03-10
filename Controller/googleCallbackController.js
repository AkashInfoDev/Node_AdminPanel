const { oauth2Client } = require("../utils/googleAuth");
const db = require("../Config/config");   // Sequelize DB manager

const oauthCallback = async (req, res) => {
    try {

        const { code, state } = req.query;

        if (!code || !state) {
            return res.status(400).json({
                success: false,
                message: "Missing OAuth parameters"
            });
        }

        /* ===============================
           DECODE STATE
        =============================== */

        // const { corporateID, companyID } = JSON.parse(
        //     Buffer.from(state, "base64").toString()
        // );
        const { corporateID } = JSON.parse(
            Buffer.from(state, "base64").toString()
        );

        /* ===============================
           GET TOKENS FROM GOOGLE
        =============================== */

        const { tokens } = await oauth2Client.getToken(code);

        oauth2Client.setCredentials(tokens);

        if (!tokens.refresh_token) {
            return res.json({
                success: true,
                message: "Google already connected for this company"
            });
        }

        /* ===============================
           SET TOKEN EXPIRY (7 DAYS)
        =============================== */

        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 7);

        return res.json({
            success: true,
            message: "Google Drive connected successfully",
            data: {
                refresh_token: tokens.refresh_token,
                scope: tokens.scope
            }
        });

    } catch (err) {

        console.error("OAuth callback error:", err);

        return res.status(500).json({
            success: false,
            message: err.message
        });

    }
};

module.exports = { oauthCallback };