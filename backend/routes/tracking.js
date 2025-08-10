const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const SavingsGoal = require('../models/SavingsGoal');

// Helper function to get start date based on period
const getStartDate = (period) => {
  const now = new Date();
  switch (period) {
    case 'week':
      return new Date(now.setDate(now.getDate() - 7));
    case 'month':
      return new Date(now.setMonth(now.getMonth() - 1));
    case 'year':
      return new Date(now.setFullYear(now.getFullYear() - 1));
    default:
      return new Date(now.setMonth(now.getMonth() - 1)); // default to month
  }
};

// Get statistics
router.get('/statistics', auth, async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const userId = req.user.id;
    const startDate = getStartDate(period);

    // Get all transactions for the period
    const transactions = await Transaction.find({
      userId,
      date: { $gte: startDate }
    });

    // Calculate totals
    let totalIncome = 0;
    let totalExpenses = 0;
    const expenseCategories = {};

    // Process transactions
    transactions.forEach(transaction => {
      if (transaction.type === 'income') {
        totalIncome += transaction.amount;
      } else if (transaction.type === 'expense') {
        totalExpenses += transaction.amount;
        if (!expenseCategories[transaction.category]) {
          expenseCategories[transaction.category] = 0;
        }
        expenseCategories[transaction.category] += transaction.amount;
      }
    });

    // Get savings goals
    const savingsGoals = await SavingsGoal.find({ userId });
    const totalSavings = savingsGoals.reduce((sum, goal) => sum + goal.currentAmount, 0);

    // Format expense categories for chart
    const expensesByCategory = Object.entries(expenseCategories).map(([category, amount]) => ({
      category,
      amount
    }));

    // Calculate trend data
    const trend = [];
    const dateFormat = { month: 'short', day: 'numeric' };

    // Group transactions by date
    const groupedByDate = transactions.reduce((acc, t) => {
      const date = new Date(t.date).toLocaleDateString('en-US', dateFormat);
      if (!acc[date]) {
        acc[date] = { income: 0, expense: 0 };
      }
      acc[date][t.type] += t.amount;
      return acc;
    }, {});

    // Convert grouped data to array format
    Object.entries(groupedByDate).forEach(([date, values]) => {
      trend.push({ date, ...values });
    });

    // Sort trend data by date
    trend.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json({
      totalIncome,
      totalExpenses,
      totalSavings,
      expensesByCategory,
      trend,
      transactions // Include transactions in the response
    });

  } catch (error) {
    console.error('Statistics error:', error);
    res.status(500).json({ message: 'Error fetching statistics', error: error.message });
  }
});

// Add income
router.post('/income', auth, async (req, res) => {
  try {
    const { amount, category, date, notes } = req.body;
    const transaction = new Transaction({
      userId: req.user.id,
      type: 'income',
      amount,
      category,
      date: date || new Date(),
      notes,
    });
    await transaction.save();
    res.json(transaction);
  } catch (error) {
    console.error('Error saving income:', error);
    res.status(500).send('Server Error');
  }
});

// Add expense
router.post('/expense', auth, async (req, res) => {
  try {
    const { amount, category, date, notes } = req.body;
    const transaction = new Transaction({
      userId: req.user.id,
      type: 'expense',
      amount,
      category,
      date: date || new Date(),
      notes,
    });
    await transaction.save();
    res.json(transaction);
  } catch (error) {
    console.error('Error saving expense:', error);
    res.status(500).send('Server Error');
  }
});

// Get all savings goals
router.get('/savings', auth, async (req, res) => {
  try {
    const savingsGoals = await SavingsGoal.find({ userId: req.user.id }).sort({ targetDate: 1 });
    res.json(savingsGoals);
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

// Get single savings goal
router.get('/savings/:id', auth, async (req, res) => {
  try {
    const savingsGoal = await SavingsGoal.findOne({ _id: req.params.id, userId: req.user.id });
    res.json(savingsGoal);
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

// Update the create savings goal route
router.post('/savings', auth, async (req, res) => {
  try {
    const {
      goalName,
      targetAmount,
      currentAmount,
      targetDate,
      description,
      category
    } = req.body;

    // Validate the input
    if (!goalName || !targetAmount || currentAmount === undefined || !targetDate || !category) {
      return res.status(400).json({ message: 'All required fields must be provided' });
    }

    // Create new savings goal
    const savingsGoal = new SavingsGoal({
      userId: req.user.id,
      goalName,
      targetAmount: Number(targetAmount),
      currentAmount: Number(currentAmount),
      targetDate: new Date(targetDate),
      description,
      category,
      status: currentAmount >= targetAmount ? 'Completed' : 'In Progress'
    });

    // Save to database
    const savedGoal = await savingsGoal.save();

    // Return the saved goal
    res.status(201).json(savedGoal);
  } catch (error) {
    console.error('Error creating savings goal:', error);
    res.status(500).json({
      message: 'Failed to create savings goal',
      error: error.message
    });
  }
});

// Update savings goal
router.put('/savings/:id', auth, async (req, res) => {
  try {
    const { currentAmount } = req.body;
    const savingsGoal = await SavingsGoal.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { currentAmount },
      { new: true }
    );
    res.json(savingsGoal);
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

// Delete savings goal
router.delete('/savings/:id', auth, async (req, res) => {
  try {
    await SavingsGoal.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ message: 'Savings goal deleted successfully' });
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

// Get savings statistics
router.get('/savings-stats', auth, async (req, res) => {
  try {
    const goals = await SavingsGoal.find({ userId: req.user.id });
    const stats = {
      totalGoals: goals.length,
      completedGoals: goals.filter(g => g.status === 'Completed').length,
      totalSaved: goals.reduce((sum, g) => sum + g.currentAmount, 0),
      totalTarget: goals.reduce((sum, g) => sum + g.targetAmount, 0),
      categoryBreakdown: goals.reduce((acc, g) => {
        acc[g.category] = (acc[g.category] || 0) + g.currentAmount;
        return acc;
      }, {}),
      upcomingDeadlines: goals
        .filter(g => g.status !== 'Completed')
        .sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate))
        .slice(0, 5)
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching savings statistics' });
  }
});

// Get user's transactions with filtering and pagination
router.get('/transactions', auth, async (req, res) => {
  try {
    const { type, startDate, endDate, category, page = 1, limit = 10 } = req.query;
    const query = { userId: req.user.id };

    if (type) query.type = type;
    if (category) query.category = category;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Transaction.countDocuments(query);

    res.json({
      transactions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).send('Server Error');
  }
});

// Get single transaction
router.get('/transaction/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, userId: req.user.id });
    res.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).send('Server Error');
  }
});

// Update transaction
router.put('/transaction/:id', auth, async (req, res) => {
  try {
    const { amount, category, date, notes } = req.body;
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { amount, category, date, notes },
      { new: true }
    );
    res.json(transaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).send('Server Error');
  }
});

// Delete transaction
router.delete('/transaction/:id', auth, async (req, res) => {
  try {
    await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
