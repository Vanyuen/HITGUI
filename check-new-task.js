/**
 * 检查最新任务的详细信息
 */

const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    task_id: String,
    period: Number,
    is_predicted: Boolean,
    combination_count: Number,
    red_combinations: [Number],
    hit_analysis: Object
});

const Result = mongoose.model(
    'HIT_DLT_HwcPositivePredictionTaskResult',
    resultSchema,
    'hit_dlt_hwcpositivepredictiontaskresults'
);

async function check() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');

        const results = await Result.find({ task_id: 'hwc-pos-20251115-ixl' })
            .sort({ period: 1 })
            .lean();

        console.log('任务 hwc-pos-20251115-ixl 的期号列表:');
        console.log('='.repeat(80));

        results.forEach(r => {
            const status = r.is_predicted ? '(推算)' : '(已开奖)';
            const comboCount = r.combination_count || 'undefined';
            const redCombos = r.red_combinations?.length || 0;
            const maxRedHit = r.hit_analysis?.max_red_hit || 0;

            console.log(\`期号 \${r.period}\${status}: combo_count=\${comboCount}, red_combos=\${redCombos}个, max_red_hit=\${maxRedHit}\`);
        });

        console.log('='.repeat(80));
        mongoose.connection.close();

    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

check();
