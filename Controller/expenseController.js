const db = require("../Config/config");
const definePLRDBEXP = require("../Models/RDB/PLRDBEXP");
const querystring = require("querystring");
const Encryptor = require("../Services/encryptor");

const sequelizeRDB = db.getConnection("RDB");
const PLRDBEXP = definePLRDBEXP(sequelizeRDB);
const encryptor = new Encryptor();

const handlePLRDBEXP = async (req, res) => {
    try {
        // Decrypt request payload
        const parameterString = encryptor.decrypt(req.query.pa);
        const decodedParam = decodeURIComponent(parameterString);
        const pa = querystring.parse(decodedParam);

        let response = { data: null, status: "FAIL", message: "" };
        const action = pa.action;

        switch (action) {
            // =========================
            // ADD RECORD
            // =========================
            case "A":
                if (!pa.EXPF02) {
                    response.message = "No Name Provided.";
                    console.error("[ADD] Missing EXPF02:", pa);
                    const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(400).json({ encryptedResponse });
                }

                const newExp = await PLRDBEXP.create({
                    EXPF02: pa.EXPF02,
                    EXPF03: pa.EXPF03 || null,
                    EXPF04: pa.EXPF04 ? pa.EXPF04.toUpperCase() : null,
                    EXPF05:  pa.EXPF05
                });

                response.data = newExp;
                response.status = "SUCCESS";
                response.message = "Record created successfully.";
                return res.status(201).json({ encryptedResponse: encryptor.encrypt(JSON.stringify(response)) });

            // =========================
            // GET RECORD(S)
            // =========================
            case "G":
                let expenses;
                if (pa.EXPF01) {
                    expenses = await PLRDBEXP.findOne({ where: { EXPF01: pa.EXPF01, EXPF05: "Y" } });
                    if (!expenses) {
                        response.message = "Record not found for ID: " + pa.EXPF01;
                        console.error("[GET] Not found:", pa.EXPF01);
                        const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                        return res.status(404).json({ encryptedResponse });
                    }
                } else {
                    expenses = await PLRDBEXP.findAll();
                }

                response.data = expenses;
                response.status = "SUCCESS";
                response.message = "";
                return res.status(200).json({ encryptedResponse: encryptor.encrypt(JSON.stringify(response)) });

            // =========================
            // EDIT RECORD
            // =========================
            case "E":
                if (!pa.EXPF01) {
                    response.message = "ID is required for update.";
                    console.error("[EDIT] Missing EXPF01:", pa);
                    const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(400).json({ encryptedResponse });
                }

                const updateData = {
                    EXPF02: pa.EXPF02,
                    EXPF03: pa.EXPF03,
                    EXPF04: pa.EXPF04 ? pa.EXPF04.toUpperCase() : null,
                    EXPF05: pa.EXPF05
                };

                const [updated] = await PLRDBEXP.update(updateData, { where: { EXPF01: pa.EXPF01 } });

                if (!updated) {
                    response.message = "Record not found for update ID: " + pa.EXPF01;
                    console.error("[EDIT] Record not found:", pa.EXPF01);
                    const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(404).json({ encryptedResponse });
                }

                const updatedRecord = await PLRDBEXP.findByPk(pa.EXPF01);
                response.data = updatedRecord;
                response.status = "SUCCESS";
                response.message = "Record updated successfully.";
                return res.status(200).json({ encryptedResponse: encryptor.encrypt(JSON.stringify(response)) });

            // =========================
            // DELETE RECORD
            // =========================
            case "D":
                if (!pa.EXPF01) {
                    response.message = "ID is required for delete.";
                    console.error("[DELETE] Missing EXPF01:", pa);
                    const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(400).json({ encryptedResponse });
                }

                const deleted = await PLRDBEXP.destroy({ where: { EXPF01: pa.EXPF01 } });

                if (!deleted) {
                    response.message = "Record not found for delete ID: " + pa.EXPF01;
                    console.error("[DELETE] Record not found:", pa.EXPF01);
                    const encryptedResponse = encryptor.encrypt(JSON.stringify(response));
                    return res.status(404).json({ encryptedResponse });
                }

                response.status = "SUCCESS";
                response.message = "Record deleted successfully.";
                return res.status(200).json({ encryptedResponse: encryptor.encrypt(JSON.stringify(response)) });

            // =========================
            // INVALID ACTION
            // =========================
            default:
                response.message = "Invalid or missing action parameter. Use A/G/E/D.";
                console.error("[INVALID ACTION] Payload:", pa);
                return res.status(400).json({ encryptedResponse: encryptor.encrypt(JSON.stringify(response)) });
        }
    } catch (err) {
        console.error("PLRDBEXP Error:", err);

        const response = {
            data: null,
            status: "FAIL",
            message: "Server error.",
            details: err.message
        };

        return res.status(500).json({ encryptedResponse: encryptor.encrypt(JSON.stringify(response)) });
    }
};

module.exports = { handlePLRDBEXP };