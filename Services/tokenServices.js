const jwt = require('jsonwebtoken');
const Encryptor = require('./encryptor'); // Assuming this is for decrypting adminId
const ADMIController = require('../Controller/ADMIController');


class TokenService {
    // Method to validate the token
    static async validateToken(token, isCron, returnRes) {

        const encryptor = new Encryptor();

        // If token is not provided, throw an error
        if (!token) throw new Error('Token not provided');

        let decodedToken;
        try {
            // Attempt to verify and decode the token
            decodedToken = jwt.verify(token, process.env.JWT_SECRET_KEY);
        } catch (err) {
            if (isCron) {
                return false;
            }
            // Throw an error if the token is invalid or expired
            return returnRes = false;
            // throw new Error('Invalid or expired token');
        }

        // Decrypt adminId if necessary (only if encrypted in the token)
        let adminId, password
        if (decodedToken.roleId == 1) {
            adminId = encryptor.decrypt(decodedToken.adminId); // Assuming Encryptor is used for adminId decryption
            password = encryptor.decrypt(decodedToken.password); // Assuming the token has a password field
        } else {
            adminId = encryptor.decrypt(decodedToken.userId)
            password = encryptor.decrypt(decodedToken.password)
        }

        try {
            // Find user by adminId and password in the database
            let sdbdbname;
            if (decodedToken.roleId == '1') {
                sdbdbname = 'A00001SDB';
            } else {
                let sdbSeq = (decodedToken.corpId).split('-');
                sdbdbname = sdbSeq.length == 3 ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB' : sdbSeq[0] + sdbSeq[1] + 'SDB';
            }
            let admi = new ADMIController(sdbdbname);
            const existingAdmin = await admi.findAll(
                {}, [],
                ['ADMIF01', 'ADMIF05', 'ADMIF06']
            );
            let admin;
            for (let i of existingAdmin) {
                const decrypted = encryptor.decrypt(i.ADMIF01);
                const decryptedpass = encryptor.decrypt(i.ADMIF05)
                if (decrypted == adminId && decryptedpass == password) {
                    admin = i;
                }
            }

            // If no user is found or password doesn't match, throw an unauthorized error
            if (!admin) {
                throw new Error('Unauthorized: User not found or invalid credentials');
            }
        } catch (err) {
            console.error(err);
            throw new Error('Error querying the database: ' + err.message);
        }

        // Return the decoded token if valid
        return decodedToken;
    }

        static async validateAdminToken(token, isCron, returnRes) {

        const encryptor = new Encryptor();

        if (!token) throw new Error('Token not provided');

        let decodedToken;

        /* =========================
           🔐 VERIFY TOKEN
        ========================= */
        try {
            decodedToken = jwt.verify(token, process.env.JWT_SECRET_KEY);
        } catch (err) {
            if (isCron) return false;
            return false;
        }

        try {

            /* =========================
               🏢 RESOLVE RDB
            ========================= */

            let userDbName;

            if (decodedToken.corpId) {
                const parts = decodedToken.corpId.split('-');

                userDbName = parts.length === 3
                    ? parts[0] + parts[1] + parts[2] + 'RDB'
                    : parts[0] + parts[1] + 'RDB';
            } else {
                userDbName = 'RDB';
            }

            const userCtrl = new EP_USERController(userDbName);

            /* =========================
               🔍 FETCH USERS
            ========================= */

            const users = await userCtrl.findAll({
                UTF07: 'N'
            });

            let user = null;

            /* =========================
               🔥 NORMALIZE TOKEN USER ID
            ========================= */

            let tokenUserId;

            try {
                tokenUserId = encryptor.decrypt(decodedToken.userId);
            } catch {
                tokenUserId = decodedToken.userId;
            }

            /* =========================
               🔍 FIND USER
            ========================= */

            for (let u of users) {

                let decryptedId;

                try {
                    decryptedId = encryptor.decrypt(u.UTF04);
                } catch {
                    decryptedId = u.UTF04;
                }

                if (String(decryptedId) === String(tokenUserId)) {
                    user = u;
                    break;
                }
            }

            if (!user) {
                throw new Error('Unauthorized User');
            }

            /* =========================
               🚫 ACTIVE CHECK
            ========================= */

            if (user.UTF06 !== 'Y') {
                throw new Error('User is inactive');
            }

            /* =========================
               🔐 OPTIONAL PASSWORD CHECK
            ========================= */

            if (decodedToken.password) {

                let tokenPassword;

                try {
                    tokenPassword = encryptor.decrypt(decodedToken.password);
                } catch {
                    tokenPassword = decodedToken.password;
                }

                let dbPassword;

                try {
                    dbPassword = encryptor.decrypt(user.UTF05);
                } catch {
                    dbPassword = user.UTF05;
                }

                if (String(dbPassword) !== String(tokenPassword)) {
                    throw new Error('Invalid token credentials');
                }
            }

        } catch (err) {
            console.error('Token validation error:', err);
            throw new Error('Error validating token: ' + err.message);
        }

        return decodedToken;
    }
}

module.exports = TokenService;
