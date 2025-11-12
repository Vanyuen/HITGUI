const mongoose = require('mongoose');

async function quickCheck() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:9976/test', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // 列出所有集合及数量
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('所有集合:');
        for (const coll of collections) {
            const count = await mongoose.connection.db.collection(coll.name).countDocuments();
            if (count > 0) {
                console.log(`  ✓ ${coll.name}: ${count} 条`);
            }
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('错误:', error.message);
    }
}

quickCheck();
