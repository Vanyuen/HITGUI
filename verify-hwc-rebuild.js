const mongoose = require('mongoose');

async function verify() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

        const col = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        // 1. 检查记录总数
        const count = await col.countDocuments();
        console.log('✅ 记录总数:', count);

        // 2. 检查第一条记录
        const first = await col.findOne({}, {sort: {base_issue: 1}});
        console.log('\n📊 第一条记录:');
        console.log('  base_issue:', first.base_issue);
        console.log('  target_issue:', first.target_issue);
        console.log('  total_combinations:', first.total_combinations);
        console.log('  hot_warm_cold_data 类型数:', Object.keys(first.hot_warm_cold_data || {}).length);

        // 3. 检查最后一条记录
        const last = await col.findOne({}, {sort: {target_issue: -1}});
        console.log('\n📊 最后一条记录:');
        console.log('  base_issue:', last.base_issue);
        console.log('  target_issue:', last.target_issue);
        console.log('  total_combinations:', last.total_combinations);
        console.log('  hot_warm_cold_data 类型数:', Object.keys(last.hot_warm_cold_data || {}).length);

        // 4. 检查新字段覆盖率
        const withNewFields = await col.countDocuments({total_combinations: {$exists: true}});
        console.log('\n✅ 包含 total_combinations 字段的记录数:', withNewFields);
        console.log('✅ 新字段覆盖率:', ((withNewFields / count) * 100).toFixed(1) + '%');

        // 5. 随机抽样检查
        const sample = await col.findOne({base_issue: '25120'});
        if (sample) {
            console.log('\n📊 样本检查 (25120 → 25121):');
            console.log('  total_combinations:', sample.total_combinations);
            console.log('  hot_warm_cold_data 类型数:', Object.keys(sample.hot_warm_cold_data || {}).length);
            const firstRatio = Object.keys(sample.hot_warm_cold_data)[0];
            console.log('  示例比例:', firstRatio, '→', sample.hot_warm_cold_data[firstRatio].length, '个组合');
        }

        console.log('\n🎉 验证完成！');

        await mongoose.connection.close();
    } catch (error) {
        console.error('❌ 验证失败:', error.message);
        process.exit(1);
    }
}

verify();
