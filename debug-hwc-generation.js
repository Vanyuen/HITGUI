const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function debugHWCTableGeneration() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到数据库\n');

        // 定义模式（与之前相同，为简洁省略）
        const dltRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({
            base_issue: { type: String, required: true },
            target_issue: { type: String, required: true },
            hot_warm_cold_data: {
                type: Map,
                of: [Number],
                required: true
            },
            total_combinations: { type: Number, required: true },
            hit_analysis: {
                target_winning_reds: [Number],
                target_winning_blues: [Number],
                red_hit_data: {
                    type: Map,
                    of: [Number]
                },
                hit_statistics: {
                    hit_0: { type: Number, default: 0 },
                    hit_1: { type: Number, default: 0 },
                    hit_2: { type: Number, default: 0 },
                    hit_3: { type: Number, default: 0 },
                    hit_4: { type: Number, default: 0 },
                    hit_5: { type: Number, default: 0 }
                },
                is_drawn: { type: Boolean, default: false }
            },
            is_predicted: { type: Boolean, default: false },
            statistics: {
                ratio_counts: {
                    type: Map,
                    of: Number
                }
            },
            created_at: { type: Date, default: Date.now }
        });

        dltRedCombinationsHotWarmColdOptimizedSchema.index({ base_issue: 1 });
        dltRedCombinationsHotWarmColdOptimizedSchema.index({ target_issue: 1 });
        dltRedCombinationsHotWarmColdOptimizedSchema.index({ base_issue: 1, target_issue: 1 }, { unique: true });

        const DLTRedCombinationsHotWarmColdOptimized = mongoose.model(
            'HIT_DLT_RedCombinationsHotWarmColdOptimized',
            dltRedCombinationsHotWarmColdOptimizedSchema
        );

        const hit_dlts = mongoose.connection.db.collection('hit_dlts');

        const DLTRedCombinationsSchema = new mongoose.Schema({
            combination_id: { type: String, required: true, unique: true },
            red_ball_1: { type: Number, required: true },
            red_ball_2: { type: Number, required: true },
            red_ball_3: { type: Number, required: true },
            red_ball_4: { type: Number, required: true },
            red_ball_5: { type: Number, required: true }
        });

        const DLTRedCombinations = mongoose.model('HIT_DLT_RedCombinations', DLTRedCombinationsSchema);

        // 获取所有已开奖期号
        const allIssues = await hit_dlts.find({}).sort({ ID: 1 }).toArray();
        console.log(`📊 找到 ${allIssues.length} 期已开奖数据`);

        // 检查已处理的热温冷比记录
        const allOptimizedRecords = await DLTRedCombinationsHotWarmColdOptimized
            .find({})
            .select('target_issue hit_analysis.is_drawn')
            .lean();

        console.log('\n🔍 优化表详细信息:');
        console.log(`- 总记录数: ${allOptimizedRecords.length}`);

        const drawnRecords = allOptimizedRecords.filter(r => r.hit_analysis?.is_drawn);
        const undrawnRecords = allOptimizedRecords.filter(r => !r.hit_analysis?.is_drawn);

        console.log(`  - 已开奖记录: ${drawnRecords.length}`);
        console.log(`  - 未开奖记录: ${undrawnRecords.length}`);

        console.log('\n已开奖记录详情:');
        drawnRecords.slice(0, 10).forEach(record => {
            console.log(`  - 期号: ${record.target_issue}`);
        });

        console.log('\n未开奖记录详情:');
        undrawnRecords.slice(0, 10).forEach(record => {
            console.log(`  - 期号: ${record.target_issue}`);
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

debugHWCTableGeneration();