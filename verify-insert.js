const mongoose = require('mongoose');

async function verify() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 连接成功\n');

        // 直接查询集合
        const count = await mongoose.connection.db.collection('hit_dlt_redcombinations').countDocuments();
        console.log(`hit_dlt_redcombinations 记录数: ${count}`);

        if (count > 0) {
            const sample = await mongoose.connection.db.collection('hit_dlt_redcombinations').findOne({});
            console.log('\n示例记录:',sample);
        }

    } catch (error) {
        console.error('错误:', error);
    } finally {
        await mongoose.disconnect();
    }
}

verify();
