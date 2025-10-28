/**
 * 添加大乐透示例数据到数据库
 * 用于测试和演示趋势图功能
 */

const mongoose = require('mongoose');

// 连接到本地MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// 定义Schema（与server.js中的一致）
const DLTSchema = new mongoose.Schema({
    ID: Number,
    Issue: Number,
    Red1: Number,
    Red2: Number,
    Red3: Number,
    Red4: Number,
    Red5: Number,
    Blue1: Number,
    Blue2: Number,
    DrawDate: Date
}, { collection: 'HIT_DLT' });

const DLTRedMissingSchema = new mongoose.Schema({
    ID: Number,
    Issue: Number,
    Red01: Number,
    Red02: Number,
    Red03: Number,
    Red04: Number,
    Red05: Number,
    Red06: Number,
    Red07: Number,
    Red08: Number,
    Red09: Number,
    Red10: Number,
    Red11: Number,
    Red12: Number,
    Red13: Number,
    Red14: Number,
    Red15: Number,
    Red16: Number,
    Red17: Number,
    Red18: Number,
    Red19: Number,
    Red20: Number,
    Red21: Number,
    Red22: Number,
    Red23: Number,
    Red24: Number,
    Red25: Number,
    Red26: Number,
    Red27: Number,
    Red28: Number,
    Red29: Number,
    Red30: Number,
    Red31: Number,
    Red32: Number,
    Red33: Number,
    Red34: Number,
    Red35: Number,
    FrontHotWarmColdRatio: String
}, { collection: 'HIT_DLT_RedMissing' });

const DLT = mongoose.model('DLT', DLTSchema);
const DLTRedMissing = mongoose.model('DLTRedMissing', DLTRedMissingSchema);

// 生成最近30期的示例数据
async function generateSampleData() {
    console.log('🎲 开始生成大乐透示例数据...');

    const dltData = [];
    const missingData = [];
    const currentYear = 2025;
    const startIssue = 25095; // 从25095期开始

    for (let i = 0; i < 30; i++) {
        const issue = startIssue + i;
        const id = i + 1;

        // 生成随机的5个前区号码（1-35）
        const redBalls = [];
        while (redBalls.length < 5) {
            const ball = Math.floor(Math.random() * 35) + 1;
            if (!redBalls.includes(ball)) {
                redBalls.push(ball);
            }
        }
        redBalls.sort((a, b) => a - b);

        // 生成随机的2个后区号码（1-12）
        const blueBalls = [];
        while (blueBalls.length < 2) {
            const ball = Math.floor(Math.random() * 12) + 1;
            if (!blueBalls.includes(ball)) {
                blueBalls.push(ball);
            }
        }
        blueBalls.sort((a, b) => a - b);

        // 生成开奖日期
        const drawDate = new Date(2025, 9, 1 + i * 2); // 每2天一期

        // DLT主表数据
        dltData.push({
            ID: id,
            Issue: issue,
            Red1: redBalls[0],
            Red2: redBalls[1],
            Red3: redBalls[2],
            Red4: redBalls[3],
            Red5: redBalls[4],
            Blue1: blueBalls[0],
            Blue2: blueBalls[1],
            DrawDate: drawDate
        });

        // 生成遗漏值数据（模拟）
        const missingRecord = {
            ID: id,
            Issue: issue
        };

        // 为每个号码生成随机遗漏值（0-20）
        for (let ball = 1; ball <= 35; ball++) {
            const ballKey = `Red${String(ball).padStart(2, '0')}`;
            if (redBalls.includes(ball)) {
                missingRecord[ballKey] = 0; // 开出的号码遗漏值为0
            } else {
                missingRecord[ballKey] = Math.floor(Math.random() * 20);
            }
        }

        // 计算热温冷比
        let hot = 0, warm = 0, cold = 0;
        for (let ball = 1; ball <= 35; ball++) {
            const ballKey = `Red${String(ball).padStart(2, '0')}`;
            const missing = missingRecord[ballKey];
            if (missing <= 4) hot++;
            else if (missing <= 9) warm++;
            else cold++;
        }
        missingRecord.FrontHotWarmColdRatio = `${hot}:${warm}:${cold}`;

        missingData.push(missingRecord);
    }

    try {
        // 删除现有数据
        await DLT.deleteMany({});
        await DLTRedMissing.deleteMany({});
        console.log('✅ 清除现有数据完成');

        // 插入新数据
        await DLT.insertMany(dltData);
        console.log(`✅ 已插入 ${dltData.length} 期大乐透开奖数据`);

        await DLTRedMissing.insertMany(missingData);
        console.log(`✅ 已插入 ${missingData.length} 期遗漏值数据`);

        console.log('\n📊 示例数据统计:');
        console.log(`期号范围: ${startIssue} - ${startIssue + 29}`);
        console.log(`总期数: 30期`);
        console.log(`第一期: ${startIssue} | ${dltData[0].Red1}-${dltData[0].Red2}-${dltData[0].Red3}-${dltData[0].Red4}-${dltData[0].Red5} + ${dltData[0].Blue1}-${dltData[0].Blue2}`);
        console.log(`最后一期: ${startIssue + 29} | ${dltData[29].Red1}-${dltData[29].Red2}-${dltData[29].Red3}-${dltData[29].Red4}-${dltData[29].Red5} + ${dltData[29].Blue1}-${dltData[29].Blue2}`);

        console.log('\n✅ 示例数据生成完成！现在您可以在应用中查看趋势图了。');
        console.log('💡 提示: 刷新应用页面以加载新数据');

    } catch (error) {
        console.error('❌ 插入数据时出错:', error);
    } finally {
        mongoose.connection.close();
        console.log('\n🔌 数据库连接已关闭');
    }
}

// 执行
generateSampleData().catch(console.error);
