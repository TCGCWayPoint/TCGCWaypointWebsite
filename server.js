// Import the 'express' module, a web framework for Node.js, to create the server
const express = require('express');

// Import the 'cors' module, a middleware to enable Cross-Origin Resource Sharing for requests from different origins
const cors = require('cors');

// Create an instance of the Express application
const app = express();

// Use the 'cors' middleware to allow requests from different origins (e.g., Live Server on port 5500)
app.use(cors());

// Use the built-in Express middleware to parse incoming JSON data from requests
app.use(express.json());

// Define a sample GET route at '/data' to test the server
app.get('/data', (req, res) => {
    // Send a JSON response with a simple message
    res.json({ message: "Hello from the server!" });
});

// Start the server and listen on port 5501
// Log a message to the console when the server is running
app.listen(5000, '192.168.1.101', () => {
    console.log('Server running on http://localhost:5501');
});
