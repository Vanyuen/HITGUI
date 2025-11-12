const { MongoClient } = require('mongodb');

(async () => {
    const client = await MongoClient.connect('mongodb://127.0.0.1:27017');
    const db = client.db('lottery');

    console.log('=== 所有数据库集合 ===\n');

    const collections = await db.listCollections().toArray();

    console.log(`总共 ${collections.length} 个集合:\n`);

    for (const coll of collections) {
        const count = await db.collection(coll.name).countDocuments();
        console.log(`${coll.name}: ${count} 条记录`);

        // 如果集合名包含 missing 或 history，显示详细信息
        if (coll.name.toLowerCase().includes('missing') || coll.name.toLowerCase().includes('history')) {
            if (count > 0) {
                const sample = await db.collection(coll.name).findOne();
                console.log(`  → 示例字段:`, Object.keys(sample).slice(0, 10).join(', '));
            }
        }
    }

    await client.close();
})();
