const mongoose = require('mongoose');

const DLTSchema = new mongoose.Schema({
    ID: Number,
    Issue: String,
    Red1: Number,
    Red2: Number,
    Red3: Number,
    Red4: Number,
    Red5: Number
}, { collection: 'HIT_DLT' });

const DLT = mongoose.model('DLT_LatestQuery', DLTSchema);

async function queryLatestIssues() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到MongoDB\n');

        const count = await DLT.countDocuments();
        console.log(`数据库总记录数: ${count}期\n`);

        if (count === 0) {
            console.log('❌ 数据库中没有数据');
            return;
        }

        const latest = await DLT.findOne({}).sort({ ID: -1 }).lean();
        console.log(`最新期号: ${latest.Issue} (ID=${latest.ID})\n`);

        const records = await DLT.find({}).sort({ ID: -1 }).limit(15).lean();
        console.log('最近15期:');
        records.forEach((r, index) => {
            const redBalls = [r.Red1, r.Red2, r.Red3, r.Red4, r.Red5];
            const sum = redBalls.reduce((a, b) => a + b, 0);
            const span = Math.max(...redBalls) - Math.min(...redBalls);
            console.log(`  ${index + 1}. 期号${r.Issue} (ID=${r.ID}): 红球 ${redBalls.join(' ')} | 和值=${sum} | 跨度=${span}`);
        });

    } catch (error) {
        console.error('❌ 查询失败:', error);
    } finally {
        await mongoose.connection.close();
    }
}

queryLatestIssues();
