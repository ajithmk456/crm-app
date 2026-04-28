// In-memory message store for quick chat debugging and lightweight deployments.
// Replace with Mongo persistence later if long-term history is required.
const chatMessages = [];

const normalizePhone = (value) => {
  if (!value) {
    return '';
  }
  return String(value).replace(/^whatsapp:/i, '').replace(/\D/g, '').trim();
};

const normalizeStatus = (value, fallback = 'sent') => {
  const status = String(value || '').toLowerCase();
  if (status === 'submitted' || status === 'enqueued' || status === 'queued') {
    return 'sent';
  }
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

const findBestOutgoingMatch = ({ phone, timestamp }) => {
  if (!phone) {
    return null;
  }

  const statusTime = toDate(timestamp).getTime();
  const windowMs = 15 * 60 * 1000;
  let best = null;
  let bestDelta = Number.MAX_SAFE_INTEGER;

  for (const item of chatMessages) {
    if (item.direction !== 'out') {
      continue;
    }

    const hasText = Boolean(String(item.text || '').trim());
    if (!hasText) {
      continue;
    }

    const samePhone = item.phone === phone || item.destination === phone || item.source === phone;
    if (!samePhone) {
      continue;
    }

    const itemTime = toDate(item.timestamp).getTime();
    const delta = Math.abs(statusTime - itemTime);
    if (delta > windowMs || delta >= bestDelta) {
      continue;
    }

    best = item;
    bestDelta = delta;
  }

  return best;
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
      const existing = chatMessages[existingIndex];
      chatMessages[existingIndex] = {
        ...existing,
        ...normalized,
        // Preserve key fields when webhook payload omits or sends blank values.
        phone: existing.phone || normalized.phone,
        source: existing.source || normalized.source,
        destination: existing.destination || normalized.destination,
        // Keep previously-established direction to avoid webhook echo flipping out->in.
        direction: existing.direction || normalized.direction,
        status: normalized.status || existing.status,
        // Preserve existing text when a status event has no text.
        text: normalized.text || existing.text,
      };
      return chatMessages[existingIndex];
    }
  }

  chatMessages.push(normalized);
  return normalized;
};

const updateMessageStatus = ({ messageId, status, destination, source, timestamp, reason, phone }) => {
  const normalizedMessageId = String(messageId || '').trim();
  const normalizedDestination = normalizePhone(destination);
  const normalizedSource = normalizePhone(source);
  const normalizedStatus = normalizeStatus(status, 'sent');
  const normalizedPhone = normalizePhone(phone);
  const targetPhone = normalizedPhone || normalizedDestination || normalizedSource;

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

  // Gupshup can send different IDs for status callbacks than send responses.
  // Match by phone + timestamp window so one outgoing bubble progresses sent/delivered/read.
  const matchedOutgoing = findBestOutgoingMatch({
    phone: targetPhone,
    timestamp,
  });
  if (matchedOutgoing) {
    matchedOutgoing.status = normalizedStatus;
    matchedOutgoing.timestamp = toDate(timestamp);
    matchedOutgoing.destination = normalizedDestination || matchedOutgoing.destination;
    matchedOutgoing.source = normalizedSource || matchedOutgoing.source;
    matchedOutgoing.phone = matchedOutgoing.phone || targetPhone;
    if (reason) {
      matchedOutgoing.reason = String(reason);
    }
    return matchedOutgoing;
  }

  // If we receive a status before the send API response is stored, create a fallback message.
  const fallback = {
    messageId: normalizedMessageId,
    phone: targetPhone,
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
