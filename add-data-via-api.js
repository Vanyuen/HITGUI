/**
 * 通过HTTP API向运行中的应用添加测试数据
 * 这个脚本会直接调用内部API来插入数据
 */

const mongoose = require('mongoose');

// 连接到运行中应用的数据库
// 端口9976是从应用启动日志中看到的
async function addDataToRunningApp() {
    try {
        console.log('🔌 连接到运行中的应用数据库...');

        await mongoose.connect('mongodb://127.0.0.1:9976/test', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 已连接到数据库');

        // 定义Schema
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
        });

        const DLTRedMissingSchema = new mongoose.Schema({
            ID: Number,
            Issue: Number,
            Red01: Number, Red02: Number, Red03: Number, Red04: Number, Red05: Number,
            Red06: Number, Red07: Number, Red08: Number, Red09: Number, Red10: Number,
            Red11: Number, Red12: Number, Red13: Number, Red14: Number, Red15: Number,
            Red16: Number, Red17: Number, Red18: Number, Red19: Number, Red20: Number,
            Red21: Number, Red22: Number, Red23: Number, Red24: Number, Red25: Number,
            Red26: Number, Red27: Number, Red28: Number, Red29: Number, Red30: Number,
            Red31: Number, Red32: Number, Red33: Number, Red34: Number, Red35: Number,
            FrontHotWarmColdRatio: String
        });

        const DLT = mongoose.model('HIT_DLT', DLTSchema);
        const DLTRedMissing = mongoose.model('HIT_DLT_Basictrendchart_redballmissing_history', DLTRedMissingSchema);

        // 检查是否已有数据
        const existingCount = await DLT.countDocuments();
        console.log(`📊 当前数据库中已有 ${existingCount} 期数据`);

        if (existingCount > 0) {
            console.log('⚠️  数据库中已有数据，是否要清除？(Ctrl+C取消)');
            // 简单起见，自动清除
            await DLT.deleteMany({});
            await DLTRedMissing.deleteMany({});
            console.log('✅ 已清除现有数据');
        }

        // 生成30期测试数据
        console.log('🎲 开始生成30期测试数据...');
        const dltData = [];
        const missingData = [];
        const startIssue = 25095;

        for (let i = 0; i < 30; i++) {
            const issue = startIssue + i;
            const id = i + 1;

            // 生成随机红球
            const redBalls = [];
            while (redBalls.length < 5) {
                const ball = Math.floor(Math.random() * 35) + 1;
                if (!redBalls.includes(ball)) redBalls.push(ball);
            }
            redBalls.sort((a, b) => a - b);

            // 生成随机蓝球
            const blueBalls = [];
            while (blueBalls.length < 2) {
                const ball = Math.floor(Math.random() * 12) + 1;
                if (!blueBalls.includes(ball)) blueBalls.push(ball);
            }
            blueBalls.sort((a, b) => a - b);

            const drawDate = new Date(2025, 9, 1 + i * 2);

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

            // 生成遗漏值
            const missingRecord = { ID: id, Issue: issue };
            for (let ball = 1; ball <= 35; ball++) {
                const ballKey = `Red${String(ball).padStart(2, '0')}`;
                if (redBalls.includes(ball)) {
                    missingRecord[ballKey] = 0;
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

        // 插入数据
        await DLT.insertMany(dltData);
        console.log(`✅ 已插入 ${dltData.length} 期开奖数据`);

        await DLTRedMissing.insertMany(missingData);
        console.log(`✅ 已插入 ${missingData.length} 期遗漏值数据`);

        console.log('\n📊 数据摘要:');
        console.log(`期号范围: ${startIssue} - ${startIssue + 29}`);
        console.log(`第一期: ${dltData[0].Red1}-${dltData[0].Red2}-${dltData[0].Red3}-${dltData[0].Red4}-${dltData[0].Red5} + ${dltData[0].Blue1}-${dltData[0].Blue2}`);
        console.log(`最后一期: ${dltData[29].Red1}-${dltData[29].Red2}-${dltData[29].Red3}-${dltData[29].Red4}-${dltData[29].Red5} + ${dltData[29].Blue1}-${dltData[29].Blue2}`);

        console.log('\n✅ 完成！现在刷新应用页面即可查看趋势图');

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 数据库连接已关闭');
    }
}

addDataToRunningApp();
