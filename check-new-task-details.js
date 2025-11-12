/**
 * 检查最新任务的详细字段值
 */

const mongoose = require('mongoose');

const DB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function check() {
    try {
        console.log('🔍 连接数据库...');
        await mongoose.connect(DB_URI);
        console.log('✅ 数据库连接成功\n');

        const Result = mongoose.model('Result_temp', new mongoose.Schema({}, {
            strict: false,
            collection: 'hit_dlt_hwcpositivepredictiontaskresults'
        }));

        // 查询最新任务的一个样本结果
        const result = await Result.findOne({ task_id: 'hwc-pos-20251110-tew' })
            .sort({ created_at: -1 })
            .lean();

        if (!result) {
            console.log('❌ 未找到任务数据');
            return;
        }

        console.log('📊 任务结果详细字段检查:');
        console.log(`   task_id: ${result.task_id}`);
        console.log(`   period: ${result.period}`);
        console.log(`   combination_count: ${result.combination_count}`);
        console.log('');

        console.log('🔍 positive_selection_details 字段:');
        if (result.positive_selection_details) {
            console.log(`   ✅ 字段存在`);
            console.log(`   数据: ${JSON.stringify(result.positive_selection_details, null, 2)}`);
        } else {
            console.log(`   ❌ 字段不存在或为null`);
        }
        console.log('');

        console.log('🔍 exclusion_summary 字段:');
        if (result.exclusion_summary) {
            console.log(`   ✅ 字段存在`);
            console.log(`   数据: ${JSON.stringify(result.exclusion_summary, null, 2)}`);
        } else {
            console.log(`   ❌ 字段不存在或为null`);
        }
        console.log('');

        console.log('🔍 paired_combinations 字段:');
        if (result.paired_combinations) {
            console.log(`   ✅ 字段存在`);
            console.log(`   数量: ${result.paired_combinations.length}`);
            if (result.paired_combinations.length > 0) {
                console.log(`   示例: ${JSON.stringify(result.paired_combinations[0], null, 2)}`);
            }
        } else {
            console.log(`   ❌ 字段不存在或为null`);
        }
        console.log('');

        console.log('📋 完整对象的所有字段名:');
        console.log(Object.keys(result).join(', '));

    } catch (error) {
        console.error('❌ 检查失败:', error);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 数据库连接已关闭');
    }
}

check();
