const express = require('express');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose'); // Import mongoose for MongoDB
const Feedback = require('./model/feedback'); // Import the Feedback model (make sure this file exists)

const app = express();
const port = 3000;
const HOST = '192.168.5.206'; // Replace with your actual IP

// 1. Connect to MongoDB Atlas
mongoose.connect('mongodb+srv://riodanicaave02@gmail.com:gr@dSch00l@Cluster0.mongodb.net/feedbackDB?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on('error', (err) => console.error('MongoDB connection error:', err));
db.once('open', () => console.log('✅ Connected to MongoDB Atlas'));

// 2. Middleware
app.use(cors({ origin: '*' })); // Allow all origins for testing (change for production)
app.use(express.json());         // Middleware to parse JSON from frontend
app.use(express.static(__dirname)); // Serves files in the project root

// 3. Route for HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 4. Route to handle feedback submission
app.post('/feedback', async (req, res) => { // Use '/feedback' to match your frontend
  try {
    const { name, email, message } = req.body;

    const feedback = new Feedback({ name, email, message });
    await feedback.save();

    // Respond with success
    res.status(200).json({ message: 'Feedback submitted successfully!' });
  } catch (err) {
    console.error('Error saving feedback:', err);
    res.status(500).json({ message: 'Error saving feedback' });
  }
});

// 5. Start Server
app.listen(port, HOST, () => {
  console.log(`Server running at:
  - Computer: http://localhost:${port}
  - Phone:    http://${HOST}:${port}`);
});
