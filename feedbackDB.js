const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://riodanicaave02:gr%40dSch00l@cluster0.mvonr.mongodb.net/feedbackDB?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', (err) => console.error('MongoDB error:', err));
db.once('open', () => console.log('Connected to MongoDB Atlas'));

module.exports = db;
