const getFetch = async () => {
  if (typeof global.fetch === 'function') {
    return global.fetch.bind(global);
  }

  const { default: fetch } = await import('node-fetch');
  return fetch;
};

const normalizePhoneNumber = (value) => String(value || '').replace(/^whatsapp:/i, '').trim();

const getWhatsAppProvider = () => {
  if (process.env.WHATSAPP_PROVIDER) {
    return process.env.WHATSAPP_PROVIDER.toLowerCase();
  }

  if (process.env.META_WHATSAPP_TOKEN && process.env.META_PHONE_NUMBER_ID) {
    return 'meta';
  }

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM) {
    return 'twilio';
  }

  throw new Error('WhatsApp provider is not configured. Set Meta or Twilio environment variables.');
};

const sendViaMeta = async (to, message) => {
  const fetch = await getFetch();
  const response = await fetch(
    `https://graph.facebook.com/v22.0/${process.env.META_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.META_WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      }),
    }
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Meta WhatsApp API request failed.');
  }

  return {
    provider: 'meta',
    success: true,
    messageId: payload?.messages?.[0]?.id,
    raw: payload,
  };
};

const sendViaTwilio = async (to, message) => {
  const fetch = await getFetch();
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const body = new URLSearchParams({
    To: `whatsapp:${to}`,
    From: `whatsapp:${normalizePhoneNumber(from)}`,
    Body: message,
  });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    }
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || 'Twilio WhatsApp API request failed.');
  }

  return {
    provider: 'twilio',
    success: true,
    messageId: payload?.sid,
    raw: payload,
  };
};

async function sendMessage(to, message) {
  const phoneNumber = normalizePhoneNumber(to);
  if (!phoneNumber || phoneNumber.length < 6) {
    throw new Error('A valid destination phone number is required.');
  }

  if (!message || !String(message).trim()) {
    throw new Error('Message text is required.');
  }

  const provider = getWhatsAppProvider();
  if (provider === 'meta') {
    return sendViaMeta(phoneNumber, String(message).trim());
  }

  if (provider === 'twilio') {
    return sendViaTwilio(phoneNumber, String(message).trim());
  }

  throw new Error(`Unsupported WhatsApp provider: ${provider}`);
}

async function sendWhatsAppMessage(phone, message) {
  try {
    const result = await sendMessage(phone, message);
    return { success: true, messageId: result.messageId, provider: result.provider };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { sendMessage, sendWhatsAppMessage };
