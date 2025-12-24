const jwt = require('jsonwebtoken');
const db = require('../Config/config'); // Your Database class
const definePLSDBADMI = require('../Models/SDB/PLSDBADMI'); // Model factory
const Encryptor = require('./encryptor'); // Assuming this is for decrypting adminId
const sequelizeSDB = db.getConnection('A00001SDB');
const PLSDBADMI = definePLSDBADMI(sequelizeSDB);

class TokenService {
    // Method to validate the token
    static async validateToken(token, isCron) {

        const encryptor = new Encryptor();

        // If token is not provided, throw an error
        if (!token) throw new Error('Token not provided');

        let decodedToken;
        try {
            // Attempt to verify and decode the token
            decodedToken = jwt.verify(token, process.env.JWT_SECRET_KEY);
        } catch (err) {
            if(isCron){
                return false;
            }
            // Throw an error if the token is invalid or expired
            throw new Error('Invalid or expired token');
        }

        // Decrypt adminId if necessary (only if encrypted in the token)
        let adminId, password
        if (decodedToken.roleId == 1) {
            adminId = encryptor.decrypt(decodedToken.adminId); // Assuming Encryptor is used for adminId decryption
            password = encryptor.decrypt(decodedToken.password); // Assuming the token has a password field
        }else{
            adminId = encryptor.decrypt(decodedToken.userId)
            password = encryptor.decrypt(decodedToken.password)
        }

        try {
            // Find user by adminId and password in the database
            const existingAdmin = await PLSDBADMI.findAll({
                attributes: ['ADMIF01', 'ADMIF05', 'ADMIF06']
                // where: { ADMIF01: encrypted } 
            });
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
}

module.exports = TokenService;
