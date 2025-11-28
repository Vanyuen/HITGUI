const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    const hit_dlts = mongoose.model('hit_dlts', new mongoose.Schema({}, { strict: false, collection: 'hit_dlts' }));

    // 获取最新的一条记录
    const record = await hit_dlts.findOne().sort({ Issue: -1 }).lean();

    console.log('========== 最新记录的所有字段 ==========\n');
    console.log(JSON.stringify(record, null, 2));

    await mongoose.connection.close();
});
