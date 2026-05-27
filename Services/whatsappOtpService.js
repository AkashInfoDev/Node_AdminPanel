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

module.exports = {
  sendWhatsAppOTP
};