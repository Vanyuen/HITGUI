const mongoose = require('mongoose');

async function checkCollections() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log('=== 所有集合及记录数 ===\n');

    const sortedCollections = collections.sort((a, b) => a.name.localeCompare(b.name));

    for (const c of sortedCollections) {
        const count = await db.collection(c.name).countDocuments();
        if (c.name.toLowerCase().includes('hwc') ||
            c.name.toLowerCase().includes('hotwarmcold') ||
            c.name.toLowerCase().includes('optimized')) {
            console.log('* ' + c.name + ': ' + count + ' records <- HWC related');
        } else {
            console.log('  ' + c.name + ': ' + count + ' records');
        }
    }

    await mongoose.disconnect();
}

checkCollections().catch(e => { console.error(e); process.exit(1); });
