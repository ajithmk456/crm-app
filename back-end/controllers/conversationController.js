const Conversation = require('../models/Conversation');

exports.getConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find().sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
};