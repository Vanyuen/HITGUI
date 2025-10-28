const mongoose = require('mongoose');

async function check() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 连接成功\n');

        const collName = 'hit_dlt_redcombinations';
       
        console.log('直接查询collection');
        const count1 = await mongoose.connection.db.collection(collName).countDocuments();
        console.log('记录数:', count1);

        if (count1 > 0) {
            const sample = await mongoose.connection.db.collection(collName).findOne({});
            console.log('\n示例记录:');
            console.log(sample);
        } else {
            console.log('\n集合为空，检查索引:');
            const indexes = await mongoose.connection.db.collection(collName).indexes();
            console.log('索引:', indexes);
        }

    } catch (error) {
        console.error('错误:', error);
    } finally {
        await mongoose.disconnect();
    }
}

check();
