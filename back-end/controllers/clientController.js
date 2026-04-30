const Client = require('../models/Client');
const Group = require('../models/Group');
const multer = require('multer');
const csv = require('csv-parse/sync');

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Format a raw phone number to +91XXXXXXXXXX.
 * Accepts: 10-digit, 91XXXXXXXXXX, +91XXXXXXXXXX.
 * Returns null if it cannot be normalised.
 */
const formatMobile = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 13 && String(raw).startsWith('+91')) return `+91${digits.slice(2)}`;
  return null;
};

// ─── Multer (in-memory for CSV upload) ────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

exports.csvUpload = upload.single('file');

// ─── GET /api/clients ──────────────────────────────────────────────────────────

exports.getClients = async (req, res, next) => {
  try {
    const { search, page = '1', limit = '20', sort = 'desc' } = req.query;
    const query = {};

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [{ name: regex }, { mobile: regex }, { alternateMobile: regex }];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;
    const sortOrder = sort === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      Client.find(query)
        .populate('groups', 'name')
        .sort({ createdAt: sortOrder })
        .skip(skip)
        .limit(limitNum),
      Client.countDocuments(query),
    ]);

    res.json({
      success: true,
      data,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/clients ─────────────────────────────────────────────────────────

exports.createClient = async (req, res, next) => {
  try {
    const { name, mobile, alternateMobile, whatsappOptIn, notes, groups } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required.' });
    }

    const formatted = formatMobile(mobile);
    if (!formatted) {
      return res.status(400).json({ success: false, message: 'Invalid mobile number.' });
    }

    const exists = await Client.findOne({ mobile: formatted });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Mobile number already exists.' });
    }

    const groupIds = Array.isArray(groups) ? groups.filter((id) => id) : [];

    const client = await Client.create({
      name: name.trim(),
      mobile: formatted,
      alternateMobile: alternateMobile ? (formatMobile(alternateMobile) || alternateMobile.trim()) : '',
      whatsappOptIn: whatsappOptIn !== undefined ? Boolean(whatsappOptIn) : true,
      notes: notes ? notes.trim() : '',
      groups: groupIds,
    });

    // Sync group-client relationships
    if (groupIds.length > 0) {
      await Group.updateMany(
        { _id: { $in: groupIds } },
        { $addToSet: { clients: client._id } }
      );
    }

    const populated = await Client.findById(client._id).populate('groups', 'name');
    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Mobile number already exists.' });
    }
    next(error);
  }
};

// ─── PUT /api/clients/:id ──────────────────────────────────────────────────────

exports.updateClient = async (req, res, next) => {
  try {
    const { name, mobile, alternateMobile, whatsappOptIn, notes, groups } = req.body;
    const update = {};

    if (name !== undefined) update.name = name.trim();

    if (mobile !== undefined) {
      const formatted = formatMobile(mobile);
      if (!formatted) {
        return res.status(400).json({ success: false, message: 'Invalid mobile number.' });
      }
      // Check uniqueness excluding current record
      const existing = await Client.findOne({ mobile: formatted, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Mobile number already in use.' });
      }
      update.mobile = formatted;
    }

    if (alternateMobile !== undefined) {
      update.alternateMobile = alternateMobile
        ? (formatMobile(alternateMobile) || alternateMobile.trim())
        : '';
    }
    if (whatsappOptIn !== undefined) update.whatsappOptIn = Boolean(whatsappOptIn);
    if (notes !== undefined) update.notes = notes.trim();
    if (groups !== undefined) {
      const groupIds = Array.isArray(groups) ? groups.filter((id) => id) : [];
      update.groups = groupIds;
    }

    const client = await Client.findByIdAndUpdate(req.params.id, update, {
      new: true,
      runValidators: true,
    }).populate('groups', 'name');

    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    // Sync groups if groups were updated
    if (groups !== undefined) {
      const oldClient = await Client.findById(req.params.id);
      const oldGroupIds = (oldClient?.groups || []).map((id) => String(id));
      const newGroupIds = update.groups.map((id) => String(id));

      // Groups to add
      const toAdd = newGroupIds.filter((id) => !oldGroupIds.includes(id));
      if (toAdd.length > 0) {
        await Group.updateMany(
          { _id: { $in: toAdd } },
          { $addToSet: { clients: req.params.id } }
        );
      }

      // Groups to remove
      const toRemove = oldGroupIds.filter((id) => !newGroupIds.includes(id));
      if (toRemove.length > 0) {
        await Group.updateMany(
          { _id: { $in: toRemove } },
          { $pull: { clients: req.params.id } }
        );
      }
    }

    res.json({ success: true, data: client });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Mobile number already in use.' });
    }
    next(error);
  }
};

// ─── DELETE /api/clients/:id ───────────────────────────────────────────────────

exports.deleteClient = async (req, res, next) => {
  try {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    // Remove client from all groups
    await Group.updateMany(
      { clients: client._id },
      { $pull: { clients: client._id } }
    );

    res.json({ success: true, message: 'Client deleted.' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/clients/:id/assign-groups
 * Assign groups to a client
 */
exports.assignGroupsToClient = async (req, res, next) => {
  try {
    const { groupIds } = req.body;
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    const validGroupIds = Array.isArray(groupIds) ? groupIds.filter((id) => id) : [];

    // Get old group IDs
    const oldGroupIds = (client.groups || []).map((id) => String(id));

    // Groups to add
    const toAdd = validGroupIds.filter((id) => !oldGroupIds.includes(String(id)));
    if (toAdd.length > 0) {
      await Group.updateMany(
        { _id: { $in: toAdd } },
        { $addToSet: { clients: client._id } }
      );
    }

    // Groups to remove
    const toRemove = oldGroupIds.filter((id) => !validGroupIds.includes(id));
    if (toRemove.length > 0) {
      await Group.updateMany(
        { _id: { $in: toRemove } },
        { $pull: { clients: client._id } }
      );
    }

    client.groups = validGroupIds;
    await client.save();

    const updated = await Client.findById(client._id).populate('groups', 'name');
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/clients/bulk-upload ────────────────────────────────────────────

exports.bulkUpload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No CSV file provided.' });
    }

    const text = req.file.buffer.toString('utf8');
    let records;
    try {
      records = csv.parse(text, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch {
      return res.status(400).json({ success: false, message: 'Failed to parse CSV. Ensure it has headers: name,mobile,alternateMobile.' });
    }

    let created = 0;
    let skipped = 0;
    const errors = [];

    for (const row of records) {
      const name = (row.name || row.Name || '').trim();
      const rawMobile = (row.mobile || row.Mobile || '').trim();
      const rawAlt = (row.alternateMobile || row.AlternateMobile || row.alternate_mobile || '').trim();

      if (!name) {
        errors.push({ row: rawMobile || '(unknown)', reason: 'Missing name' });
        skipped++;
        continue;
      }

      const formatted = formatMobile(rawMobile);
      if (!formatted) {
        errors.push({ row: rawMobile, reason: 'Invalid mobile number' });
        skipped++;
        continue;
      }

      const exists = await Client.findOne({ mobile: formatted });
      if (exists) {
        skipped++;
        continue;
      }

      try {
        await Client.create({
          name,
          mobile: formatted,
          alternateMobile: rawAlt ? (formatMobile(rawAlt) || rawAlt) : '',
          whatsappOptIn: true,
        });
        created++;
      } catch (err) {
        if (err.code === 11000) {
          skipped++;
        } else {
          errors.push({ row: rawMobile, reason: err.message });
          skipped++;
        }
      }
    }

    res.json({ success: true, created, skipped, errors });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/clients/:id/chats ────────────────────────────────────────────────

exports.getClientChats = async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found.' });
    }

    const Conversation = require('../models/Conversation');
    const conversations = await Conversation.find({ phone: client.mobile }).sort({ updatedAt: -1 });

    res.json({ success: true, data: conversations });
  } catch (error) {
    next(error);
  }
};

// ─── Exported helper used by webhook to auto-create clients ───────────────────

exports.findOrCreateClientByMobile = async (mobile) => {
  if (!mobile) return null;
  const formatted = formatMobile(mobile) || mobile;
  let client = await Client.findOne({ mobile: formatted });
  if (!client) {
    try {
      client = await Client.create({ name: formatted, mobile: formatted, whatsappOptIn: true });
    } catch (err) {
      if (err.code === 11000) {
        client = await Client.findOne({ mobile: formatted });
      }
    }
  }
  return client;
};

exports.formatMobile = formatMobile;
