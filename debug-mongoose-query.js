const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  // Define the same schema as server.js
  const dltSchema = new mongoose.Schema({
    ID: { type: Number },
    Issue: { type: String },
    Red1: Number,
    Red2: Number,
    Red3: Number,
    Red4: Number,
    Red5: Number,
    Blue1: Number,
    Blue2: Number
  });

  const hit_dlts = mongoose.model('hit_dlts', dltSchema, 'hit_dlts');

  // Test query same as in generateIssuePairsByTargetId
  const targetIssues = ['25125', '25124', '25123', '25122', '25121', '25120', '25119', '25118', '25117', '25116', '25115'];
  const queryIssues = targetIssues.map(i => i.toString());

  console.log('Testing mongoose model query...');
  console.log('Query issues:', queryIssues);

  const records = await hit_dlts.find({
    Issue: { $in: queryIssues }
  }).select('Issue ID').lean();

  console.log('Mongoose query result count:', records.length);
  if (records.length > 0) {
    console.log('First 3 records:', records.slice(0, 3));
  } else {
    // Check if model is connected
    console.log('Model collection name:', hit_dlts.collection.name);
    const count = await hit_dlts.countDocuments();
    console.log('Total documents:', count);

    // Try native query
    const db = mongoose.connection.db;
    const nativeRecords = await db.collection('hit_dlts').find({ Issue: { $in: queryIssues } }).project({ Issue: 1, ID: 1 }).toArray();
    console.log('Native query result count:', nativeRecords.length);
    if (nativeRecords.length > 0) {
      console.log('Native first 3:', nativeRecords.slice(0, 3));
    }
  }

  mongoose.disconnect();
}).catch(e => console.error('Error:', e));
