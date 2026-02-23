const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});


async function sendAccountInfoMail({ to, corpId, userId, password1 }) {
    return transporter.sendMail({
        from: '"EPLUS Support" <demo@tcodes.in>',
        to,
        subject: 'Your EPLUS Account Has Been Successfully Created',
        html: `
        <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
            <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 0 10px rgba(0,0,0,0.08);">

                <div style="background:#0d6efd; color:#ffffff; padding:20px; text-align:center;">
                    <img src="E-Plus_Logo.jpg" alt="E-PLUS Logo" style="max-height:50px; vertical-align:middle; margin-right:10px;"/>
                    <h2 style="margin:0; display:inline;">E-PLUS CLOUD-ERP</h2>
                    <p style="margin:5px 0 0;">Account Registration Successful</p>
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
    return transporter.sendMail({
        from: '"EPLUS Support" <demo@tcodes.in>',
        to,
        subject: `OTP for ${corpId} to Password Reset`,
        html: `
            <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
            <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 0 10px rgba(0,0,0,0.08);">
                
                <div style="background:#0d6efd; color:#ffffff; padding:20px; text-align:center;">
                    <img src="E-Plus_Logo.jpg" alt="E-PLUS Logo" style="max-height:50px; vertical-align:middle; margin-right:10px;"/>
                    <h2 style="margin:0; display:inline;">E-PLUS CLOUD-ERP</h2>
                    <p style="margin:5px 0 0;">Password Reset Request</p>
                </div>

                <div style="padding:25px; color:#333;">
                    <p>Hello,</p>

                    <p>
                        We received a request to reset the password for your account. Below is your OTP for completing the password reset process.
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
                        Please note: This OTP is valid for 5 minutes. If you did not request a password reset, please ignore this email.
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
async function sendLogOutMail({ to, corpId, otp, subject }) {
    let isMail = await transporter.sendMail({
        from: '"EPLUS Support" <demo@tcodes.in>',
        to,
        subject: `OTP for ${corpId} to Force Logout`,
        html: `
            <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
            <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 0 10px rgba(0,0,0,0.08);">
                
                <div style="background:#0d6efd; color:#ffffff; padding:20px; text-align:center;">
                    <img src="E-Plus_Logo.jpg" alt="E-PLUS Logo" style="max-height:50px; vertical-align:middle; margin-right:10px;"/>
                    <h2 style="margin:0; display:inline;">E-PLUS CLOUD-ERP</h2>
                    <p style="margin:5px 0 0;">Logout Request</p>
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
    return;
}


module.exports = { sendAccountInfoMail, sendResetMail, sendLogOutMail };