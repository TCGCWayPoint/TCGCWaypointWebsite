const mongoose = require('mongoose');

// Feedback schema
const feedbackSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Export the model
module.exports = mongoose.model('Feedback', feedbackSchema);

