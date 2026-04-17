const User = require('../models/User');
const { normalizeRole } = require('../utils/roles');

const ensureDefaultSuperadmin = async () => {
  const email = String(process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.SUPERADMIN_PASSWORD || '');
  const name = String(process.env.SUPERADMIN_NAME || 'Super Admin').trim();

  if (!email || !password) {
    console.log('Default superadmin seed skipped: SUPERADMIN_EMAIL or SUPERADMIN_PASSWORD is not configured.');
    return;
  }

  const existingUser = await User.findOne({ email }).select('+password');
  if (!existingUser) {
    await User.create({
      name,
      email,
      password,
      role: 'superadmin',
    });
    console.log(`Default superadmin created for ${email}`);
    return;
  }

  let hasChanges = false;
  if (normalizeRole(existingUser.role) !== 'superadmin') {
    existingUser.role = 'superadmin';
    hasChanges = true;
  }

  if (!existingUser.passwordSet) {
    existingUser.password = password;
    hasChanges = true;
  }

  if (name && existingUser.name !== name) {
    existingUser.name = name;
    hasChanges = true;
  }

  if (hasChanges) {
    await existingUser.save();
    console.log(`Default superadmin ensured for ${email}`);
  }
};

module.exports = { ensureDefaultSuperadmin };