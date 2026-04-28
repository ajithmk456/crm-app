const { sendGupshupTextMessage, sendGupshupFileMessage } = require('../services/gupshupApiService');
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

    await saveMessage({
      messageId,
      phone: to,
      text: message,
      type: 'text',
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

// POST /api/chat/send-file
// Sends a WhatsApp file through Gupshup and stores a local outgoing record.
exports.sendChatFile = async (req, res, next) => {
  try {
    const { to, fileUrl, filename, mimeType } = req.body || {};

    if (!to || !fileUrl || !filename) {
      return res.status(400).json({
        success: false,
        message: 'to, fileUrl and filename are required.',
      });
    }

    const normalizedFileUrl = String(fileUrl || '').trim();
    const isSecureUrl = /^https:\/\//i.test(normalizedFileUrl);
    const isLocalDevUrl = /^http:\/\/(localhost|127\.0\.0\.1)/i.test(normalizedFileUrl);
    if (!isSecureUrl && !isLocalDevUrl) {
      return res.status(400).json({
        success: false,
        message: 'fileUrl must be publicly accessible via HTTPS.',
      });
    }

    const result = await sendGupshupFileMessage({
      to,
      fileUrl: normalizedFileUrl,
      filename,
      mimeType: mimeType || '',
    });
    const messageId = result.messageId || `local-file-${Date.now()}`;

    await saveMessage({
      messageId,
      phone: to,
      text: filename,
      type: 'file',
      fileUrl: normalizedFileUrl,
      filename,
      mimeType: mimeType || '',
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
exports.processGupshupWebhook = async (body) => {
  const payload = body?.payload || {};
  const nestedPayload = payload?.payload || {};
  const sender = payload?.sender || {};
  const context = payload?.context || {};
  const eventType = String(body?.type || '').toLowerCase();
  const businessSource = normalizePhone(process.env.GUPSHUP_SOURCE || '916384322139');
  const payloadType = String(payload.type || nestedPayload.type || '').toLowerCase();
  const rawStatus = payload.status || nestedPayload.status || payload.eventType || nestedPayload.eventType || payloadType;
  const hasExplicitStatus = ['sent', 'submitted', 'enqueued', 'queued', 'delivered', 'read', 'failed'].includes(String(rawStatus || '').toLowerCase());

  const payloadImage = payload.image || nestedPayload.image || {};
  const payloadDocument = payload.document || nestedPayload.document || {};
  const payloadMedia = payload.media || nestedPayload.media || {};
  const payloadFile = payload.file || nestedPayload.file || {};

  const messageId =
    payload.id ||
    payload.messageId ||
    payload.gsId ||
    payload.message_id ||
    nestedPayload.id ||
    nestedPayload.messageId ||
    nestedPayload.gsId ||
    nestedPayload.message_id ||
    '';
  const destination = normalizePhone(
    payload.destination ||
      payload.to ||
      nestedPayload.destination ||
      nestedPayload.to ||
      context.destination ||
      context.to ||
      context.phone
  );
  const source = normalizePhone(
    payload.source ||
      payload.from ||
      nestedPayload.source ||
      nestedPayload.from ||
      sender.phone ||
      sender.id ||
      context.source ||
      context.from
  );
  const status = normalizeStatus(rawStatus, 'sent');
  const normalizedPayloadType = String(payloadType || '').toLowerCase();
  const isMediaType = Boolean(normalizedPayloadType && normalizedPayloadType !== 'text');
  const text =
    payload.text ||
    payload.body ||
    payload.message ||
    nestedPayload.text ||
    nestedPayload.body ||
    nestedPayload.message ||
    nestedPayload.caption ||
    '';
  const attachmentUrl =
    payload.url ||
    payload.link ||
    payload.originalUrl ||
    payload.previewUrl ||
    payloadImage.url ||
    payloadImage.link ||
    payloadImage.originalUrl ||
    payloadImage.previewUrl ||
    payloadDocument.url ||
    payloadDocument.link ||
    payloadDocument.originalUrl ||
    payloadDocument.previewUrl ||
    payloadMedia.url ||
    payloadMedia.link ||
    payloadMedia.originalUrl ||
    payloadMedia.previewUrl ||
    payloadFile.url ||
    payloadFile.link ||
    payloadFile.originalUrl ||
    payloadFile.previewUrl ||
    payload?.file?.link ||
    payload?.file?.url ||
    nestedPayload.url ||
    nestedPayload.link ||
    nestedPayload.originalUrl ||
    nestedPayload.previewUrl ||
    nestedPayload?.image?.url ||
    nestedPayload?.image?.link ||
    nestedPayload?.image?.originalUrl ||
    nestedPayload?.image?.previewUrl ||
    nestedPayload?.document?.url ||
    nestedPayload?.document?.link ||
    nestedPayload?.document?.originalUrl ||
    nestedPayload?.document?.previewUrl ||
    nestedPayload?.media?.url ||
    nestedPayload?.media?.link ||
    nestedPayload?.media?.originalUrl ||
    nestedPayload?.media?.previewUrl ||
    nestedPayload?.file?.link ||
    nestedPayload?.file?.url ||
    '';
  const attachmentFilename =
    payload.filename ||
    payloadImage.filename ||
    payloadDocument.filename ||
    payloadMedia.filename ||
    payloadFile.filename ||
    payloadImage.caption ||
    payloadDocument.caption ||
    nestedPayload.filename ||
    nestedPayload?.image?.filename ||
    nestedPayload?.document?.filename ||
    nestedPayload?.media?.filename ||
    nestedPayload?.file?.filename ||
    '';
  const attachmentMimeType =
    payload.mimeType ||
    payload.mimetype ||
    payloadImage.mimeType ||
    payloadImage.mimetype ||
    payloadImage.contentType ||
    payloadDocument.mimeType ||
    payloadDocument.mimetype ||
    payloadDocument.contentType ||
    payloadMedia.mimeType ||
    payloadMedia.mimetype ||
    payloadMedia.contentType ||
    payloadFile.mimeType ||
    payloadFile.mimetype ||
    payloadFile.contentType ||
    nestedPayload.mimeType ||
    nestedPayload.mimetype ||
    nestedPayload?.image?.mimeType ||
    nestedPayload?.image?.mimetype ||
    nestedPayload?.image?.contentType ||
    nestedPayload?.document?.mimeType ||
    nestedPayload?.document?.mimetype ||
    nestedPayload?.document?.contentType ||
    nestedPayload?.media?.mimeType ||
    nestedPayload?.media?.mimetype ||
    nestedPayload?.media?.contentType ||
    nestedPayload?.file?.mimeType ||
    nestedPayload?.file?.mimetype ||
    '';
  const messageType = String(
    payload.type || nestedPayload.type || (attachmentUrl ? 'file' : 'text')
  ).toLowerCase();
  const isKnownMediaType = ['image', 'file', 'document', 'video', 'audio', 'sticker'].includes(messageType);
  const displayText = text || attachmentFilename || (isMediaType ? normalizedPayloadType : '');
  const reason = payload.reason || nestedPayload.reason || '';
  const eventTimestamp = payload.timestamp || nestedPayload.timestamp || new Date();
  const isFromBusiness = Boolean(
    businessSource &&
      ((source && source === businessSource) || (destination && destination !== businessSource && source === businessSource))
  );
  const phone = isFromBusiness ? destination : (source || destination);

  const isStatusUpdate = Boolean(payload.status || nestedPayload.status || hasExplicitStatus);
  const isIncomingEvent = eventType.includes('message') || (!isStatusUpdate && (Boolean(displayText) || isMediaType || Boolean(attachmentUrl)));

  if (isStatusUpdate) {
    const updated = await updateMessageStatus({
      messageId,
      status,
      destination,
      source,
      timestamp: eventTimestamp,
      reason,
      phone,
    });

    emitChatUpdate({
      eventType: 'status',
      phone,
      messageId,
      status,
      source,
      destination,
    });

    return updated;
  }

  if (isIncomingEvent) {
    // Ignore non-status events that have no text and no usable phone fields.
    if (!String(text || '').trim() && !source && !destination) {
      return null;
    }

    const saved = await saveMessage({
      messageId: messageId || `incoming-${Date.now()}`,
      phone,
      text: displayText,
      type: isKnownMediaType || attachmentUrl ? 'file' : 'text',
      fileUrl: attachmentUrl,
      filename: attachmentFilename,
      mimeType: attachmentMimeType,
      direction: isFromBusiness ? 'out' : 'in',
      status: 'sent',
      timestamp: eventTimestamp,
      source,
      destination,
    });

    emitChatUpdate({
      eventType: isFromBusiness ? 'outgoing' : 'incoming',
      phone,
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

    const messages = (await getMessagesByPhone(phone)).map((item) => ({
      phone: item.phone,
      text: item.text,
      type: item.type || 'text',
      fileUrl: item.fileUrl || '',
      filename: item.filename || '',
      mimeType: item.mimeType || '',
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
    const conversations = (await getConversationSummaries()).map((item) => ({
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
