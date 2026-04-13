const Report = require('../models/Report');

const TAX_RATE = 0.09;

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const normalizeIfsc = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) {
    return raw;
  }

  const match = raw.match(/[A-Z]{4}0[A-Z0-9]{6}/);
  return match ? match[0] : raw;
};

const normalizeBankDetails = (bankDetails = {}) => {
  return {
    bankName: bankDetails.bankName,
    accountNumber: bankDetails.accountNumber,
    ifsc: normalizeIfsc(bankDetails.ifsc),
  };
};

const getFinancialYearWindow = (dateInput) => {
  const baseDate = dateInput ? new Date(dateInput) : new Date();
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const fyStartYear = month >= 3 ? year : year - 1;

  const start = new Date(fyStartYear, 3, 1, 0, 0, 0, 0);
  const end = new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999);
  const financialYearLabel = `${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, '0')}`;

  return { start, end, financialYearLabel };
};

const normalizeItems = (items = []) => {
  if (!Array.isArray(items) || !items.length) {
    return [];
  }

  return items.map((item) => {
    const quantity = Number(item.quantity);
    const rate = Number(item.rate);
    const rawAmount = Number(item.amount);
    const fromQtyRate = Number.isFinite(quantity) && Number.isFinite(rate) ? quantity * rate : NaN;
    const amount = Number.isFinite(rawAmount) ? rawAmount : fromQtyRate;

    return {
      description: item.description,
      hsn: item.hsn,
      quantity: Number.isFinite(quantity) ? quantity : undefined,
      rate: Number.isFinite(rate) ? rate : undefined,
      amount: round2(Number.isFinite(amount) ? amount : 0),
    };
  });
};

const calculateTotals = (items = []) => {
  const normalizedItems = normalizeItems(items);
  const subtotal = round2(normalizedItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
  const cgst = round2(subtotal * TAX_RATE);
  const sgst = round2(subtotal * TAX_RATE);
  const total = round2(subtotal + cgst + sgst);

  return {
    items: normalizedItems,
    subtotal,
    cgst,
    sgst,
    total,
  };
};

const generateInvoiceNumber = async (dateInput) => {
  const { start, end, financialYearLabel } = getFinancialYearWindow(dateInput);
  const prefix = `MA/`;

  let serial = (await Report.countDocuments({
    date: { $gte: start, $lte: end },
  })) + 1;

  while (true) {
    const candidate = `${prefix}${serial}/${financialYearLabel}`;
    const exists = await Report.exists({ invoiceNumber: candidate });
    if (!exists) {
      return candidate;
    }
    serial += 1;
  }
};

exports.createReport = async (req, res, next) => {
  try {
    const totals = calculateTotals(req.body.items);
    const invoiceNumber = await generateInvoiceNumber(req.body.date);
    const bankDetails = normalizeBankDetails(req.body.bankDetails);

    const report = await Report.create({
      date: req.body.date || new Date(),
      placeOfSupply: req.body.placeOfSupply,
      client: req.body.client,
      items: totals.items,
      subtotal: totals.subtotal,
      cgst: totals.cgst,
      sgst: totals.sgst,
      total: totals.total,
      status: req.body.status === 'Paid' ? 'Paid' : 'Pending',
      bankDetails,
      declaration: req.body.declaration,
      invoiceNumber,
    });

    res.status(201).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

exports.getReports = async (req, res, next) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: reports });
  } catch (error) {
    next(error);
  }
};

exports.getReportById = async (req, res, next) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

exports.updateReport = async (req, res, next) => {
  try {
    const existing = await Report.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const totals = calculateTotals(req.body.items);
  const bankDetails = normalizeBankDetails(req.body.bankDetails);

    existing.date = req.body.date || existing.date;
    existing.placeOfSupply = req.body.placeOfSupply;
    existing.client = req.body.client;
    existing.items = totals.items;
    existing.subtotal = totals.subtotal;
    existing.cgst = totals.cgst;
    existing.sgst = totals.sgst;
    existing.total = totals.total;
    existing.status = req.body.status === 'Paid' ? 'Paid' : 'Pending';
    existing.bankDetails = bankDetails;
    existing.declaration = req.body.declaration;

    const updated = await existing.save();
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.deleteReport = async (req, res, next) => {
  try {
    const deleted = await Report.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.status(200).json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    next(error);
  }
};
