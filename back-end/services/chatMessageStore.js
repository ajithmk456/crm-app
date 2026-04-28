// In-memory message store for quick chat debugging and lightweight deployments.
// Replace with Mongo persistence later if long-term history is required.
const chatMessages = [];

const normalizePhone = (value) => {
  if (!value) {
    return '';
  }
  return String(value).replace(/^whatsapp:/i, '').trim();
};

const normalizeStatus = (value, fallback = 'sent') => {
  const status = String(value || '').toLowerCase();
  if (status === 'delivered' || status === 'read' || status === 'failed' || status === 'sent') {
    return status;
  }
  return fallback;
};

const normalizeDirection = (value, fallback = 'out') => {
  const direction = String(value || '').toLowerCase();
  if (direction === 'in' || direction === 'out') {
    return direction;
  }
  return fallback;
};

const toDate = (value) => {
  if (!value) {
    return new Date();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const saveMessage = (message) => {
  const normalized = {
    messageId: message.messageId || '',
    phone: normalizePhone(message.phone),
    text: String(message.text || ''),
    direction: normalizeDirection(message.direction),
    status: normalizeStatus(message.status),
    timestamp: toDate(message.timestamp),
    source: normalizePhone(message.source),
    destination: normalizePhone(message.destination),
    reason: message.reason ? String(message.reason) : undefined,
  };

  if (normalized.messageId) {
    const existingIndex = chatMessages.findIndex((item) => item.messageId === normalized.messageId);
    if (existingIndex !== -1) {
      chatMessages[existingIndex] = {
        ...chatMessages[existingIndex],
        ...normalized,
        // Preserve existing text when a status event has no text.
        text: normalized.text || chatMessages[existingIndex].text,
      };
      return chatMessages[existingIndex];
    }
  }

  chatMessages.push(normalized);
  return normalized;
};

const updateMessageStatus = ({ messageId, status, destination, source, timestamp, reason }) => {
  const normalizedMessageId = String(messageId || '').trim();
  const normalizedDestination = normalizePhone(destination);
  const normalizedSource = normalizePhone(source);
  const normalizedStatus = normalizeStatus(status, 'sent');

  if (!normalizedMessageId) {
    return null;
  }

  const existing = chatMessages.find((item) => item.messageId === normalizedMessageId);
  if (existing) {
    existing.status = normalizedStatus;
    existing.timestamp = toDate(timestamp);
    existing.destination = normalizedDestination || existing.destination;
    existing.source = normalizedSource || existing.source;
    existing.phone = existing.phone || normalizedDestination || normalizedSource;
    if (reason) {
      existing.reason = String(reason);
    }
    return existing;
  }

  // If we receive a status before the send API response is stored, create a fallback message.
  const fallback = {
    messageId: normalizedMessageId,
    phone: normalizedDestination || normalizedSource,
    text: '',
    direction: 'out',
    status: normalizedStatus,
    timestamp: toDate(timestamp),
    source: normalizedSource,
    destination: normalizedDestination,
    reason: reason ? String(reason) : undefined,
  };

  chatMessages.push(fallback);
  return fallback;
};

const getMessagesByPhone = (phone) => {
  const normalizedPhone = normalizePhone(phone);
  return chatMessages
    .filter((item) => item.phone === normalizedPhone || item.source === normalizedPhone || item.destination === normalizedPhone)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

const getConversationSummaries = () => {
  const byPhone = new Map();

  for (const message of chatMessages) {
    const phone = normalizePhone(message.phone || message.source || message.destination);
    if (!phone) {
      continue;
    }

    const existing = byPhone.get(phone);
    if (!existing) {
      byPhone.set(phone, {
        _id: phone,
        phoneNumber: phone,
        lastMessage: message.text || '',
        updatedAt: new Date(message.timestamp || new Date()),
      });
      continue;
    }

    const existingTime = new Date(existing.updatedAt).getTime();
    const currentTime = new Date(message.timestamp || new Date()).getTime();
    if (currentTime >= existingTime) {
      existing.lastMessage = message.text || existing.lastMessage;
      existing.updatedAt = new Date(message.timestamp || new Date());
    }
  }

  return Array.from(byPhone.values()).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
};

module.exports = {
  normalizePhone,
  normalizeStatus,
  saveMessage,
  updateMessageStatus,
  getMessagesByPhone,
  getConversationSummaries,
  // Exposed only for temporary debugging/testing.
  chatMessages,
};
