const Group = require('../models/Group');
const MessageLog = require('../models/MessageLog');
const Message = require('../models/Message');
const { sendWhatsAppMessage, sendMessage: sendWhatsAppChatMessage } = require('../services/whatsappService');
const { sendFast2SmsBulk, normalizeIndianMobile } = require('../services/fast2smsService');

exports.sendBulkMessage = async (req, res, next) => {
  let log = null;
  try {
    const { groupId, message, channel = 'sms' } = req.body;
    const normalizedChannel = String(channel).toLowerCase();

    if (!groupId || !message) {
      return res.status(400).json({ success: false, message: 'groupId and message are required.' });
    }

    if (!['sms', 'whatsapp'].includes(normalizedChannel)) {
      return res.status(400).json({ success: false, message: "channel must be either 'sms' or 'whatsapp'." });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const contacts = (group.contacts || []).map((contact) => ({
      name: contact.name || '',
      mobile: contact.phone || contact.mobile || '',
    }));

    const totalRecipients = contacts.length;
    if (!totalRecipients) {
      return res.status(400).json({ success: false, message: 'Group has no contacts to send.' });
    }

    log = await MessageLog.create({
      groupId,
      message,
      channel: normalizedChannel,
      sentBy: req.user._id,
      totalRecipients,
      sentCount: 0,
      successCount: 0,
      failedCount: 0,
      status: 'Processing',
    });

    let sentCount = 0;
    let failedCount = 0;
    let firstDeliveryError = '';

    if (normalizedChannel === 'sms') {
      const allNumbers = contacts
        .map((contact) => normalizeIndianMobile(contact.mobile))
        .filter(Boolean);

      if (!allNumbers.length) {
        return res.status(400).json({ success: false, message: 'No valid mobile numbers available in this group.' });
      }

      const uniqueNumbers = Array.from(new Set(allNumbers));
      const smsBatchSize = 200;

      for (let i = 0; i < uniqueNumbers.length; i += smsBatchSize) {
        const batchNumbers = uniqueNumbers.slice(i, i + smsBatchSize);
        try {
          const smsResult = await sendFast2SmsBulk({ message, numbers: batchNumbers });
          sentCount += smsResult.acceptedCount;
        } catch (error) {
          failedCount += batchNumbers.length;
          if (!firstDeliveryError) {
            firstDeliveryError = error.message || 'SMS delivery failed for one or more batches.';
          }
        }
      }
    } else {
      const batchSize = 25;
      for (let i = 0; i < contacts.length; i += batchSize) {
        const batch = contacts.slice(i, i + batchSize);
        const promises = batch.map(async (contact) => {
          const result = await sendWhatsAppMessage(contact.mobile, message);
          if (result.success) {
            sentCount += 1;
          } else {
            failedCount += 1;
          }
        });
        await Promise.all(promises);
      }
    }

    log.sentCount = sentCount;
    log.successCount = sentCount;
    log.failedCount = failedCount;
    log.status = sentCount > 0 ? 'Completed' : 'Failed';
    await log.save();

    if (sentCount === 0 && failedCount > 0) {
      const normalizedDeliveryError = String(firstDeliveryError || '').toLowerCase();
      const requiresFast2SmsActivation = normalizedDeliveryError.includes('complete one transaction of 100 inr')
        || normalizedDeliveryError.includes('before using api route');

      const failureStatusCode = requiresFast2SmsActivation ? 402 : 502;
      const failureMessage = requiresFast2SmsActivation
        ? 'Fast2SMS account activation required: complete one transaction of 100 INR or more in Fast2SMS before using this SMS route.'
        : (firstDeliveryError || 'Failed to deliver messages for the selected channel.');

      return res.status(failureStatusCode).json({
        success: false,
        message: failureMessage,
        sentCount: 0,
      });
    }

    return res.status(200).json({ success: true, sentCount });
  } catch (error) {
    if (log) {
      try {
        log.status = 'Failed';
        await log.save();
      } catch {
        // Ignore log update failure to preserve original error path.
      }
    }
    next(error);
  }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ success: false, message: 'to and message are required.' });
    }

    const result = await sendWhatsAppChatMessage(to, message);

    return res.status(200).json({
      success: true,
      data: {
        provider: result.provider,
        messageId: result.messageId,
      },
      message: 'Message request accepted. It will be persisted when the webhook is received.',
    });
  } catch (error) {
    next(error);
  }
};

exports.getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.query;

    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'conversationId is required.' });
    }

    const messages = await Message.find({ conversationId }).sort({ timestamp: 1, createdAt: 1 });

    return res.status(200).json({
      success: true,
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

