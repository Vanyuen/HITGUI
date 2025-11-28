const mongoose = require('mongoose');

async function checkLatestMissingData() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', { useNewUrlParser: true, useUnifiedTopology: true });
        
        const DLTRedMissing = mongoose.model('DLTRedMissing', new mongoose.Schema({
            Issue: Number,
            RedBallMissing: [Number]
        }));

        const latestMissing = await DLTRedMissing.find({})
            .sort({ Issue: -1 })
            .limit(10);
        
        console.log('最近10期遗漏数据:');
        latestMissing.forEach(record => {
            console.log(`期号: ${record.Issue}`);
        });

    } catch (error) {
        console.error('检查遗漏数据失败:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkLatestMissingData();
