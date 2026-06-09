import BankMaster from '../models/BankMaster.js';

export const getAllBanks = async (req, res) => {
  try {
    const banks = await BankMaster.find({ companyId: req.companyId })
      .populate('bankLedgerId', 'ledgerName')
      .sort({ bankName: 1 });
    res.json({ success: true, data: banks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const createBank = async (req, res) => {
  try {
    const { bankName, branch, ifsc, micr, bankLedgerId } = req.body;
    if (!bankName) return res.status(400).json({ success: false, message: 'Bank name is required' });

    const bank = new BankMaster({
      bankName,
      branch:      branch || '',
      ifsc:        ifsc   || '',
      micr:        micr   || '',
      bankLedgerId: bankLedgerId || null,
      companyId:   req.companyId,
    });
    await bank.save();

    const populated = await BankMaster.findById(bank._id).populate('bankLedgerId', 'ledgerName');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const updateBank = async (req, res) => {
  try {
    const { bankName, branch, ifsc, micr, bankLedgerId } = req.body;
    const bank = await BankMaster.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      { bankName, branch: branch || '', ifsc: ifsc || '', micr: micr || '', bankLedgerId: bankLedgerId || null },
      { new: true, runValidators: true }
    ).populate('bankLedgerId', 'ledgerName');

    if (!bank) return res.status(404).json({ success: false, message: 'Bank not found' });
    res.json({ success: true, data: bank });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteBank = async (req, res) => {
  try {
    const bank = await BankMaster.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!bank) return res.status(404).json({ success: false, message: 'Bank not found' });
    res.json({ success: true, message: 'Bank deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
