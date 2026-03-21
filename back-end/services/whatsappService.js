async function sendWhatsAppMessage(phone, message, attachmentUrl) {
  // Replace with actual WhatsApp Cloud API call logic in production.
  await new Promise((resolve) => setTimeout(resolve, 50));
  if (!phone || phone.length < 6) {
    return { success: false, error: 'Invalid phone number' };
  }

  const isSuccess = Math.random() > 0.08;
  return isSuccess
    ? { success: true, messageId: `msg_${Date.now()}` }
    : { success: false, error: 'WhatsApp API failed' };
}

module.exports = { sendWhatsAppMessage };
