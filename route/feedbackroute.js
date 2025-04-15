const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');

router.post('/submit-feedback', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    const feedback = new Feedback({ name, email, message });
    await feedback.save();
    res.status(200).json({ message: 'Feedback submitted successfully!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error saving feedback' });
  }
});

module.exports = router;
