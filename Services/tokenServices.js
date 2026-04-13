const jwt = require('jsonwebtoken');
const Encryptor = require('./encryptor'); // Assuming this is for decrypting adminId
const ADMIController = require('../Controller/ADMIController');
const EP_USERController = require('../Controller/EP_USERController');


class TokenService {
    // Method to validate the token
    static async validateToken(token, isCron, returnRes) {

        const encryptor = new Encryptor();

        if (!token) throw new Error('Token not provided');

        let decodedToken;

        try {
            decodedToken = jwt.verify(token, process.env.JWT_SECRET_KEY);
        } catch (err) {
            if (isCron) return false;
            return returnRes = false;
        }

        const safeDecrypt = (val) => {
            if (!val) return null;
            try {
                return encryptor.decrypt(val);
            } catch {
                return val;
            }
        };

        try {

            /* =====================================================
               🧠 CONDITION BASED FLOW
            ===================================================== */

            if (decodedToken.corpId) {

                /* =====================================================
                   🏢 ADMI FLOW (YOUR OLD validateToken)
                ===================================================== */

                let adminId, password;

                if (decodedToken.roleId == 1) {
                    adminId = safeDecrypt(decodedToken.adminId);
                    password = safeDecrypt(decodedToken.password);
                } else {
                    adminId = safeDecrypt(decodedToken.userId);
                    password = safeDecrypt(decodedToken.password);
                }

                let sdbdbname;

                if (decodedToken.roleId == '1') {
                    sdbdbname = 'A00001SDB';
                } else {
                    let sdbSeq = decodedToken.corpId.split('-');
                    sdbdbname = sdbSeq.length == 3
                        ? sdbSeq[0] + sdbSeq[1] + sdbSeq[2] + 'SDB'
                        : sdbSeq[0] + sdbSeq[1] + 'SDB';
                }

                let admi = new ADMIController(sdbdbname);

                const existingAdmin = await admi.findAll(
                    {}, [],
                    ['ADMIF01', 'ADMIF05', 'ADMIF06']
                );

                let admin;

                for (let i of existingAdmin) {

                    let decrypted = safeDecrypt(i.ADMIF01);
                    let decryptedpass = safeDecrypt(i.ADMIF05);

                    if (String(decrypted) === String(adminId) &&
                        String(decryptedpass) === String(password)) {
                        admin = i;
                        break;
                    }
                }

                if (!admin) {
                    throw new Error('Unauthorized Admin');
                }

            } else {

                /* =====================================================
                   👤 EP_USER FLOW (validateAdminToken)
                ===================================================== */

                let userDbName = 'RDB';

                const userCtrl = new EP_USERController(userDbName);

                const users = await userCtrl.findAll({
                    UTF07: 'N'
                });

                let user = null;

                let tokenUserId;

                try {
                    tokenUserId = encryptor.decrypt(decodedToken.userId);
                } catch {
                    tokenUserId = decodedToken.userId;
                }

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

                if (user.UTF06 !== 'Y') {
                    throw new Error('User is inactive');
                }

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
            }

        } catch (err) {
            console.error('Token validation error:', err);
            throw new Error('Error validating token: ' + err.message);
        }

        return decodedToken;
    }
}

module.exports = TokenService;
