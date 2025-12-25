const querystring = require('querystring');
const db = require('../Config/config'); // Your Database class
const { Op } = require('sequelize'); // Required for LIKE queries

const sequelizeSDB = db.getConnection('A00001SDB');
const sequelizeRDB = db.getConnection('RDB');
const sequelizeIDB = db.getConnection('IDBAPI');

const definePLSDBADMI = require('../Models/SDB/PLSDBBRC'); // Model factory
const definePLSDBREL = require('../Models/SDB/PLSDBBRC'); // Model factory
const definePLRDBA01 = require('../Models/RDB/PLRDBA01'); // Model factory
const definePLSTATE = require('../Models/IDB/PLSTATE'); // Model factory
const Encryptor = require('../Services/encryptor');
const TokenService = require('../Services/tokenServices');

const PLSDBBRC = definePLSDBADMI(sequelizeSDB);
const PLSDBREL = definePLSDBREL(sequelizeSDB);
const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const PLSTATE = definePLSTATE(sequelizeIDB);

const encryptor = new Encryptor();

class BranchController {
    constructor(lbool, action, BRcode, BRname, BRgst, BRSTATE, BRCorp, BRDEF) {
        this.act = action;
        this.brc = BRcode;
        this.brn = BRname;
        this.brg = BRgst;
        this.brcr = BRCorp;
        this.brst = BRSTATE;
        this.lbool = lbool;
        this.defBrc = BRDEF
    }

    // Generate a unique BRCODE in the format BRC-XXXX (where XXXX is a 4-digit number)
    async generateUniqueBRCODE() {
        const existingBranches = await PLSDBBRC.findAll({
            attributes: ['BRCODE'],
            where: {
                BRCODE: {
                    [Op.like]: 'BRC-%',
                },
            },
        });

        const usedCodes = new Set(
            existingBranches
                .map(branch => {
                    const match = branch.BRCODE.match(/^BRC-(\d{4})$/);
                    return match ? match[1] : null;
                })
                .filter(Boolean)
        );

        for (let attempt = 0; attempt < 1000; attempt++) {
            const randomNum = Math.floor(1000 + Math.random() * 9000); // 1000–9999
            const code = String(randomNum).padStart(4, '0');

            if (!usedCodes.has(code)) {
                return `BRC-${code}`;
            }
        }

        throw new Error('Unable to generate a unique BRCODE after multiple attempts');
    }

    async handleAction(req, res) {
        try {
            let response = { data: null, status: 'Success', message: '' };
            let encryptedResponse;
            let action, BRCODE, BRNAME, BRGST, BRSTATE, BRDEF, corpId
            let decoded;
            if (this.lbool == false) {
                action = this.act;
                BRCODE = this.brc;
                BRNAME = this.brn;
                BRGST = this.brg;
                corpId = this.brcr;
                BRSTATE = this.brst;
                BRDEF = this.defBrc;
            } else {
                const parameterString = encryptor.decrypt(req.query.pa);
                let decodedParam = decodeURIComponent(parameterString);
                let pa = querystring.parse(decodedParam);
                action = pa.action
                BRCODE = pa.BRCODE
                BRNAME = pa.BRNAME
                BRGST = pa.BRGST
                BRSTATE = pa.BRSTATE

                const token = req.headers['authorization']?.split(' ')[1]; // 'Bearer <token>'

                if (!token) {
                    response.message = 'No token provided, authorization denied.'
                    response.status = 'FAIL'
                    const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(401).json({ encryptedResponse });
                }
                decoded = await TokenService.validateToken(token);
                corpId = decoded.corpId
            }

            if (!action) {
                if (!this.lbool) {
                    return false;
                } else {
                    response.message = 'Action parameter is required';
                    response.status = 'FAIL'
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(400).json({ encryptedResponse });
                }
            }

            if (action === 'A') {
                // ADD
                if (!BRNAME || !corpId) {
                    if (!this.lbool) {
                        return false;
                    } else {
                        response.message = 'BRNAME, BRGST and corpId required for create';
                        response.status = 'FAIL'
                        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(400).json({ encryptedResponse });
                    }
                }

                const corpRow = await PLRDBA01.findOne({ where: { A01F03: corpId } });
                if (!corpRow) {
                    if (!this.lbool) {
                        return false;
                    } else {
                        response.message = 'Corporate ID not found'
                        response.status = 'FAIL'
                        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(400).json({ encryptedResponse });
                    }
                }

                const BRCORP = corpRow.A01F01;
                const newBRCODE = await this.generateUniqueBRCODE();
                let mainBRC = await PLSDBBRC.findOne({
                    where: {
                        BRCORP: BRCORP,
                        BRDEF: 'Y'
                    }
                });

                const newBranch = await PLSDBBRC.create({
                    BRCODE: newBRCODE,
                    BRNAME,
                    BRGST: BRGST ? BRGST : mainBRC.BRGST,
                    BRCORP,
                    BRSTATE,
                    BRDEF: this.defBrc == 'Y' ? 'Y' : 'N'
                });

                if (newBranch) {
                    const relMng = await PLSDBREL.update(
                        {
                            M00F04: newBRCODE
                        }, {
                        where: {
                            M00F01: corpRow.A01F01  // Example condition
                        }
                    });
                }
                if (this.lbool == false) {
                    return false;
                } else {
                    response.data = newBranch;
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(201).json({ encryptedResponse });
                }

            } else if (action === 'E') {
                // EDIT
                if (!BRCODE) {
                    if (!this.lbool) {
                        return false;
                    } else {
                        response.message = 'BRCODE required for edit'
                        response.status = 'FAIL'
                        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(400).json({ encryptedResponse });
                    }
                }

                const branch = await PLSDBBRC.findOne({ where: { BRCODE } });
                if (!branch) {
                    response.message = 'Branch not found';
                    response.status = 'FAIL'
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(404).json({ encryptedResponse });
                }

                let BRCORP = branch.BRCORP;
                if (corpId) {
                    const corpRow = await PLRDBA01.findOne({ where: { A01F03: corpId } });
                    if (!corpRow) {
                        if (!lbool) {
                            return false;
                        } else {
                            response.message = 'Corporate ID not found';
                            response.status = 'FAIL'
                            encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                            return res.status(400).json({ encryptedResponse });
                        }
                    }
                    BRCORP = corpRow.A01F01;
                }

                let mainBRC = await PLSDBBRC.findOne({
                    where: {
                        BRCORP: BRCORP,
                        BRDEF: 'Y'
                    }
                });

                const updatedBRNAME = BRNAME || branch.BRNAME;
                const updatedBRGST = BRGST ? BRGST : mainBRC.BRGST;
                let statecode = updatedBRGST.split('').slice(0, 2).join('');
                console.log(statecode);
                let stateid = await PLSTATE.findOne({
                    where: {
                        PLSF01: {
                            [Op.like]: `%${statecode}`  // Matches any value where PLSF01 ends with '24'
                        }
                    }
                });
                const updatedBRSTATE = stateid.PLSF01 || branch.BRSTATE;
                branch.BRNAME = updatedBRNAME;
                branch.BRGST = updatedBRGST;
                branch.BRCORP = BRCORP;
                branch.BRSTATE = updatedBRSTATE;

                await branch.save();

                response.data = branch
                encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                return res.status(200).json({ encryptedResponse });

            } else if (action === 'D') {
                // DELETE
                if (!BRCODE) {
                    if (!this.lbool) {
                        return false;
                    } else {
                        response.message = 'BRCODE required for delete'
                        response.status = 'FAIL'
                        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(400).json({ encryptedResponse });
                    }
                }

                const branchRow = await PLSDBBRC.findOne({ where: { BRCODE } });
                if (!branchRow || branchRow.BRDEF == 'Y') {
                    response.message = 'Default Branch Can Not be Deleted'
                    response.status = 'FAIL'
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(400).json({ encryptedResponse });
                } else {
                    const deletedCount = await PLSDBBRC.destroy({ where: { BRCODE } });
                    if (deletedCount === 0) {
                        if (!this.lbool) {
                            return false;
                        } else {
                            response.message = 'Branch not found';
                            response.status = 'FAIL'
                            encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                            return res.status(404).json({ encryptedResponse });
                        }
                    }
                }
                if (this.lbool == false) {
                    return false;
                } else {
                    response.message = 'Branch deleted successfully';
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(200).json({ encryptedResponse });
                }

            } else if (action === 'G') {
                let corpUnq = await PLRDBA01.findOne({
                    where: { A01F03: corpId }
                })
                let allBRC = await PLSDBBRC.findAll({
                    where: { BRCORP: corpUnq.A01F01 }
                });
                for (const item of allBRC) {
                    let plstateRow;

                    // Convert Sequelize instance to plain object (if needed)
                    const plainItem = item.get({ plain: true });

                    // Only query PLSTATE if BRSTATE exists
                    if (plainItem.BRSTATE) {
                        plstateRow = await PLSTATE.findOne({
                            where: { PLSF01: plainItem.BRSTATE }
                        });
                    }

                    // Add the new key-value pair to the plain object
                    plainItem.BRCSTNM = plstateRow?.PLSF02 || ''; // Default to empty string if PLSF02 is undefined
                }

                response.data = allBRC
                encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                return res.status(200).json({ encryptedResponse });
            } else {
                if (!this.lbool) {
                    return false;
                } else {
                    response.status = 'FAIL'
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(400).json({ encryptedResponse });
                }
            }
        } catch (error) {
            console.error(error);
            if (!this.lbool) {
                return false;
            } else {
                return res.status(500).json({ error: 'Server error' });
            }
        }
    }
}

module.exports = BranchController;
