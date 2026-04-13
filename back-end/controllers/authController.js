const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Employee = require('../models/Employee');

const generateToken = (user) => {
  return jwt.sign({ id: user._id, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '24h' });
};

const getEmployeeAccountContext = async (email) => {
  const employee = await Employee.findOne({ email: String(email || '').toLowerCase().trim() }).select('role');
  if (!employee) {
    return {
      isEmployeeAccount: false,
      isTemporaryAdmin: false,
      effectiveRole: null,
    };
  }

  const normalizedEmployeeRole = String(employee.role || '').toLowerCase();
  return {
    isEmployeeAccount: true,
    isTemporaryAdmin: normalizedEmployeeRole === 'admin',
    effectiveRole: normalizedEmployeeRole === 'admin' ? 'Admin' : 'Employee',
  };
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    if (!user.passwordSet) {
      return res.status(401).json({ success: false, message: 'User has not set a password yet.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const accountContext = await getEmployeeAccountContext(user.email);
    const effectiveRole = accountContext.effectiveRole || user.role;
    if (effectiveRole !== user.role) {
      user.role = effectiveRole;
      await user.save();
    }

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: effectiveRole,
          isTemporaryAdmin: accountContext.isTemporaryAdmin,
          isEmployeeAccount: accountContext.isEmployeeAccount,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, newPassword } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (name && name.trim()) {
      user.name = name.trim();
    }

    if (newPassword) {
      if (newPassword.length < 5) {
        return res.status(400).json({ success: false, message: 'Password must be at least 5 characters.' });
      }
      user.password = newPassword;
    }

    await user.save();

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.checkUser = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    
    res.status(200).json({
      success: true,
      data: {
        exists: !!user,
        hasPassword: user ? user.passwordSet : false,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.setPassword = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    if (!password || password.length < 5) {
      return res.status(400).json({ success: false, message: 'Password must be at least 5 characters.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const accountContext = await getEmployeeAccountContext(user.email);
    const effectiveRole = accountContext.effectiveRole || user.role;

    user.password = password;
    user.passwordSet = true;
    user.role = effectiveRole;
    await user.save();

    const token = generateToken(user);

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: effectiveRole,
          isTemporaryAdmin: accountContext.isTemporaryAdmin,
          isEmployeeAccount: accountContext.isEmployeeAccount,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};
