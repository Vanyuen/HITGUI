const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function investigateHWCTableGeneration() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ 已连接到数据库\n');

        // 定义模式
        const dltRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({
            base_issue: { type: String, required: true },
            target_issue: { type: String, required: true },
            hot_warm_cold_data: {
                type: Map,
                of: [Number], // 每个比例对应的combination_id数组
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
            is_predicted: { type: Boolean, default: false }, // 新增字段标记是否为推算期
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

        // 检查红球组合总数
        const totalCombinations = await DLTRedCombinations.countDocuments();
        console.log(`📊 红球组合数量: ${totalCombinations}`);

        // 检查已处理的热温冷比记录
        const allOptimizedRecords = await DLTRedCombinationsHotWarmColdOptimized
            .find({ 'hit_analysis.is_drawn': true })
            .select('target_issue')
            .lean();

        const latestProcessedIssue = allOptimizedRecords.length > 0 ?
            Math.max(...allOptimizedRecords.map(r => parseInt(r.target_issue))) : 0;

        // 获取最新期号
        const latestIssueInDb = parseInt(allIssues[allIssues.length - 1].Issue);

        console.log('\n🔍 调查细节:');
        console.log(`- 优化表记录数: ${allOptimizedRecords.length}`);
        console.log(`- 最新已开奖期: ${latestIssueInDb}`);
        console.log(`- 优化表最新已处理期: ${latestProcessedIssue}`);

        // 确定需要处理的期号
        let issuesToProcess = [];
        if (latestProcessedIssue === 0) {
            console.log('⚠️  优化表为空，将处理所有已开奖期');
            issuesToProcess = allIssues.slice(1);
        } else if (latestIssueInDb > latestProcessedIssue) {
            issuesToProcess = allIssues.filter(issue => parseInt(issue.Issue) > latestProcessedIssue);
            console.log(`✅ 发现 ${issuesToProcess.length} 期新开奖数据需要处理`);
        } else {
            console.log('✅ 已开奖期数据已是最新，跳过已开奖期处理');
        }

        // 详细列出需要处理的期号
        if (issuesToProcess.length > 0) {
            console.log('\n需要处理的期号:');
            issuesToProcess.forEach(issue =>
                console.log(`  - 期号: ${issue.Issue}, ID: ${issue.ID}`)
            );
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

investigateHWCTableGeneration();