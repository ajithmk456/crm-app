const Employee = require('../models/Employee');
const User = require('../models/User');

const getAuthRoleFromEmployeeRole = (employeeRole) => {
  return String(employeeRole || '').toLowerCase() === 'admin' ? 'Admin' : 'Employee';
};

exports.addEmployee = async (req, res, next) => {
  try {
    const { fullName, email, phone, address, role, status } = req.body;
    if (!fullName || !email) {
      return res.status(400).json({ success: false, message: 'fullName and email are required.' });
    }

    const exists = await Employee.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Email already exists.' });
    }

    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already exists.' });
    }

    const normalizedEmployeeRole = String(role || 'Employee');

    const employee = await Employee.create({
      fullName,
      email,
      phone,
      address,
      role: normalizedEmployeeRole,
      status: typeof status === 'boolean' ? status : true,
    });

    try {
      await User.create({
        name: fullName,
        email: email.toLowerCase(),
        role: getAuthRoleFromEmployeeRole(normalizedEmployeeRole),
        password: null,
        passwordSet: false,
      });
    } catch (err) {
      await Employee.findByIdAndDelete(employee._id);
      return res.status(500).json({ success: false, message: 'Failed to create authentication user.' });
    }

    res.status(201).json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
};

exports.getEmployees = async (req, res, next) => {
  try {
    const { search, status } = req.query;
    const query = {};

    if (search) {
      const regex = new RegExp(search, 'i');
      query.$or = [{ fullName: regex }, { email: regex }, { phone: regex }];
    }

    if (status !== undefined) {
      query.status = status === 'true';
    }

    const employees = await Employee.find(query).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: employees.length, data: employees });
  } catch (error) {
    next(error);
  }
};

exports.getEmployeeById = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    res.status(200).json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
};

exports.updateEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const { fullName, email, phone, address, role, status } = req.body;
    const oldEmail = employee.email;
    if (email && email !== employee.email) {
      const existingEmail = await Employee.findOne({ email: email.toLowerCase(), _id: { $ne: req.params.id } });
      if (existingEmail) {
        return res.status(400).json({ success: false, message: 'Email already used by another employee' });
      }

      const authEmailExists = await User.findOne({ email: email.toLowerCase() });
      if (authEmailExists) {
        return res.status(400).json({ success: false, message: 'Email already used by another user' });
      }
    }

    employee.fullName = fullName ?? employee.fullName;
    employee.email = email ?? employee.email;
    employee.phone = phone ?? employee.phone;
    employee.address = address ?? employee.address;
    employee.role = role ?? employee.role;
    if (status !== undefined) employee.status = status;

    await employee.save();

    const authUser = await User.findOne({ email: oldEmail.toLowerCase() });
    if (authUser) {
      const nextAuthRole = getAuthRoleFromEmployeeRole(employee.role);
      const roleChanged = authUser.role !== nextAuthRole;

      authUser.name = employee.fullName;
      authUser.email = employee.email.toLowerCase();
      authUser.role = nextAuthRole;
      if (roleChanged) {
        authUser.tokenVersion = (authUser.tokenVersion || 0) + 1;
      }
      await authUser.save();
    } else {
      await User.create({
        name: employee.fullName,
        email: employee.email.toLowerCase(),
        role: getAuthRoleFromEmployeeRole(employee.role),
        password: null,
        passwordSet: false,
      });
    }

    res.status(200).json({ success: true, data: employee });
  } catch (error) {
    next(error);
  }
};

exports.deleteEmployee = async (req, res, next) => {
  try {
    const employee = await Employee.findByIdAndDelete(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    await User.findOneAndDelete({
      email: employee.email.toLowerCase(),
      role: { $in: ['Employee', 'employee', 'Admin', 'admin', 'user'] },
    });

    res.status(200).json({ success: true, message: 'Employee deleted successfully' });
  } catch (error) {
    next(error);
  }
};
