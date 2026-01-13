const querystring = require('querystring');
const db = require('../Config/config'); // Your Database class
const { Op, QueryTypes } = require('sequelize'); // Required for LIKE queries

const sequelizeSDB = db.getConnection('A00001SDB');
const sequelizeRDB = db.getConnection('RDB');
const sequelizeIDB = db.getConnection('IDBAPI');

const definePLSDBBRC = require('../Models/SDB/PLSDBBRC'); // Model factory
const definePLSDBREL = require('../Models/SDB/PLSDBBRC'); // Model factory
const definePLSDBADMI = require('../Models/SDB/PLSDBADMI'); // Model factory
const definePLRDBA01 = require('../Models/RDB/PLRDBA01'); // Model factory
const definePLSTATE = require('../Models/IDB/PLSTATE'); // Model factory
const Encryptor = require('../Services/encryptor');
const TokenService = require('../Services/tokenServices');
const ADMIController = require('./ADMIController');
const RELController = require('./RELController');
const BRCController = require('./BRCController');
const { generateDatabaseName } = require('../Services/queryService');
const M81Controller = require('./M81Controller');
const M82Controller = require('./M82Controller');

const PLSDBBRC = definePLSDBBRC(sequelizeSDB);
const PLSDBREL = definePLSDBREL(sequelizeSDB);
const PLSDBADMI = definePLSDBADMI(sequelizeSDB);
const PLRDBA01 = definePLRDBA01(sequelizeRDB);
const PLSTATE = definePLSTATE(sequelizeIDB);

const encryptor = new Encryptor();

class BranchController {
    constructor(lbool, action, BRcode, BRname, BRgst, BRSTATE, BRCorp, BRDEF, BRCCOMP) {
        this.act = action;
        this.brc = BRcode;
        this.brn = BRname;
        this.brg = BRgst;
        this.brcr = BRCorp;
        this.brst = BRSTATE;
        this.lbool = lbool;
        this.defBrc = BRDEF
        this.brccomp = BRCCOMP
    }

    // Generate a unique BRCODE in the format BRC-XXXX (where XXXX is a 4-digit number)
    async generateUniqueBRCODE(tblbrc) {
        const existingBranches = await tblbrc.findAll({
            BRCODE: {
                [Op.like]: 'BRC-%',
            },
        }, [],
            ['BRCODE']
        );

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
            let decoded, BRCCOMP;
            if (this.lbool == false) {
                action = this.act;
                BRCODE = this.brc;
                BRNAME = this.brn;
                BRGST = this.brg;
                corpId = this.brcr;
                BRSTATE = this.brst;
                BRDEF = this.defBrc;
                BRCCOMP = this.brccomp;
            } else {
                const parameterString = encryptor.decrypt(req.query.pa);
                let decodedParam = decodeURIComponent(parameterString);
                let pa = querystring.parse(decodedParam);
                action = pa.action
                BRCODE = pa.BRCODE
                BRNAME = pa.BRNAME
                BRGST = pa.BRGST
                BRSTATE = pa.BRSTATE
                BRCCOMP = pa.BRCCOMP
                console.log("params pa", pa);

                const token = req.headers['authorization']?.split(' ')[1]; // 'Bearer <token>'

                if (!token) {
                    response.message = 'No token provided, authorization denied.'
                    response.status = 'FAIL'
                    const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(401).json({ encryptedResponse });
                }
                decoded = await TokenService.validateToken(token);
            }
            console.log("decoded", decoded);

            // corpId = decoded.corpId
            console.log(this.brcr);
            let sdbseq;
            if (this.brcr) {
                sdbseq = (this.brcr).split('-');
            } else {
                corpId = decoded.corpId
                sdbseq = (corpId).split('-');
            }
            // sdbseq = (this.brcr).split('-');
            let sdbdbname = sdbseq[0] + sdbseq[1] + sdbseq[2] + 'SDB'
            let admi = new ADMIController(sdbdbname);
            let rel = new RELController(sdbdbname);
            let tblbrc = new BRCController(sdbdbname);

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
                const newBRCODE = await this.generateUniqueBRCODE(tblbrc);
                let mainBRC = await tblbrc.findOne({
                    BRCORP: BRCORP.trim(),
                    BRDEF: 'Y'
                });

                let newBranch

                if (this.lbool == true) {
                    newBranch = await tblbrc.create(newBRCODE, BRNAME, this.brg, BRCORP, BRSTATE, this.defBrc == 'Y' ? 'Y' : 'N', this.brccomp
                    );
                } else {
                    newBranch = await tblbrc.create(
                        newBRCODE,
                        BRNAME,
                        BRGST ? BRGST : mainBRC?.BRGST ? mainBRC?.BRGST : '',
                        BRCORP.trim(),
                        BRSTATE,
                        this.defBrc == 'Y' ? 'Y' : 'N',
                        parseInt(BRCCOMP)
                    );
                }
                if (newBranch) {
                    const relMng = await rel.update({
                        M00F04: newBRCODE
                    }, {
                        M00F01: corpRow.A01F01  // Example condition
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

                const branch = await tblbrc.findOne({ BRCODE: BRCODE });
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
                if (branch.BRCCOMP) {
                    let cmplist = (branch.BRCCOMP).split(',');
                    for (const cl of cmplist) {
                        let existingCmp = (BRCCOMP).split(',');
                        if (existingCmp.includes(cl))
                            continue;
                        let crnum = corpId.split('-')
                        let SDBdbname = crnum[0] + crnum[1] + crnum[2] + "SDB"
                        let dbName = generateDatabaseName(corpId, cl);
                        let dbConn = db.createPool(dbName);
                        let m82 = new M82Controller(SDBdbname);
                        let cmpdet = await m82.findOne({ M82F02: parseInt(cl) });
                        let defYr = cmpdet.M82YRN;
                        let listOfYr = await dbConn.query('SELECT FIELD01 FROM CMPF01', {
                            type: QueryTypes.SELECT
                        });
                        let connectedRows;
                        if (listOfYr) {
                            for (const ly of listOfYr) {
                                connectedRows = await dbConn.query(`SELECT * FROM YR${ly.FIELD01}T41 WHERE FLDBRC = '${branch.BRCODE}'`, {
                                    type: QueryTypes.SELECT
                                });
                                if (connectedRows.length > 0) {
                                    response.message = 'This Branch Contains Transaction in ' + cl + 'Company';
                                    response.status = 'FAIL'
                                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                                    return res.status(200).json({ encryptedResponse });
                                }
                            }
                        }
                    }
                }

                let mainBRC = await tblbrc.findOne({

                    BRCORP: BRCORP,
                    BRDEF: 'Y'
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
                // branch.BRCORP = BRCORP; 
                branch.BRSTATE = updatedBRSTATE;
                branch.BRCCOMP = this.brccomp;
                let updatedBrc = {
                    BRNAME: BRNAME,
                    BRGST: BRGST,
                    BRCORP: BRCORP,
                    BRSTATE: BRSTATE,
                    BRCCOMP: BRCCOMP
                }

                await tblbrc.update(updatedBrc, {
                    BRCODE: BRCODE
                });

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

                const branchRow = await tblbrc.findOne({ BRCODE: BRCODE });
                console.log("brc cmp", branchRow.BRCCOMP, !branchRow.BRCCOMP);

                if (branchRow.BRCCOMP != null) {
                    response.message = 'Branch is already assigned to Company'
                    response.status = 'FAIL'
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(400).json({ encryptedResponse });
                } else if (!branchRow || branchRow.BRDEF == 'Y') {
                    response.message = 'Default Branch Can Not be Deleted'
                    response.status = 'FAIL'
                    encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(400).json({ encryptedResponse });
                } else {
                    const deletedCount = await tblbrc.destroy({ BRCODE: BRCODE });
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
                if (decoded.roleId == 2) {
                    let corpUnq = await PLRDBA01.findOne({
                        where: { A01F03: corpId }
                    })
                    let allBRC = await tblbrc.findAll({
                        BRCORP: corpUnq.A01F01
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
                } else if (decoded.roleId == 3) {
                    let user = null
                    const existing = await admi.findAll();
                    const userId = encryptor.decrypt(decoded.userId)
                    for (let i of existing) {
                        const decrypted = encryptor.decrypt(i.ADMIF01)
                        if (decrypted == userId) {
                            user = i;
                            response = {
                                status: 'SUCCESS'
                            }
                        }
                    }
                    if (user.ADMIBRC) {
                        let brcValues = user.ADMIBRC.split(',');
                        let allBRC = await tblbrc.findAll({
                            BRID: {
                                [Op.in]: brcValues
                            }
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
                        response.message = 'No Assigned Branches'
                        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(200).json({ encryptedResponse });
                    }
                }
                else {
                    if (!this.lbool) {
                        return false;
                    } else {
                        response.status = 'FAIL'
                        encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(400).json({ encryptedResponse });
                    }
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
