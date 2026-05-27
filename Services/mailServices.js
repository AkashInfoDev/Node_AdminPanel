const nodemailer = require('nodemailer');
const { sendWhatsAppOTP } = require('./whatsappOtpService');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});



async function sendMail({ smtpConfig, to, subject, html, attachments = [] }) {

    if (!smtpConfig || !smtpConfig._EMFROM || !smtpConfig._EMPASSWD) {
        throw new Error("Invalid SMTP Config");
    }

    const transporter = createTransporter1(smtpConfig);

    const mailOptions = {
        from: `"ERP System" <${smtpConfig._EMFROM}>`,
        to,
        subject,
        html,
        attachments
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent:", info.response);

    return info;
}

module.exports = { sendMail };
function createTransporter(smtpConfig = {}) {
    return nodemailer.createTransport({
        host: smtpConfig.host || process.env.SMTP_HOST,
        port: Number(smtpConfig.port || process.env.SMTP_PORT || 587),
        secure: Number(smtpConfig.port || process.env.SMTP_PORT) === 465,
        auth: {
            user: smtpConfig.user || process.env.SMTP_USER,
            pass: smtpConfig.pass || process.env.SMTP_PASS
        },
        // jsonTransport: true
    });
}

async function sendAccountInfoMail({ to, corpId, userId, password1 }) {
    const transporter = createTransporter();
    return transporter.sendMail({
        from: '"EPLUS Support" <demo@tcodes.in>',
        to,
        subject: 'Your EPLUS Account Has Been Successfully Created',
        html: `
        <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
            <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 0 10px rgba(0,0,0,0.08);">

                <div style="background:#0d6efd; padding:20px;">
    
    <table style="width:100%; border-collapse:collapse;">
        <tr>
            
            <!-- LEFT: LOGO -->
            <td style="width:120px; vertical-align:top;">
                <img 
                    src="https://nodeapi.epluserp.cloud/logo/E-Plus_Logo.jpg"
                    alt="E-PLUS Logo"
                    style="max-height:55px;"
                />
            </td>

            <!-- RIGHT: TEXT -->
            <td style="text-align:right; vertical-align:middle;">
                <h2 style="margin:0; color:#ffffff; font-size:20px;">
                    E-PLUS CLOUD ERP
                </h2>
                <p style="margin:5px 0 0; color:#dbeafe; font-size:13px;">
                    Account Registration Successful
                </p>
            </td>

        </tr>
    </table>

</div>

                <div style="padding:25px; color:#333;">
                    <p>Hello,</p>

                   <p>
                        Your E-PLUS account has been <strong>successfully created</strong>.
                    </p>
                    <p>
                        Below are your login credentials:
                    </p>

                    <table style="width:100%; border-collapse:collapse; margin:20px 0;">
                        <tr>
                            <td style="padding:10px; font-weight:bold; background:#f0f2f5;">Corporate ID</td>
                            <td style="padding:10px; background:#fafafa;">${corpId}</td>
                        </tr>
                        <tr>
                            <td style="padding:10px; font-weight:bold; background:#f0f2f5;">User Name</td>
                            <td style="padding:10px; background:#fafafa;">${userId}</td>
                        </tr>
                        <tr>
                            <td style="padding:10px; font-weight:bold; background:#f0f2f5;">Password</td>
                            <td style="padding:10px; background:#fafafa;">
                            ${password1}
                            </td>
                        </tr>
                    </table>

                    <p style="margin-top:20px;">
                        If you are  facing login issues,
                        please contact our system administrator.
                    </p>

                    <p style="color:#666;">Stay secure,<br/>E-PLUS Support Team</p>
                </div>

                <div style="background:#f0f2f5; padding:15px; text-align:center; font-size:12px; color:#999;">
                    © ${new Date().getFullYear()} Aakash Infoway Pvt. Ltd. All rights reserved. | Trusted since 2001
                </div>

            </div>
        </div>
        `
    });
}

async function sendResetMail({ to, corpId, otp }) {
    const transporter = createTransporter();
    return transporter.sendMail({
        from: '"EPLUS Support" <demo@tcodes.in>',
        to,
        subject: `OTP for ${corpId} to Password Reset`,
        html: `
        <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
            <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
    
    <!-- HEADER -->
    <div style="background:#0d6efd; padding:20px;">
    
    <table style="width:100%; border-collapse:collapse;">
        <tr>
            
            <!-- LEFT: LOGO -->
            <td style="width:120px; vertical-align:top;">
                <img 
                    src="https://nodeapi.epluserp.cloud/logo/E-Plus_Logo.jpg"
                    alt="E-PLUS Logo"
                    style="max-height:55px;"
                />
            </td>

            <!-- RIGHT: TEXT -->
            <td style="text-align:right; vertical-align:middle;">
                <h2 style="margin:0; color:#ffffff; font-size:20px;">
                    E-PLUS CLOUD ERP
                </h2>
                <p style="margin:5px 0 0; color:#dbeafe; font-size:13px;">
                    Password Reset Request
                </p>
            </td>

        </tr>
    </table>

</div>

    <!-- BODY -->
    <div style="padding:30px; color:#333;">
      
      <p style="margin:0 0 15px;">Hello,</p>

      <p style="line-height:1.6;">
        We received a request to reset your password. Use the OTP below to proceed:
      </p>

      <!-- OTP BOX (IMPORTANT UI IMPROVEMENT) -->
      <div style="text-align:center; margin:25px 0;">
        <div style="
          display:inline-block;
          background:#f1f5ff;
          border:1px dashed #0d6efd;
          padding:15px 30px;
          font-size:28px;
          font-weight:bold;
          letter-spacing:3px;
          color:#0d6efd;
          border-radius:8px;
        ">
          ${otp}
        </div>
      </div>

      <!-- DETAILS -->
      <div style="background:#f9fafb; border-radius:6px; padding:15px; margin-top:20px;">
        <p style="margin:5px 0;"><strong>Corporate ID:</strong> ${corpId}</p>
      </div>

      <p style="margin-top:20px; font-size:14px; color:#555;">
        This OTP is valid for <strong>5 minutes</strong>. If you did not request this, please ignore this email.
      </p>

      <p style="margin-top:20px;">
        Stay secure,<br/>
        <strong>E-PLUS Support Team</strong>
      </p>
    </div>

    <!-- FOOTER -->
    <div style="background:#f1f1f1; padding:15px; text-align:center; font-size:12px; color:#777;">
      © ${new Date().getFullYear()} Aakash Infoway Pvt. Ltd. | Trusted since 2001
    </div>

  </div>
</div>
`
    });
}

async function sendLogOutMail({ to, corpId, otp, subject }) {
    const transporter = createTransporter();
    let isMail = await transporter.sendMail({
        from: '"EPLUS Support" <demo@tcodes.in>',
        to,
        subject: `OTP for ${corpId} to Force Logout`,
        html: `
            <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
            <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 0 10px rgba(0,0,0,0.08);">
                
                <div style="background:#0d6efd; padding:20px;">
    
    <table style="width:100%; border-collapse:collapse;">
        <tr>
            
            <!-- LEFT: LOGO -->
            <td style="width:120px; vertical-align:top;">
                <img 
                    src="https://nodeapi.epluserp.cloud/logo/E-Plus_Logo.jpg"
                    alt="E-PLUS Logo"
                    style="max-height:55px;"
                />
            </td>

            <!-- RIGHT: TEXT -->
            <td style="text-align:right; vertical-align:middle;">
                <h2 style="margin:0; color:#ffffff; font-size:20px;">
                    E-PLUS CLOUD ERP
                </h2>
                <p style="margin:5px 0 0; color:#dbeafe; font-size:13px;">
                    Logout Request
                </p>
            </td>

        </tr>
    </table>

</div>

                <div style="padding:25px; color:#333;">
                    <p>Hello,</p>

                    <p>
                        We received a request to log out of your account. Below is your OTP to confirm the logout action:
                    </p>

                    <table style="width:100%; border-collapse:collapse; margin:20px 0;">
                        <tr>
                            <td style="padding:10px; font-weight:bold; background:#f0f2f5;">Corporate ID</td>
                            <td style="padding:10px; background:#fafafa;">${corpId}</td>
                        </tr>
                        <tr>
                            <td style="padding:10px; font-weight:bold; background:#f0f2f5;">OTP</td>
                            <td style="padding:10px; background:#fafafa;">${otp}</td>
                        </tr>
                    </table>

                    <p style="margin-top:20px;">
                        Please note: This OTP will expire in 5 minutes. If you did not request this logout, please ignore this email.
                    </p>

                    <p style="color:#666;">Stay secure,<br/>E-PLUS Support Team</p>
                </div>

                <div style="background:#f0f2f5; padding:15px; text-align:center; font-size:12px; color:#999;">
                    © ${new Date().getFullYear()} Aakash Infoway Pvt. Ltd. All rights reserved. | Trusted since 2001
                </div>

            </div>
        </div>
        `
    });
    return isMail;
}

const sendEmailWithAttachment = async (to, attachmentPath, filename, smtpConfig = {}) => {
    const port = Number(smtpConfig._PORTNO || smtpConfig.port);
    const transporter = nodemailer.createTransport({
        host: smtpConfig._EMSERVER ? smtpConfig._EMSERVER : smtpConfig.host, // not _EMSERVER
        port: smtpConfig._PORTNO ? smtpConfig._PORTNO : Number(smtpConfig.port), // ensure it's a number
        secure: port === 465, //secure: smtpConfig.port == 587 ? false : true,//Number(smtpConfig.port) === 465, // SSL for 465
        auth: {
            user: smtpConfig._EMFROM ? smtpConfig._EMFROM : smtpConfig.user, // not _EMFROM
            pass: smtpConfig._EMPASSWD ? smtpConfig._EMPASSWD : smtpConfig.pass  // not _EMPASSWD
        },
        tls: {
            rejectUnauthorized: false // optional
        }
    });
    const mailOptions = {
        // from: '"EPLUS Support" <demo@tcodes.in>',
        from: `"EPLUS Support" <${smtpConfig._EMFROM ? smtpConfig._EMFROM : smtpConfig.user}>`,
        to: to,
        subject: 'Backup - EPLUS Cloud ERP',

        html: `
    <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
      <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 0 10px rgba(0,0,0,0.08);">
<div style="background:#0d6efd; padding:20px;">
    
    <table style="width:100%; border-collapse:collapse;">
        <tr>
            
            <!-- LEFT: LOGO -->
            <td style="width:120px; vertical-align:top;">
                <img 
                    src="https://nodeapi.epluserp.cloud/logo/E-Plus_Logo.jpg"
                    alt="E-PLUS Logo"
                    style="max-height:55px;"
                />
            </td>

            <!-- RIGHT: TEXT -->
            <td style="text-align:right; vertical-align:middle;">
                <h2 style="margin:0; color:#ffffff; font-size:20px;">
                    E-PLUS CLOUD ERP
                </h2>
                <p style="margin:5px 0 0; color:#dbeafe; font-size:13px;">
                    Eplus Backup
                </p>
            </td>

        </tr>
    </table>

</div>

        <div style="padding:25px; color:#333;">
          <p>Hello,</p>

          <p>
            Your requested <strong>Eplus backup</strong> has been successfully generated.
          </p>

          <p>
            Please find the attached <strong>ZIP file</strong> containing the backup data.
          </p>

          <table style="width:100%; border-collapse:collapse; margin:20px 0;">
            <tr>
              <td style="padding:10px; font-weight:bold; background:#f0f2f5;">File Name</td>
              <td style="padding:10px; background:#fafafa;">${filename}</td>
            </tr>
            <tr>
              <td style="padding:10px; font-weight:bold; background:#f0f2f5;">Generated On</td>
              <td style="padding:10px; background:#fafafa;">${new Date().toLocaleString()}</td>
            </tr>
          </table>

          <p>
            If you did not request this backup or face any issues accessing the file,
            please contact our system administrator.
          </p>

          <p style="color:#666;">
            Regards,<br/>
            <strong>EPLUS Support Team</strong>
          </p>
        </div>

        <div style="background:#f0f2f5; padding:15px; text-align:center; font-size:12px; color:#999;">
          © ${new Date().getFullYear()} Aakash Infoway Pvt. Ltd. All rights reserved | Trusted since 2001
        </div>

      </div>
    </div>
    `,

        attachments: [
            {
                filename: filename,
                path: attachmentPath,
                contentType: 'application/zip'
            }
        ]
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        // console.log("✅ Email sent:", info.response);

        return info;

    } catch (error) {
        console.log(error);
        console.error("❌ SMTP ERROR:", {
            message: error.message,
            code: error.code,
            response: error.response
        });

        let customMessage = "Email sending failed";

        if (error.code === 'EAUTH') {
            customMessage = "SMTP Authentication failed Invalid EMIAL/PASS";
        } else if (error.code === 'ECONNECTION') {
            customMessage = "SMTP Connection failed (Check HOST/PORT)";
        } else if (error.response && error.response.includes('535')) {
            customMessage = "SMTP 535 Error (Authentication failed)";
        } else if (error.code === 'ETIMEDOUT') {
            customMessage = "SMTP Timeout (Server not reachable)";
        } else {
            customMessage = "Email sending failed: " + error.message;
        }

        const errObj = new Error(customMessage);
        errObj.original = error;

        throw errObj;
    }
};

async function sendForceLogoutOTP({ to, corpId, otp, phone }) {
    try {

        const transporter = createTransporter();

        const mailOptions = {
            from: `"EPLUS Support" <system@epluserp.com>`,
            to,
            subject: `OTP for ${corpId} to Force Logout`,
            html: `
                <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
                <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 0 10px rgba(0,0,0,0.08);">
                    
                  <div style="background:#0d6efd; padding:20px;">
    
    <table style="width:100%; border-collapse:collapse;">
        <tr>
            
            <!-- LEFT: LOGO -->
            <td style="width:120px; vertical-align:top;">
                <img 
                    src="https://nodeapi.epluserp.cloud/logo/E-Plus_Logo.jpg"
                    alt="E-PLUS Logo"
                    style="max-height:55px;"
                />
            </td>

            <!-- RIGHT: TEXT -->
            <td style="text-align:right; vertical-align:middle;">
                <h2 style="margin:0; color:#ffffff; font-size:20px;">
                    E-PLUS CLOUD ERP
                </h2>
                <p style="margin:5px 0 0; color:#dbeafe; font-size:13px;">
                    Force Logout OTP
                </p>
            </td>

        </tr>
    </table>

</div>

                    <div style="padding:25px; color:#333;">
                        <p>Hello,</p>

                        <p>
                            We received a request to login from another device.
                        </p>

                        <p>
                            Use the OTP below to confirm force logout:
                        </p>

                        <table style="width:100%; border-collapse:collapse; margin:20px 0;">
                            <tr>
                                <td style="padding:10px; font-weight:bold; background:#f0f2f5;">Corporate ID</td>
                                <td style="padding:10px; background:#fafafa;">${corpId}</td>
                            </tr>
                            <tr>
                                <td style="padding:10px; font-weight:bold; background:#f0f2f5;">OTP</td>
                                <td style="padding:10px; background:#fafafa; font-size:22px; font-weight:bold;">
                                    ${otp}
                                </td>
                            </tr>
                        </table>

                        <p style="margin-top:20px;">
                            ⚠ This OTP is valid for 5 minutes.
                        </p>

                        <p style="color:#666;">Regards,<br/>E-PLUS Support Team</p>
                    </div>

                    <div style="background:#f0f2f5; padding:15px; text-align:center; font-size:12px; color:#999;">
                        © ${new Date().getFullYear()} Aakash Infoway Pvt. Ltd.
                    </div>

                </div>
            </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);

        console.log("✅ Force Logout OTP sent:", info.response);

        return "EM";

    } catch (error) {
        if (error.code = "EENVELOPE" && error.responseCode == 550) {
            try {
                const result = await sendWhatsAppOTP(phone, otp);
                console.log("WhatsApp Result:", result);
                if (result?.success === true) {
                    console.log("✅ OTP sent via WhatsApp");
                    return "WP";
                }

            } catch (waError) {
                console.error("❌ WhatsApp Error:", waError);
                throw new Error("WhatsApp OTP failed");
            }
        }
        console.error("❌ OTP Mail Error:", error);

        throw new Error("Failed to send OTP email");
    }
}

async function sendDealerAccountMail({ to, dealerCode, userId, password }) {
    const transporter = createTransporter();

    return transporter.sendMail({
        from: '"EPLUS Support" <demo@tcodes.in>',
        to,
        subject: ' Your Dealer Account is Ready - EPLUS ERP',
        html: `
        <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
            <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1);">

                <!-- HEADER -->
<div style="background:#0d6efd; padding:20px;">
    
    <table style="width:100%; border-collapse:collapse;">
        <tr>
            
            <!-- LEFT: LOGO -->
            <td style="width:120px; vertical-align:top;">
                <img 
                    src="https://nodeapi.epluserp.cloud/logo/E-Plus_Logo.jpg"
                    alt="E-PLUS Logo"
                    style="max-height:55px;"
                />
            </td>

            <!-- RIGHT: TEXT (SHIFTED RIGHT) -->
            <td style="text-align:right; vertical-align:middle;">
                <h2 style="margin:0; color:#ffffff; font-size:20px;">
                    E-PLUS CLOUD ERP
                </h2>
                <p style="margin:5px 0 0; color:#dbeafe; font-size:13px;">
                    Dealer Account Created Successfully
                </p>
            </td>

        </tr>
    </table>

</div>

                <!-- BODY -->
                <div style="padding:25px; color:#333;">
                    <p>Hello Dealer,</p>

                    <p>
                        Welcome to <strong>E-PLUS ERP</strong> <br/>
                        Your dealer account has been successfully created.
                    </p>

                    <p>
                        Login Credentials:
                    </p>

                    <table style="width:100%; border-collapse:collapse; margin:20px 0;">
                        
                        <tr>
                            <td style="padding:10px; font-weight:bold; background:#f0f2f5;">User ID</td>
                            <td style="padding:10px; background:#fafafa;">${userId}</td>
                        </tr>
                        <tr>
                            <td style="padding:10px; font-weight:bold; background:#f0f2f5;">Password</td>
                            <td style="padding:10px; background:#fafafa;">${password}</td>
                        </tr>
                    </table>

                    

                    <p style="margin-top:20px;">
                        If you need assistance, contact our support team.
                    </p>

                    <p style="color:#666;">
                        Regards,<br/>
                        <strong>EPLUS Team</strong>
                    </p>
                </div>

                <!-- FOOTER -->
                <div style="background:#f1f1f1; padding:15px; text-align:center; font-size:12px; color:#777;">
                    © ${new Date().getFullYear()} Aakash Infoway Pvt. Ltd.
                </div>

            </div>
        </div>
        `
    });
}

module.exports = { sendAccountInfoMail, sendResetMail, sendLogOutMail, sendEmailWithAttachment, sendForceLogoutOTP, sendDealerAccountMail };