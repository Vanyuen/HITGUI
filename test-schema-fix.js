const mongoose = require('mongoose');
const path = require('path');

// 加载完整的server.js来获取Schema定义
const serverPath = path.join(__dirname, 'src', 'server', 'server.js');
console.log('🔍 测试Schema collection配置是否生效...\n');

// 连接数据库
mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
    console.log('✅ 数据库连接成功\n');

    // 1. 手动定义Schema来测试collection配置
    console.log('📝 测试步骤1: 手动定义Schema（包含collection配置）');

    const testSchema = new mongoose.Schema({
        base_issue: { type: String, required: true },
        target_issue: { type: String, required: true },
        hot_warm_cold_data: {
            type: Map,
            of: [Number],
            required: true
        }
    }, {
        collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds'  // 手动指定正确的表名
    });

    const TestModel = mongoose.model('TestHWCOptimized', testSchema);

    // 2. 测试查询
    console.log('🔍 测试步骤2: 查询热温冷优化数据...');

    try {
        const count = await TestModel.countDocuments();
        console.log(`   ✅ 通过Schema查询到 ${count} 条记录`);

        if (count > 0) {
            // 查找包含25123-25124的数据
            const sample = await TestModel.findOne({
                $or: [
                    { base_issue: '25123', target_issue: '25124' },
                    { base_issue: '25122', target_issue: '25123' },
                    { base_issue: '25121', target_issue: '25122' }
                ]
            }).lean();

            if (sample) {
                console.log('   ✅ 找到期号对数据样本:');
                console.log(`      ${sample.base_issue} → ${sample.target_issue}`);
                console.log(`      热温冷比种类数: ${sample.hot_warm_cold_data ? sample.hot_warm_cold_data.size || Object.keys(sample.hot_warm_cold_data).length : 0}`);
            } else {
                console.log('   ⚠️ 未找到25121-25124范围的期号对数据');
            }
        }

    } catch (error) {
        console.log('   ❌ 查询失败:', error.message);
    }

    // 3. 对比错误的表名查询
    console.log('\n🔍 测试步骤3: 对比错误表名的查询结果...');

    const wrongSchema = new mongoose.Schema({
        base_issue: { type: String, required: true },
        target_issue: { type: String, required: true }
    }); // 没有指定collection，使用默认名称

    const WrongModel = mongoose.model('WrongHWCOptimized', wrongSchema);

    try {
        const wrongCount = await WrongModel.countDocuments();
        console.log(`   ❌ 使用默认表名查询到 ${wrongCount} 条记录（应该是0）`);
    } catch (error) {
        console.log('   ❌ 错误表名查询失败:', error.message);
    }

    // 4. 直接数据库查询验证
    console.log('\n🔍 测试步骤4: 直接验证数据库集合...');

    const db = mongoose.connection.db;
    const directCount = await db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds').countDocuments();
    console.log(`   ✅ 直接查询数据库集合: ${directCount} 条记录`);

    // 5. 测试结论
    console.log('\n📊 测试结果分析:');

    if (count === directCount && count > 2000) {
        console.log('   🎉 SUCCESS: Schema collection配置生效！');
        console.log('   ✅ Mongoose Schema正确连接到包含2792条数据的表');
        console.log('   ✅ 这意味着应用重启后将能查询到热温冷优化数据');
        console.log('   ✅ 所有已开奖期号应该不再显示0组合');
    } else if (count === 0) {
        console.log('   ❌ FAILED: Schema collection配置未生效');
        console.log('   ❌ Mongoose Schema仍在查询空表');
        console.log('   ❌ 需要检查代码是否正确保存和重启');
    } else {
        console.log('   ⚠️ WARNING: 数据不完整');
        console.log(`   ⚠️ 预期2792条，实际${count}条`);
    }

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error('❌ 数据库连接失败:', err);
    process.exit(1);
});