const Group = require('../models/Group');
const MessageLog = require('../models/MessageLog');
const { sendWhatsAppMessage } = require('../services/whatsappService');

exports.sendBulkMessage = async (req, res, next) => {
  try {
    const { groupId, message, attachmentUrl } = req.body;
    if (!groupId || !message) {
      return res.status(400).json({ success: false, message: 'groupId and message are required.' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const contacts = group.contacts || [];
    const totalRecipients = contacts.length;
    if (!totalRecipients) {
      return res.status(400).json({ success: false, message: 'Group has no contacts to send.' });
    }

    const log = await MessageLog.create({
      groupId,
      message,
      attachmentUrl,
      sentBy: req.user._id,
      totalRecipients,
      status: 'Processing',
    });

    const batchSize = 25;
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      const promises = batch.map((contact) => {
        return sendWhatsAppMessage(contact.phone, message, attachmentUrl).then((result) => {
          if (result.success) successCount += 1;
          else failedCount += 1;
        }).catch(() => {
          failedCount += 1;
        });
      });
      await Promise.all(promises);
    }

    log.successCount = successCount;
    log.failedCount = failedCount;
    log.status = failedCount === 0 ? 'Completed' : successCount > 0 ? 'Completed' : 'Failed';
    await log.save();

    return res.status(200).json({
      success: true,
      data: {
        logId: log._id,
        totalRecipients,
        successCount,
        failedCount,
        status: log.status,
      },
    });
  } catch (error) {
    next(error);
  }
};
