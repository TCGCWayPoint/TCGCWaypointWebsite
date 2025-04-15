const mongoose = require('mongoose');

// Replace the <...> placeholders with your actual Atlas credentials and DB name
const uri = 'mongodb://riodanicaave02:gr@dSch00l@ac-3gomgnu-shard-00-00.syabp5w.mongodb.net:27017,ac-3gomgnu-shard-00-01.syabp5w.mongodb.net:27017,ac-3gomgnu-shard-00-02.syabp5w.mongodb.net:27017/?replicaSet=atlas-5u9h1m-shard-0&ssl=true&authSource=admin&retryWrites=true&w=majority&appName=feedbackDB';

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.once('open', () => console.log('Connected to MongoDB Atlas'));

module.exports = db;
