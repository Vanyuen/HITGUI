const mongoose = require('mongoose');

async function checkPairingData() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到MongoDB\n');

        const resultColl = mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults');
        const result = await resultColl.findOne({
            task_id: 'hwc-pos-20251029-vvz',
            period: '25105'
        });

        if (!result) {
            console.log('❌ 未找到结果文档');
            await mongoose.connection.close();
            process.exit(1);
        }

        console.log('📋 结果字段:', Object.keys(result).join(', '));
        console.log('\n📊 组合数据:');
        console.log('  red_combinations:', result.red_combinations?.length);
        console.log('  blue_combinations:', result.blue_combinations?.length);
        console.log('  paired_combinations:', result.paired_combinations?.length);

        console.log('\n🔗 配对信息:');
        console.log('  pairing_indices 存在?:', !!result.pairing_indices);
        if (result.pairing_indices) {
            console.log('  pairing_indices 长度:', result.pairing_indices.length);
            console.log('  前5个:', result.pairing_indices.slice(0, 5));
        }

        console.log('\n📦 组合计数:', result.combination_count);

        await mongoose.connection.close();
        console.log('\n✅ 检查完成');

    } catch (error) {
        console.error('❌ 检查失败:', error);
        process.exit(1);
    }
}

checkPairingData();
