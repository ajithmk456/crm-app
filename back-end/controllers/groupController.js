const Group = require('../models/Group');
const Client = require('../models/Client');

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

/**
 * Sync client groups: when assigning clients to a group,
 * also update each client's groups array
 */
const syncClientGroups = async (groupId, clientIds) => {
  const group = await Group.findById(groupId);
  if (!group) return;

  // Get old client IDs
  const oldClientIds = group.clients.map((id) => String(id));

  // Clients to add to group's groups array
  const toAdd = clientIds.filter((id) => !oldClientIds.includes(String(id)));

  // Clients to remove from group's groups array
  const toRemove = oldClientIds.filter((id) => !clientIds.includes(String(id)));

  // Update clients: add this group
  if (toAdd.length > 0) {
    await Client.updateMany(
      { _id: { $in: toAdd } },
      { $addToSet: { groups: groupId } }
    );
  }

  // Update clients: remove this group
  if (toRemove.length > 0) {
    await Client.updateMany(
      { _id: { $in: toRemove } },
      { $pull: { groups: groupId } }
    );
  }
};

exports.createGroup = async (req, res, next) => {
  try {
    const { name, contacts, clients } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }
    const normalized = normalizeContacts(contacts);
    const clientIds = Array.isArray(clients) ? clients.filter((id) => id) : [];

    const group = await Group.create({
      name,
      contacts: normalized,
      clients: clientIds,
      createdBy: req.user._id,
    });

    // Sync client groups
    if (clientIds.length > 0) {
      await syncClientGroups(group._id, clientIds);
    }

    const populated = await Group.findById(group._id)
      .populate('createdBy', 'name email')
      .populate('clients', 'name mobile');

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
    const groups = await Group.find(query)
      .populate('createdBy', 'name email')
      .populate('clients', 'name mobile')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: groups.length, data: groups });
  } catch (error) {
    next(error);
  }
};

exports.getGroupById = async (req, res, next) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('clients', 'name mobile notes');

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
    const { name, contacts, clients } = req.body;
    if (name) group.name = name;
    if (contacts !== undefined) {
      group.contacts = normalizeContacts(contacts);
    }
    if (clients !== undefined) {
      const clientIds = Array.isArray(clients) ? clients.filter((id) => id) : [];
      group.clients = clientIds;
      await group.save();
      // Sync client groups
      await syncClientGroups(group._id, clientIds);
    } else {
      await group.save();
    }

    const updated = await Group.findById(group._id)
      .populate('createdBy', 'name email')
      .populate('clients', 'name mobile notes');

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/groups/:id/assign-clients
 * Assign clients to a group
 */
exports.assignClientsToGroup = async (req, res, next) => {
  try {
    const { clientIds } = req.body;
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const validClientIds = Array.isArray(clientIds) ? clientIds.filter((id) => id) : [];

    group.clients = validClientIds;
    await group.save();

    // Sync client groups
    await syncClientGroups(group._id, validClientIds);

    const updated = await Group.findById(group._id)
      .populate('createdBy', 'name email')
      .populate('clients', 'name mobile notes');

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

    // Remove this group from all clients
    await Client.updateMany(
      { groups: group._id },
      { $pull: { groups: group._id } }
    );

    res.status(200).json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    next(error);
  }
};
