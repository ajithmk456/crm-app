const Enquiry = require('../models/Enquiry');

exports.createContactEnquiry = async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    const phone = (req.body.phone || '').trim();
    const message = (req.body.message || '').trim();

    if (!name || name.length < 2) {
      return res.status(400).json({ success: false, message: 'Name is required (min 2 characters).' });
    }

    if (!/^\d{10,15}$/.test(phone)) {
      return res.status(400).json({ success: false, message: 'Phone number must be 10 to 15 digits.' });
    }

    if (!message || message.length < 5) {
      return res.status(400).json({ success: false, message: 'Message is required (min 5 characters).' });
    }

    await Enquiry.create({ name, phone, message });

    res.status(201).json({
      success: true,
      message: 'Your enquiry has been submitted successfully. Our team will contact you shortly.',
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteContactEnquiry = async (req, res, next) => {
  try {
    const enquiry = await Enquiry.findByIdAndDelete(req.params.id);
    if (!enquiry) {
      return res.status(404).json({ success: false, message: 'Enquiry not found.' });
    }
    res.status(200).json({ success: true, message: 'Enquiry removed successfully.' });
  } catch (error) {
    next(error);
  }
};
