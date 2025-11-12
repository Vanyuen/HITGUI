const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    const DLT = mongoose.model('HIT_DLT', new mongoose.Schema({}, { strict: false, collection: 'HIT_DLT' }));

    // 获取最新的一条记录
    const record = await DLT.findOne().sort({ Issue: -1 }).lean();

    console.log('========== 最新记录的所有字段 ==========\n');
    console.log(JSON.stringify(record, null, 2));

    await mongoose.connection.close();
});
