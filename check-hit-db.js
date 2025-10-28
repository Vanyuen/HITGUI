const mongoose = require('mongoose');

async function check() {
    try {
        // 连接到HIT数据库
        await mongoose.connect('mongodb://localhost:27017/HIT');
        console.log('✅ 连接HIT数据库成功\n');

        const count = await mongoose.connection.db.collection('hit_dlt_redcombinations').countDocuments();
        console.log(`HIT数据库的hit_dlt_redcombinations: ${count}条记录\n`);

        await mongoose.disconnect();

        // 连接到lottery数据库
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 连接lottery数据库成功\n');

        const count2 = await mongoose.connection.db.collection('hit_dlt_redcombinations').countDocuments();
        console.log(`lottery数据库的hit_dlt_redcombinations: ${count2}条记录`);

    } catch (error) {
        console.error('错误:', error);
    } finally {
        await mongoose.disconnect();
    }
}

check();
