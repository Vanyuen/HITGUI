/**
 * 根据hit_dlts表重新生成遗漏值数据
 * 生成表: DLTRedMissing 和 DLTBlueMissing
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function connectDB() {
    const mongoURI = 'mongodb://localhost:27017/lottery';
    await mongoose.connect(mongoURI);
    console.log('✅ 数据库连接成功: lottery');
}

// hit_dlts Schema
const dltSchema = new mongoose.Schema({
    ID: { type: Number, required: true, unique: true },
    Issue: { type: Number, required: true, unique: true },
    Red1: { type: Number, required: true },
    Red2: { type: Number, required: true },
    Red3: { type: Number, required: true },
    Red4: { type: Number, required: true },
    Red5: { type: Number, required: true },
    Blue1: { type: Number, required: true },
    Blue2: { type: Number, required: true },
    DrawDate: { type: Date, required: true }
});

const hit_dlts = mongoose.model('hit_dlts', dltSchema);

// 计算热温冷比
function calculateHotWarmColdRatio(missingValues) {
    let hot = 0, warm = 0, cold = 0;

    missingValues.forEach(missing => {
        if (missing <= 4) hot++;
        else if (missing <= 9) warm++;
        else cold++;
    });

    return `${hot}:${warm}:${cold}`;
}

// 生成遗漏值数据
async function generateMissingValues() {
    try {
        await connectDB();

        console.log('\n🔄 开始生成遗漏值数据...\n');

        // 获取所有开奖记录，按期号升序
        const allRecords = await hit_dlts.find({}).sort({ Issue: 1 }).lean();
        console.log(`📊 共 ${allRecords.length} 期数据`);

        if (allRecords.length === 0) {
            console.log('❌ 没有数据可处理');
            return;
        }

        // 初始化遗漏值数组（35个红球，12个蓝球）
        const redMissing = Array(35).fill(0);
        const blueMissing = Array(12).fill(0);

        const redMissingRecords = [];
        const blueMissingRecords = [];

        // 遍历所有记录计算遗漏值
        for (let i = 0; i < allRecords.length; i++) {
            const record = allRecords[i];
            const drawnReds = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];
            const drawnBlues = [record.Blue1, record.Blue2];

            // 计算本期开奖号码的热温冷比（基于上一期开奖后的遗漏值）
            const drawnRedsMissing = drawnReds.map(ball => redMissing[ball - 1]);
            const hotWarmColdRatio = calculateHotWarmColdRatio(drawnRedsMissing);

            // 所有球的遗漏值+1
            for (let j = 0; j < 35; j++) redMissing[j]++;
            for (let j = 0; j < 12; j++) blueMissing[j]++;

            // 本期开出的球遗漏值归0
            drawnReds.forEach(ball => {
                redMissing[ball - 1] = 0;
            });
            drawnBlues.forEach(ball => {
                blueMissing[ball - 1] = 0;
            });

            // 生成红球遗漏记录
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

            // 生成蓝球遗漏记录
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

        console.log(`\n✅ 遗漏值计算完成，共 ${redMissingRecords.length} 期`);

        // 清空旧数据
        console.log('\n🗑️  清空旧的遗漏值数据...');
        await mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories').deleteMany({});
        await mongoose.connection.db.collection('hit_dlts').deleteMany({});
        console.log('✅ 旧数据已清空');

        // 批量插入新数据
        console.log('\n💾 插入新的遗漏值数据...');
        const batchSize = 500;

        for (let i = 0; i < redMissingRecords.length; i += batchSize) {
            const batch = redMissingRecords.slice(i, i + batchSize);
            await mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories').insertMany(batch);
            console.log(`   红球遗漏: ${Math.min(i + batchSize, redMissingRecords.length)} / ${redMissingRecords.length}`);
        }

        for (let i = 0; i < blueMissingRecords.length; i += batchSize) {
            const batch = blueMissingRecords.slice(i, i + batchSize);
            await mongoose.connection.db.collection('hit_dlts').insertMany(batch);
            console.log(`   蓝球遗漏: ${Math.min(i + batchSize, blueMissingRecords.length)} / ${blueMissingRecords.length}`);
        }

        console.log('\n✅ 遗漏值数据生成完成！');

        // 验证结果
        const redCount = await mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories').countDocuments();
        const blueCount = await mongoose.connection.db.collection('hit_dlts').countDocuments();
        const latestRed = await mongoose.connection.db.collection('hit_dlt_basictrendchart_redballmissing_histories')
            .findOne({}, { sort: { Issue: -1 } });

        console.log('\n📊 验证结果:');
        console.log(`   红球遗漏记录数: ${redCount}`);
        console.log(`   蓝球遗漏记录数: ${blueCount}`);
        console.log(`   最新期号: ${latestRed?.Issue}`);
        console.log(`   热温冷比: ${latestRed?.FrontHotWarmColdRatio}`);

    } catch (error) {
        console.error('❌ 生成失败:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n数据库连接已关闭');
    }
}

generateMissingValues();
