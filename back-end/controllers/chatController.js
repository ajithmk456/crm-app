const { sendGupshupTextMessage } = require('../services/gupshupApiService');
const {
  saveMessage,
  updateMessageStatus,
  getMessagesByPhone,
  getConversationSummaries,
  normalizePhone,
  normalizeStatus,
} = require('../services/chatMessageStore');
const { emitChatUpdate } = require('../services/socketService');

// POST /api/chat/send
// Sends a WhatsApp message through Gupshup and stores a local outgoing record.
exports.sendChatMessage = async (req, res, next) => {
  try {
    const { to, message } = req.body || {};

    if (!to || !message) {
      return res.status(400).json({ success: false, message: 'to and message are required.' });
    }

    const result = await sendGupshupTextMessage({ to, message });
    const messageId = result.messageId || `local-${Date.now()}`;

    saveMessage({
      messageId,
      phone: to,
      text: message,
      direction: 'out',
      status: 'sent',
      timestamp: new Date(),
      destination: to,
      source: process.env.GUPSHUP_SOURCE || '916384322139',
    });

    emitChatUpdate({
      eventType: 'outgoing',
      phone: normalizePhone(to),
      messageId,
      status: 'sent',
    });

    return res.status(200).json({
      success: true,
      data: {
        messageId,
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /webhook/gupshup helper
// Normalizes and stores incoming/status events from Gupshup webhook payload.
exports.processGupshupWebhook = (body) => {
  const payload = body?.payload || {};
  const eventType = String(body?.type || '').toLowerCase();
  const businessSource = normalizePhone(process.env.GUPSHUP_SOURCE || '');

  const messageId = payload.id || payload.messageId || payload.gsId || payload.message_id || '';
  const destination = normalizePhone(payload.destination || payload.to);
  const source = normalizePhone(payload.source || payload.from);
  const status = normalizeStatus(payload.status, 'sent');
  const text = payload.text || payload.body || payload.message || '';
  const reason = payload.reason || '';
  const isFromBusiness = Boolean(businessSource && source && source === businessSource);
  const phone = isFromBusiness ? destination : (source || destination);

  const isStatusUpdate = Boolean(payload.status);
  const isIncomingEvent = eventType.includes('message') || (!isStatusUpdate && Boolean(text));

  if (isStatusUpdate) {
    const updated = updateMessageStatus({
      messageId,
      status,
      destination,
      source,
      timestamp: payload.timestamp || new Date(),
      reason,
    });

    emitChatUpdate({
      eventType: 'status',
      phone: destination || source,
      messageId,
      status,
      source,
      destination,
    });

    return updated;
  }

  if (isIncomingEvent) {
    const saved = saveMessage({
      messageId: messageId || `incoming-${Date.now()}`,
      phone,
      text,
      direction: isFromBusiness ? 'out' : 'in',
      status: 'sent',
      timestamp: payload.timestamp || new Date(),
      source,
      destination,
    });

    emitChatUpdate({
      eventType: 'incoming',
      phone: source,
      messageId: saved.messageId,
      status: 'sent',
      text,
      source,
      destination,
    });

    return saved;
  }

  return null;
};

// GET /api/chat/:phone
// Returns all message records for a phone number sorted by timestamp.
exports.getChatByPhone = async (req, res, next) => {
  try {
    const phone = req.params.phone;
    if (!phone) {
      return res.status(400).json({ success: false, message: 'phone is required.' });
    }

    const messages = getMessagesByPhone(phone).map((item) => ({
      phone: item.phone,
      text: item.text,
      direction: item.direction,
      status: item.status,
      timestamp: item.timestamp,
      messageId: item.messageId,
    }));

    return res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/chat/conversations
// Returns chat conversation summaries for sidebar listing.
exports.getChatConversations = async (req, res, next) => {
  try {
    const conversations = getConversationSummaries().map((item) => ({
      ...item,
      updatedAt: new Date(item.updatedAt).toISOString(),
    }));

    return res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
};
