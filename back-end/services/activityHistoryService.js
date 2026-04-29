const ActivityHistory = require('../models/ActivityHistory');
const Client = require('../models/Client');
const User = require('../models/User');
const { normalizePhone } = require('./chatMessageStore');

const resolveClientIdByPhone = async (phone) => {
  const normalized = normalizePhone(phone || '');
  if (!normalized) {
    return null;
  }

  const candidates = [...new Set([
    normalized,
    normalized.startsWith('91') ? normalized : `91${normalized}`,
    `+${normalized}`,
    normalized.startsWith('91') ? `+${normalized}` : `+91${normalized}`,
  ])];

  const client = await Client.findOne({
    $or: [
      { mobile: { $in: candidates } },
      { alternateMobile: { $in: candidates } },
    ],
  }).select('_id');

  return client?._id || null;
};

const resolveAdminScopeForRead = async (user) => {
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';
  if (!isAdmin) {
    return {};
  }

  const firstAdmin = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 }).select('_id');
  const isLegacyPrimaryAdmin = Boolean(firstAdmin?._id && String(firstAdmin._id) === String(user._id));

  if (isLegacyPrimaryAdmin) {
    return {
      $or: [
        { adminOwner: user._id },
        { adminOwner: { $exists: false } },
        { adminOwner: null },
      ],
    };
  }

  return { adminOwner: user._id };
};

const logActivity = async ({
  type,
  title,
  referenceId,
  taskId,
  clientId,
  employeeId,
  description,
  metadata,
  adminOwner,
}) => {
  if (!type || !title || !referenceId) {
    return null;
  }

  return ActivityHistory.create({
    type,
    title,
    referenceId: String(referenceId),
    taskId: taskId || undefined,
    clientId: clientId || undefined,
    employeeId: employeeId || undefined,
    description: description || '',
    metadata: metadata || {},
    adminOwner: adminOwner || undefined,
  });
};

module.exports = {
  logActivity,
  resolveClientIdByPhone,
  resolveAdminScopeForRead,
};
