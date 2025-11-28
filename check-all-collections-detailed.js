const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function checkAllCollections() {
    try {
        await mongoose.connect(MONGODB_URI);

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        console.log('\n📚 所有集合及记录数:\n');
        
        let hwcCollections = [];
        
        for (const coll of collections) {
            const count = await db.collection(coll.name).countDocuments();
            console.log(`  - ${coll.name}: ${count} 条记录`);
            
            // 收集热温冷相关集合
            if (coll.name.toLowerCase().includes('hwc') || 
                coll.name.toLowerCase().includes('hotwarmcold') ||
                coll.name.toLowerCase().includes('hot_warm_cold')) {
                hwcCollections.push(coll.name);
            }
        }

        if (hwcCollections.length > 0) {
            console.log('\n⭐ 热温冷相关集合详情:\n');
            for (const collName of hwcCollections) {
                const count = await db.collection(collName).countDocuments();
                console.log(`  - ${collName}: ${count} 条记录`);
                
                if (count > 0) {
                    const sample = await db.collection(collName).findOne();
                    console.log('    📄 字段:', Object.keys(sample).join(', '));
                }
            }
        } else {
            console.log('\n❌ 未找到热温冷相关集合！');
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

checkAllCollections();
