// Import the 'express' module, a web framework for Node.js, to create the server
const express = require('express');

// Import the 'mongoose' module, an ODM library for MongoDB, to interact with the database
const mongoose = require('mongoose');

// Import the 'cors' module, a middleware to enable Cross-Origin Resource Sharing for requests from different origins
const cors = require('cors');

// Import the 'Feedback' model from the './feedback' file, which defines the schema for feedback data
const Feedback = require('./feedback');

// Create an instance of the Express application
const app = express();

// Use the 'cors' middleware to allow requests from different origins (e.g., Live Server on port 5500)
app.use(cors());

// Use the built-in Express middleware to parse incoming JSON data from requests
app.use(express.json());

// Establish a connection to the MongoDB database located at 'mongodb://localhost:27017/feedbackDB'
// 'localhost:27017' is the default MongoDB host and port, and 'feedbackDB' is the database name
// The options object specifies:
// - useNewUrlParser: true - Enables the new URL parser to avoid deprecation warnings
// - useUnifiedTopology: true - Enables the new connection topology engine for better stability
mongoose.connect('mongodb://localhost:27017/feedbackDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
// Log a success message to the console if the connection is established
.then(() => console.log('MongoDB Connected'))
// Log any errors to the console if the connection fails
.catch(err => console.error(err));

// Define a sample GET route at '/data' to test the server
app.get('/data', async (req, res) => {
    // Send a JSON response with a simple message
    res.json({ message: "Hello from MongoDB!" });
});

// Define a POST route at '/feedback' to handle feedback submissions
app.post('/feedback', async (req, res) => {
    try {
        // Extract 'name', 'email', and 'message' from the request body
        const { name, email, message } = req.body;

        // Create a new Feedback document using the extracted data
        const newFeedback = new Feedback({ name, email, message });

        // Save the new feedback document to the MongoDB database
        await newFeedback.save();

        // Send a success response with a confirmation message
        res.json({ message: 'Feedback submitted successfully!' });
    } catch (err) {
        // Handle any errors during the save operation
        // Send a 500 status response with an error message and the specific error details
        res.status(500).json({ message: 'Error saving feedback', error: err.message });
    }
});

// Start the server and listen on port 5000
// Log a message to the console when the server is running
app.listen(5000, () => {
    console.log('Server running on http://localhost:5000');
});