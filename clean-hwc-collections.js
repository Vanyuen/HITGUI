const mongoose = require('mongoose');

async function cleanupCollections() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        const db = mongoose.connection.db;

        const collections = await db.listCollections().toArray();

        const collectionsToDelete = collections.filter(coll =>
            coll.name.startsWith('hit_dlt_redcombinationshotwarmcoldoptimizeds_backup_') ||
            coll.name === 'hit_dlt_redcombinationshotwarmcoldoptimizeds'
        );

        for (const collection of collectionsToDelete) {
            console.log(`🗑️ 删除集合: ${collection.name}`);
            await db.collection(collection.name).drop();
        }

        console.log('✅ 清理完成');
    } catch (error) {
        console.error('❌ 清理失败:', error);
    } finally {
        await mongoose.connection.close();
    }
}

cleanupCollections();