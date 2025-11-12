const mongoose = require('mongoose');

async function checkOldFormat() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
        console.log('✅ 已连接到MongoDB\n');

        const coll = mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults');

        // Find old format result (no paired_combinations)
        const oldResult = await coll.findOne({
            paired_combinations: { $exists: false }
        });

        if(oldResult) {
            console.log('📋 旧格式结果:');
            console.log('  task_id:', oldResult.task_id);
            console.log('  period:', oldResult.period);
            console.log('  red_combinations:', oldResult.red_combinations?.length);
            console.log('  blue_combinations:', oldResult.blue_combinations?.length);
            console.log('  combination_count:', oldResult.combination_count);
            console.log('  pairing_mode:', oldResult.pairing_mode);
            console.log('  Has pairing_indices?:', !!oldResult.pairing_indices);

            if(oldResult.pairing_indices) {
                console.log('  pairing_indices length:', oldResult.pairing_indices.length);
                console.log('  First 3:', oldResult.pairing_indices.slice(0,3));
            }

            console.log('\n💡 分析:');
            console.log('  如果是默认模式(1:1配对):');
            console.log('    - 应该生成:', Math.max(oldResult.red_combinations?.length || 0, oldResult.blue_combinations?.length || 0), '个组合');
            console.log('    - (较多的一方决定总数，较少的循环配对)');

            console.log('\n🔍 All fields:', Object.keys(oldResult).join(', '));
        } else {
            console.log('❌ 没有找到旧格式结果');
        }

        await mongoose.connection.close();
        console.log('\n✅ 检查完成');

    } catch (error) {
        console.error('❌ 检查失败:', error);
        process.exit(1);
    }
}

checkOldFormat();
