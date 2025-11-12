/**
 * 导入测试数据到本地MongoDB (localhost:27017/lottery)
 */
const mongoose = require('mongoose');

async function importData() {
    try {
        console.log('🔌 连接到本地MongoDB (localhost:27017/lottery)...');
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 已连接到本地MongoDB');

        // 定义DLT Schema
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

        // 定义DLTRedMissing Schema
        const DLTRedMissingSchema = new mongoose.Schema({
            ID: { type: Number, required: true },
            Issue: { type: String, required: true },
            DrawingDay: { type: String, required: true },
            FrontHotWarmColdRatio: { type: String, required: true }
        });

        // 动态添加35个前区红球字段
        for (let i = 1; i <= 35; i++) {
            DLTRedMissingSchema.add({
                [i.toString()]: { type: Number, required: true }
            });
        }

        // 定义DLTBlueMissing Schema
        const DLTBlueMissingSchema = new mongoose.Schema({
            ID: { type: Number, required: true },
            Issue: { type: String, required: true },
            DrawingDay: { type: String, required: true }
        });

        // 动态添加12个后区蓝球字段
        for (let i = 1; i <= 12; i++) {
            DLTBlueMissingSchema.add({
                [i.toString()]: { type: Number, required: true }
            });
        }

        const DLT = mongoose.model('HIT_DLT', DLTSchema);
        const DLTRedMissing = mongoose.model('HIT_DLT_Basictrendchart_redballmissing_history', DLTRedMissingSchema);
        const DLTBlueMissing = mongoose.model('HIT_DLT_Basictrendchart_blueballmissing_history', DLTBlueMissingSchema);

        // 清除现有数据
        await DLT.deleteMany({});
        await DLTRedMissing.deleteMany({});
        await DLTBlueMissing.deleteMany({});
        console.log('✅ 已清除现有数据');

        // 生成30期测试数据
        console.log('🎲 生成30期测试数据...');
        const dltData = [];
        const redMissingData = [];
        const blueMissingData = [];
        const startIssue = 25095;
        const dayNames = ['一', '三', '六'];

        for (let i = 0; i < 30; i++) {
            const issue = startIssue + i;
            const id = i + 1;

            // 生成红球
            const redBalls = [];
            while (redBalls.length < 5) {
                const ball = Math.floor(Math.random() * 35) + 1;
                if (!redBalls.includes(ball)) redBalls.push(ball);
            }
            redBalls.sort((a, b) => a - b);

            // 生成蓝球
            const blueBalls = [];
            while (blueBalls.length < 2) {
                const ball = Math.floor(Math.random() * 12) + 1;
                if (!blueBalls.includes(ball)) blueBalls.push(ball);
            }
            blueBalls.sort((a, b) => a - b);

            const drawDate = new Date(2025, 9, 1 + i * 2);

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

            // 红球遗漏值数据
            const redMissingRecord = {
                ID: id,
                Issue: issue.toString(),
                DrawingDay: dayNames[i % 3],
                FrontHotWarmColdRatio: ''
            };

            let hot = 0, warm = 0, cold = 0;
            for (let ball = 1; ball <= 35; ball++) {
                let missing;
                if (redBalls.includes(ball)) {
                    missing = 0;
                } else {
                    missing = Math.floor(Math.random() * 20);
                }
                redMissingRecord[ball.toString()] = missing;

                if (missing <= 4) hot++;
                else if (missing <= 9) warm++;
                else cold++;
            }

            redMissingRecord.FrontHotWarmColdRatio = `${hot}:${warm}:${cold}`;
            redMissingData.push(redMissingRecord);

            // 蓝球遗漏值数据
            const blueMissingRecord = {
                ID: id,
                Issue: issue.toString(),
                DrawingDay: dayNames[i % 3]
            };

            for (let ball = 1; ball <= 12; ball++) {
                let missing;
                if (blueBalls.includes(ball)) {
                    missing = 0;
                } else {
                    missing = Math.floor(Math.random() * 15);
                }
                blueMissingRecord[ball.toString()] = missing;
            }

            blueMissingData.push(blueMissingRecord);
        }

        // 插入数据
        await DLT.insertMany(dltData);
        console.log(`✅ 已插入 ${dltData.length} 期DLT数据`);

        await DLTRedMissing.insertMany(redMissingData);
        console.log(`✅ 已插入 ${redMissingData.length} 期红球遗漏值数据`);

        await DLTBlueMissing.insertMany(blueMissingData);
        console.log(`✅ 已插入 ${blueMissingData.length} 期蓝球遗漏值数据`);

        // 验证
        const dltCount = await DLT.countDocuments();
        const redMissingCount = await DLTRedMissing.countDocuments();
        const blueMissingCount = await DLTBlueMissing.countDocuments();
        console.log(`\n📊 验证: DLT=${dltCount}, RedMissing=${redMissingCount}, BlueMissing=${blueMissingCount}`);

        console.log(`\n期号范围: ${startIssue} - ${startIssue + 29}`);
        console.log(`第一期: ${dltData[0].Red1}-${dltData[0].Red2}-${dltData[0].Red3}-${dltData[0].Red4}-${dltData[0].Red5} + ${dltData[0].Blue1}-${dltData[0].Blue2}`);
        console.log(`最后一期: ${dltData[29].Red1}-${dltData[29].Red2}-${dltData[29].Red3}-${dltData[29].Red4}-${dltData[29].Red5} + ${dltData[29].Blue1}-${dltData[29].Blue2}`);

        console.log('\n✅ 数据已导入到本地MongoDB！');
        console.log('💡 现在可以重启应用，它将自动连接到本地MongoDB (localhost:27017)');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 连接已关闭');
    }
}

importData();
