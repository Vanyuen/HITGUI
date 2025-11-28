const mongoose = require('mongoose');

console.log('🔍 检查任务结果的完整数据...\n');

async function check() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');

        // 查询最新任务的所有结果
        const results = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .find()
            .sort({ _id: -1 })
            .limit(10)
            .toArray();

        console.log(`📋 最新10条任务结果:\n`);
        results.forEach((r, i) => {
            console.log(`记录${i + 1}:`);
            console.log(JSON.stringify(r, null, 2));
            console.log('');
        });

        console.log('\n✅ 完成');

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await mongoose.disconnect();
    }
}

check();
