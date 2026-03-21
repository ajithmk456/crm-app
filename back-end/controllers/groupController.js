const Group = require('../models/Group');

const normalizeContacts = (contactsInput) => {
  let contacts = [];
  if (!contactsInput) return contacts;

  if (typeof contactsInput === 'string') {
    const parts = contactsInput.split(',').map((item) => item.trim()).filter(Boolean);
    contacts = parts.map((phone) => ({ phone }));
  } else if (Array.isArray(contactsInput)) {
    contacts = contactsInput.map((item) => {
      if (typeof item === 'string') {
        return { phone: item.trim() };
      }
      return { name: item.name?.trim(), phone: (item.phone || '').trim() };
    });
  } else if (typeof contactsInput === 'object') {
    contacts = [{ name: contactsInput.name?.trim(), phone: (contactsInput.phone || '').trim() }];
  }

  contacts = contacts.filter((c) => c.phone);
  const valid = contacts.filter((c) => /^\+?[0-9]{6,15}$/.test(c.phone));
  const unique = [];
  const seen = new Set();
  for (const c of valid) {
    const key = c.phone;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push({ name: c.name || '', phone: c.phone });
    }
  }
  return unique.slice(0, 1000);
};

exports.createGroup = async (req, res, next) => {
  try {
    const { name, contacts } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }
    const normalized = normalizeContacts(contacts);
    const group = await Group.create({
      name,
      contacts: normalized,
      createdBy: req.user._id,
    });
    const populated = await Group.findById(group._id).populate('createdBy', 'name email');
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

exports.getGroups = async (req, res, next) => {
  try {
    const { search } = req.query;
    const query = {};
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    const groups = await Group.find(query).populate('createdBy', 'name email').sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: groups.length, data: groups });
  } catch (error) {
    next(error);
  }
};

exports.getGroupById = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id).populate('createdBy', 'name email');
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    res.status(200).json({ success: true, data: group });
  } catch (error) {
    next(error);
  }
};

exports.updateGroup = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    const { name, contacts } = req.body;
    if (name) group.name = name;
    if (contacts !== undefined) {
      group.contacts = normalizeContacts(contacts);
    }
    await group.save();
    const updated = await Group.findById(group._id).populate('createdBy', 'name email');
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.deleteGroup = async (req, res, next) => {
  try {
    const group = await Group.findByIdAndDelete(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    res.status(200).json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    next(error);
  }
};
