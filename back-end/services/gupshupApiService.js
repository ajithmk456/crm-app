const axios = require('axios');

const GUPSHUP_SEND_URL = process.env.GUPSHUP_SEND_URL || 'https://api.gupshup.io/wa/api/v1/msg';
const GUPSHUP_SOURCE = process.env.GUPSHUP_SOURCE || '916384322139';

const extractMessageId = (responseBody) => {
  if (!responseBody || typeof responseBody !== 'object') {
    return '';
  }

  return (
    responseBody.messageId
    || responseBody.id
    || responseBody.message_id
    || responseBody?.data?.messageId
    || responseBody?.data?.id
    || responseBody?.message?.id
    || ''
  );
};

const sendGupshupTextMessage = async ({ to, message }) => {
  const apiKey = process.env.GUPSHUP_API_KEY || process.env.GUPSHUP_APIKEY;
  if (!apiKey) {
    throw new Error('GUPSHUP_API_KEY is not configured.');
  }

  // Gupshup requires x-www-form-urlencoded payload.
  const form = new URLSearchParams();
  form.append('channel', 'whatsapp');
  form.append('source', GUPSHUP_SOURCE);
  form.append('destination', String(to));
  form.append('message', String(message));

  const response = await axios.post(GUPSHUP_SEND_URL, form.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      apikey: apiKey,
    },
    timeout: 15000,
  });

  const messageId = extractMessageId(response.data);

  return {
    messageId,
    providerResponse: response.data,
  };
};

module.exports = {
  sendGupshupTextMessage,
};
