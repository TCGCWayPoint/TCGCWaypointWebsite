// Import the mongoose library, which is used to interact with MongoDB in a Node.js application
const mongoose = require('mongoose');

// Define a new schema for the 'Feedback' collection using mongoose.Schema
// This schema specifies the structure of documents, including fields and their types
const feedbackSchema = new mongoose.Schema({
  // 'name' field, which will store a string value (e.g., the user's name)
  name: String,
  // 'email' field, which will store a string value (e.g., the user's email address)
  email: String,
  // 'message' field, which will store a string value (e.g., the user's feedback text)
  message: String,
  // 'date' field, which will store a Date value
  // The 'default: Date.now' option automatically sets the current date and time when a new document is created
  date: { type: Date, default: Date.now }
});

// Create a Mongoose model named 'Feedback' based on the feedbackSchema
// This model allows you to perform CRUD (Create, Read, Update, Delete) operations on the 'feedbacks' collection in MongoDB
// The collection name in MongoDB will be pluralized to 'feedbacks' by default
const Feedback = mongoose.model('Feedback', feedbackSchema);

// Export the Feedback model so it can be imported and used in other files (e.g., server.js)
module.exports = Feedback;