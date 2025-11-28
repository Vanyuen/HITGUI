/**
 * 直接生成遗漏数据（不通过服务器）
 */
const mongoose = require('mongoose');

async function generateMissingData() {
    try {
        console.log('🔌 连接MongoDB...\n');
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

        // 定义hit_dlts Schema
        const dltSchema = new mongoose.Schema({
            ID: Number,
            Issue: Number,
            DrawDate: Date,
            Red1: Number, Red2: Number, Red3: Number, Red4: Number, Red5: Number,
            Blue1: Number, Blue2: Number
        });

        //⭐ 明确指定使用 hit_dlts 集合
        const hit_dlts = mongoose.model('HIT_DLT_DirectGen', dltSchema, 'hit_dlts');

        console.log('📊 读取大乐透历史数据...');
        const allRecords = await hit_dlts.find({}).sort({ Issue: 1 }).lean();
        console.log(`✅ 找到 ${allRecords.length} 期数据\n`);

        if (allRecords.length === 0) {
            console.log('❌ hit_dlts 表为空，无法生成遗漏数据！');
            await mongoose.disconnect();
            return;
        }

        const redMissing = Array(35).fill(0);
        const blueMissing = Array(12).fill(0);
        const redMissingRecords = [];
        const blueMissingRecords = [];

        // 计算热温冷比辅助函数
        const calculateHWCRatio = (missingValues) => {
            let hot = 0, warm = 0, cold = 0;
            missingValues.forEach(missing => {
                if (missing <= 4) hot++;
                else if (missing <= 9) warm++;
                else cold++;
            });
            return `${hot}:${warm}:${cold}`;
        };

        console.log('🔄 开始计算遗漏值...\n');

        for (let i = 0; i < allRecords.length; i++) {
            const record = allRecords[i];
            const drawnReds = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];
            const drawnBlues = [record.Blue1, record.Blue2];

            // 遗漏值递增
            for (let j = 0; j < 35; j++) redMissing[j]++;
            for (let j = 0; j < 12; j++) blueMissing[j]++;

            // 重置开出号码的遗漏值
            drawnReds.forEach(ball => { redMissing[ball - 1] = 0; });
            drawnBlues.forEach(ball => { blueMissing[ball - 1] = 0; });

            // 计算当前期的热温冷比
            const hotWarmColdRatio = calculateHWCRatio(redMissing);

            // 红球遗漏记录
            const redRecord = {
                ID: record.ID,
                Issue: record.Issue.toString(),
                DrawingDay: record.DrawDate ? new Date(record.DrawDate).toLocaleDateString('zh-CN') : '',
                FrontHotWarmColdRatio: hotWarmColdRatio
            };
            for (let j = 0; j < 35; j++) {
                redRecord[(j + 1).toString()] = redMissing[j];
            }
            redMissingRecords.push(redRecord);

            // 蓝球遗漏记录
            const blueRecord = {
                ID: record.ID,
                Issue: record.Issue.toString(),
                DrawingDay: record.DrawDate ? new Date(record.DrawDate).toLocaleDateString('zh-CN') : ''
            };
            for (let j = 0; j < 12; j++) {
                blueRecord[(j + 1).toString()] = blueMissing[j];
            }
            blueMissingRecords.push(blueRecord);

            if ((i + 1) % 500 === 0) {
                console.log(`   处理进度: ${i + 1} / ${allRecords.length}`);
            }
        }

        console.log(`\n✅ 遗漏值计算完成！共 ${redMissingRecords.length} 期\n`);

        // 插入数据
        console.log('💾 插入新的遗漏值数据...\n');
        const batchSize = 500;

        // 使用临时集合名
        const redTempCollection = 'hit_dlt_basictrendchart_redballmissing_histories_new';
        const blueTempCollection = 'hit_dlt_basictrendchart_blueballmissing_histories_new';

        // 先删除可能存在的临时集合
        await mongoose.connection.db.collection(redTempCollection).drop().catch(() => {});
        await mongoose.connection.db.collection(blueTempCollection).drop().catch(() => {});

        // 插入到临时集合
        for (let i = 0; i < redMissingRecords.length; i += batchSize) {
            const batch = redMissingRecords.slice(i, i + batchSize);
            await mongoose.connection.db.collection(redTempCollection).insertMany(batch);
            console.log(`   红球遗漏: ${Math.min(i + batchSize, redMissingRecords.length)} / ${redMissingRecords.length}`);
        }

        for (let i = 0; i < blueMissingRecords.length; i += batchSize) {
            const batch = blueMissingRecords.slice(i, i + batchSize);
            await mongoose.connection.db.collection(blueTempCollection).insertMany(batch);
            console.log(`   蓝球遗漏: ${Math.min(i + batchSize, blueMissingRecords.length)} / ${blueMissingRecords.length}`);
        }

        console.log(`\n🔄 替换旧数据...`);
        // 删除旧集合
        await mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories').drop().catch(() => {});
        await mongoose.connection.db.collection('hit_dlts').drop().catch(() => {});

        // 重命名临时集合为正式集合
        await mongoose.connection.db.collection(redTempCollection).rename('hit_dlt_basictrendchart_redballmissing_histories');
        await mongoose.connection.db.collection(blueTempCollection).rename('hit_dlts');

        console.log('✅ 数据替换完成\n');

        // 验证
        const redCount = await mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories').countDocuments();
        const blueCount = await mongoose.connection.db.collection('hit_dlts').countDocuments();

        console.log('═══════════════════════════════════════\n');
        console.log('🎉 遗漏值表生成完成！\n');
        console.log(`   红球遗漏表: ${redCount} 期`);
        console.log(`   蓝球遗漏表: ${blueCount} 期`);
        console.log('\n═══════════════════════════════════════\n');

        await mongoose.disconnect();

    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

generateMissingData();
