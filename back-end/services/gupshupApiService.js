const axios = require('axios');

const GUPSHUP_SEND_URL = process.env.GUPSHUP_SEND_URL || 'https://api.gupshup.io/wa/api/v1/msg';
const GUPSHUP_SOURCE = process.env.GUPSHUP_SOURCE || '916384322139';
const GUPSHUP_SRC_NAME = process.env.GUPSHUP_SRC_NAME || '';

const normalizeDestination = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  // If user enters a 10-digit Indian mobile number, auto-prefix country code.
  if (digits.length === 10) {
    return `91${digits}`;
  }

  return digits;
};

const normalizeAttachmentFilename = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return `attachment-${Date.now()}`;
  }

  // Keep provider-safe filename characters and replace spaces/special chars with underscores.
  return raw.replace(/[^a-zA-Z0-9._-]/g, '_');
};

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

const buildBaseForm = (destination) => {
  const form = new URLSearchParams();
  form.append('channel', 'whatsapp');
  form.append('source', GUPSHUP_SOURCE);
  form.append('destination', destination);
  if (GUPSHUP_SRC_NAME) {
    form.append('src.name', GUPSHUP_SRC_NAME);
  }
  return form;
};

const sendGupshupMessage = async (form) => {
  const apiKey = process.env.GUPSHUP_API_KEY || process.env.GUPSHUP_APIKEY;
  if (!apiKey) {
    throw new Error('GUPSHUP_API_KEY is not configured.');
  }

  const response = await axios.post(GUPSHUP_SEND_URL, form.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      apikey: apiKey,
    },
    timeout: 15000,
  });

  return {
    messageId: extractMessageId(response.data),
    providerResponse: response.data,
  };
};

const sendGupshupTextMessage = async ({ to, message }) => {
  const destination = normalizeDestination(to);
  if (!destination) {
    throw new Error('A valid destination number is required.');
  }

  // Gupshup requires x-www-form-urlencoded payload.
  const form = buildBaseForm(destination);
  form.append('message', JSON.stringify({
    type: 'text',
    text: String(message),
  }));

  return sendGupshupMessage(form);
};

const sendGupshupFileMessage = async ({ to, fileUrl, filename }) => {
  const destination = normalizeDestination(to);
  if (!destination) {
    throw new Error('A valid destination number is required.');
  }

  if (!fileUrl) {
    throw new Error('fileUrl is required to send a file message.');
  }

  const providerFilename = normalizeAttachmentFilename(filename);

  const form = buildBaseForm(destination);
  form.append('message', JSON.stringify({
    type: 'file',
    file: {
      link: String(fileUrl),
      filename: providerFilename,
    },
  }));

  return sendGupshupMessage(form);
};

module.exports = {
  normalizeDestination,
  sendGupshupTextMessage,
  sendGupshupFileMessage,
};
