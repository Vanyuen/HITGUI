/**
 * 验证新任务所有期号的统计数据
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

        const results = await Result.find({ task_id: 'hwc-pos-20251110-tew' })
            .sort({ period: 1 })
            .lean();

        console.log(`📊 任务 hwc-pos-20251110-tew 共 ${results.length} 个期号结果\n`);

        let allHaveStats = true;
        let totalCombos = 0;

        for (const r of results) {
            const psd = r.positive_selection_details || {};
            const es = r.exclusion_summary || {};

            const hasAllFields = psd.step1_count && psd.step2_retained_count &&
                                 psd.step3_retained_count && psd.step6_retained_count &&
                                 psd.final_retained_count;

            if (!hasAllFields) allHaveStats = false;
            totalCombos += r.combination_count || 0;

            console.log(`期号${r.period}: ${(r.combination_count || 0).toLocaleString()}组合`);
            console.log(`  正选: ${psd.step1_count || 'N/A'} → ${psd.step2_retained_count || 'N/A'} → ${psd.step6_retained_count || 'N/A'} → ${psd.final_retained_count || 'N/A'}`);
            console.log(`  排除: 和值=${es.sum_exclude_count || 0}, 跨度=${es.span_exclude_count || 0}, final=${es.final_count || 'N/A'}`);
            console.log('');
        }

        console.log(`\n📈 统计:`);
        console.log(`  所有期号都有完整统计: ${allHaveStats ? '✅' : '❌'}`);
        console.log(`  平均组合数: ${Math.round(totalCombos / results.length).toLocaleString()}`);
        console.log(`  总组合数: ${totalCombos.toLocaleString()}`);

    } catch (error) {
        console.error('❌ 检查失败:', error);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 数据库连接已关闭');
    }
}

check();
