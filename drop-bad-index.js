const mongoose = require('mongoose');

async function dropIndex() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 连接成功\n');

        const coll = mongoose.connection.db.collection('hit_dlt_redcombinations');

        // 列出所有索引
        const indexes = await coll.indexes();
        console.log('当前索引:');
        indexes.forEach(idx => {
            console.log('  -', idx.name);
        });

        // 删除id_1索引
        console.log('\n删除id_1索引...');
        await coll.dropIndex('id_1');
        console.log('✅ 已删除id_1索引');

        // 再次列出索引验证
        const indexesAfter = await coll.indexes();
        console.log('\n删除后的索引:');
        indexesAfter.forEach(idx => {
            console.log('  -', idx.name);
        });

    } catch (error) {
        console.error('错误:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

dropIndex();
