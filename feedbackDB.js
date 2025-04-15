// Import the mongoose library, which is used to interact with MongoDB in a Node.js application
const mongoose = require('mongoose');

// Establish a connection to the MongoDB database located at 'mongodb://localhost:27017/feedbackDB'
// 'localhost:27017' is the default MongoDB host and port, and 'feedbackDB' is the database name
// The options object specifies:
// - useNewUrlParser: true - Enables the new URL parser to avoid deprecation warnings
// - useUnifiedTopology: true - Enables the new connection topology engine for better stability
mongoose.connect('mongodb+srv://riodanicaave02:gr@dSch00l@cluster0.mvonr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Store the mongoose connection object in a variable called 'db'
// This object can be used to listen for connection events or perform other connection-related tasks
const db = mongoose.connection;

// Set up an event listener for the 'open' event on the connection
// The 'open' event is triggered when the connection to MongoDB is successfully established
// When triggered, it logs 'Connected to MongoDB' to the console to indicate a successful connection
db.once('open', () => console.log('Connected to MongoDB Atlas'));

// Export the 'db' connection object so it can be imported and used in other files
// This allows other modules to access the connection and listen for events or perform operations
module.exports = db;