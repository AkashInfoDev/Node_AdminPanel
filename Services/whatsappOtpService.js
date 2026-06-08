const { default: axios } = require("axios");

require("dotenv").config();

async function sendWhatsAppOTP(phone, otp) {
  const token = process.env.META_WHATSAPP_TOKEN;
  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

  // Clean phone number
  let cleanPhone = phone.replace(/\D/g, "");

  // Add India country code if missing
  if (cleanPhone.length === 10) {
    cleanPhone = "91" + cleanPhone;
  }

  // Local development fallback
  if (!token || !phoneId || token === "meta_mock_token") {
    console.log("-----------------------------------------");
    console.log(`[DEV OTP] [WHATSAPP] Sent OTP ${otp} to ${phone}`);
    console.log("-----------------------------------------");

    return {
      success: true,
      channel: "whatsapp",
      gatewayResponse: {
        mock: true,
        message: "Logged to console"
      }
    };
  }

  try {
    const url = `https://graph.facebook.com/v25.0/${phoneId}/messages`;

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: "template",
      template: {
        name: "otp_verification",
        language: {
          code: "en"
        },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: otp
              }
            ]
          },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [
              {
                type: "text",
                text: otp
              }
            ]
          }
        ]
      }
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Meta WhatsApp API error:", data);

      return {
        success: false,
        channel: "whatsapp",
        error: data.error?.message || "Failed to send WhatsApp message"
      };
    }

    return {
      success: true,
      channel: "whatsapp",
      gatewayResponse: data
    };

  } catch (error) {
    console.error("Failed to send WhatsApp OTP:", error);

    return {
      success: false,
      channel: "whatsapp",
      error: error.message || "Network error"
    };
  }
}

// async function sendWhatsAppTemplate(name, corpId, userName, password, phone) {
//   try {
//     const token = process.env.META_WHATSAPP_TOKEN;
//     const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
//     const response = await axios.post(
//       `https://graph.facebook.com/v23.0/${phoneId}/messages`,
//       {
//         messaging_product: "whatsapp",
//         to: "91" + (phone.toString()),
//         type: "template",
//         template: {
//           name: "eplus_account_created",
//           language: {
//             code: "en"
//           },
//           components: [
//             {
//               type: "body",
//               parameters: [
//                 {
//                   type: "text",
//                   text: name.toString() // {{1}}
//                 },
//                 {
//                   type: "text",
//                   text: corpId.toString() // {{2}}
//                 },
//                 {
//                   type: "text",
//                   text: userName.toString() // {{3}}
//                 },
//                 {
//                   type: "text",
//                   text: password.toString() // {{4}}
//                 }
//               ]
//             }
//           ]
//         }
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "Content-Type": "application/json"
//         }
//       }
//     );

//     console.log("Message sent:", response.data);
//   } catch (error) {
//     console.error(
//       "Error:",
//       error.response?.data || error.message
//     );
//   }
// }

async function sendWhatsAppTemplate(
  name,
  corpId,
  userName,
  password,
  phone
) {
  try {
    const token = process.env.META_WHATSAPP_TOKEN;
    const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;

    // Validate environment variables
    if (!token) {
      throw new Error("META_WHATSAPP_TOKEN is not configured");
    }

    if (!phoneId) {
      throw new Error("META_WHATSAPP_PHONE_NUMBER_ID is not configured");
    }

    // Validate phone number
    if (!phone) {
      throw new Error("Phone number is required");
    }

    // Remove all non-numeric characters
    let formattedPhone = phone.toString().replace(/\D/g, "");

    // Add India country code if not present
    if (!formattedPhone.startsWith("91")) {
      formattedPhone = `91${formattedPhone}`;
    }

    const payload = {
      messaging_product: "whatsapp",
      to: formattedPhone,
      type: "template",
      template: {
        name: "eplus_account_created",
        language: {
          code: "en"
        },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                text: String(name || "")
              },
              {
                type: "text",
                text: String(corpId || "")
              },
              {
                type: "text",
                text: String(userName || "")
              },
              {
                type: "text",
                text: String(password || "")
              }
            ]
          }
        ]
      }
    };

    const response = await axios.post(
      `https://graph.facebook.com/v23.0/${phoneId}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        timeout: 30000
      }
    );

    console.log("WhatsApp message sent successfully");
    console.log("Response:", response.data);

    return {
      success: true,
      messageId: response.data?.messages?.[0]?.id || null,
      data: response.data
    };
  } catch (error) {
    const errorData = error.response?.data || error.message;

    console.error("WhatsApp API Error:", errorData);

    return {
      success: false,
      error: errorData
    };
  }
}

module.exports = {
  sendWhatsAppOTP,
  sendWhatsAppTemplate
};