/**
 * 完整诊断热温冷比优化表状态
 */

const mongoose = require('mongoose');

async function fullDiagnosis() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到 MongoDB\n');

        const db = mongoose.connection.db;

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 步骤1：列出所有热温冷相关集合及记录数');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        const allCollections = await db.listCollections().toArray();
        const hwcRelated = allCollections.filter(c =>
            c.name.toLowerCase().includes('hot') ||
            c.name.toLowerCase().includes('hwc') ||
            c.name.toLowerCase().includes('warm') ||
            c.name.toLowerCase().includes('redcombinations')
        ).sort((a, b) => a.name.localeCompare(b.name));

        for (const coll of hwcRelated) {
            const count = await db.collection(coll.name).countDocuments();
            const marker = count > 0 ? '✅' : '⚪';
            console.log(`${marker} ${coll.name.padEnd(60)} ${count.toString().padStart(6)} 条`);
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 步骤2：检查代码中使用的正表');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 根据代码 src/server/server.js:518
        // 模型名: HIT_DLT_RedCombinationsHotWarmColdOptimized
        // 实际集合: hit_dlt_redcombinationshotwarmcoldoptimizeds
        const officialCollection = 'hit_dlt_redcombinationshotwarmcoldoptimizeds';
        const officialColl = db.collection(officialCollection);
        const officialCount = await officialColl.countDocuments();

        console.log(`📌 正表（代码中使用）: ${officialCollection}`);
        console.log(`   记录数: ${officialCount}\n`);

        if (officialCount > 0) {
            const drawnCount = await officialColl.countDocuments({ is_predicted: false });
            const predictedCount = await officialColl.countDocuments({ is_predicted: true });

            console.log(`   - 已开奖期: ${drawnCount} 条`);
            console.log(`   - 推算期: ${predictedCount} 条`);

            const earliest = await officialColl.findOne({}, { sort: { base_issue: 1 } });
            const latest = await officialColl.findOne({}, { sort: { base_issue: -1 } });

            console.log(`   - 期号范围: ${earliest.base_issue}→${earliest.target_issue} 至 ${latest.base_issue}→${latest.target_issue}`);
            console.log(`   - 插入时间: ${earliest._id.getTimestamp().toLocaleDateString('zh-CN')} 至 ${latest._id.getTimestamp().toLocaleDateString('zh-CN')}`);
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 步骤3：检查验证逻辑查询的集合');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 验证代码可能查询的其他集合
        const possibleCollections = [
            'HIT_DLT_RedCombinationsHotWarmColdOptimized',  // 大写（Mongoose可能自动转换）
            'hit_dlt_redcombinationshotwarmcoldoptimizeds', // 实际集合
            'dltredcombinationshotwarmcoldoptimizeds'       // Mongoose默认转换
        ];

        for (const collName of possibleCollections) {
            try {
                const coll = db.collection(collName);
                const count = await coll.countDocuments();
                const exists = await db.listCollections({ name: collName }).hasNext();
                console.log(`   ${collName}`);
                console.log(`      存在: ${exists ? '✅' : '❌'}, 记录数: ${count}`);
            } catch (error) {
                console.log(`   ${collName}: ❌ 无法访问`);
            }
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 步骤4：模拟验证逻辑查询');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // 模拟验证逻辑中的查询
        const DLTRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({}, {
            collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds',
            strict: false
        });
        const TestModel = mongoose.model('TestHWCModel', DLTRedCombinationsHotWarmColdOptimizedSchema);

        const testCount = await TestModel.countDocuments();
        console.log(`   使用Mongoose模型查询: ${testCount} 条记录`);
        console.log(`   状态: ${testCount === 2792 ? '✅ 正常' : '❌ 异常'}`);

        await mongoose.connection.close();
        console.log('\n✅ 数据库连接已关闭');

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

fullDiagnosis();
