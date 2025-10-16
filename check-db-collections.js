const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    const db = mongoose.connection.db;

    const collections = await db.listCollections().toArray();

    console.log('📊 数据库中的所有集合:\n');
    for (const coll of collections) {
        const count = await db.collection(coll.name).countDocuments();
        console.log(`- ${coll.name}: ${count} 条记录`);

        if (coll.name.includes('task') || coll.name.includes('prediction')) {
            const sample = await db.collection(coll.name).findOne();
            if (sample) {
                console.log('  示例字段:', Object.keys(sample).slice(0, 10).join(', '));
            }
        }
    }

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
