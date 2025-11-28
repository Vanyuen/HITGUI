/**
 * 检查热温冷优化表的实际覆盖率和数据结构
 */

const mongoose = require('mongoose');

// 定义Schema
const HwcOptimizedSchema = new mongoose.Schema({
    base_issue: String,
    target_issue: String,
    hot_warm_cold_data: Object,
    created_at: Date
}, { collection: 'HIT_DLT_RedCombinationsHotWarmColdOptimized' });

const HwcOptimized = mongoose.model('HwcOptimized', HwcOptimizedSchema);

const DLTSchema = new mongoose.Schema({
    Issue: String,
    ID: Number
}, { collection: 'hit_dlts' });

const hit_dlts = mongoose.model('DLT_Check', DLTSchema);

async function checkCoverage() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功\n');

        // 1. 检查优化表总记录数
        const totalRecords = await HwcOptimized.countDocuments({});
        console.log(`📊 热温冷优化表记录总数: ${totalRecords}`);

        // 2. 检查一条数据的结构
        const sampleRecord = await HwcOptimized.findOne({}).lean();
        if (sampleRecord) {
            console.log('\n📄 数据结构示例:');
            console.log(`  - base_issue: ${sampleRecord.base_issue}`);
            console.log(`  - target_issue: ${sampleRecord.target_issue}`);
            console.log(`  - hot_warm_cold_data 键数量: ${sampleRecord.hot_warm_cold_data ? Object.keys(sampleRecord.hot_warm_cold_data).length : 0}`);

            if (sampleRecord.hot_warm_cold_data) {
                const firstKey = Object.keys(sampleRecord.hot_warm_cold_data)[0];
                const firstValue = sampleRecord.hot_warm_cold_data[firstKey];
                console.log(`  - 示例热温冷比: ${firstKey}, 组合数: ${Array.isArray(firstValue) ? firstValue.length : 0}`);
            }
        }

        // 3. 检查覆盖的期号范围
        const distinctBase = await HwcOptimized.distinct('base_issue');
        const distinctTarget = await HwcOptimized.distinct('target_issue');

        console.log(`\n📅 覆盖的期号范围:`);
        console.log(`  - 基准期号数量: ${distinctBase.length}`);
        console.log(`  - 目标期号数量: ${distinctTarget.length}`);
        console.log(`  - 基准期号范围: ${distinctBase[0]} - ${distinctBase[distinctBase.length - 1]}`);
        console.log(`  - 目标期号范围: ${distinctTarget[0]} - ${distinctTarget[distinctTarget.length - 1]}`);

        // 4. 获取最新的10期数据
        const latestIssues = await hit_dlts.find({})
            .sort({ ID: -1 })
            .limit(10)
            .select('Issue ID')
            .lean();

        console.log(`\n📊 最新的10期数据:`);
        latestIssues.reverse().forEach(issue => {
            console.log(`  - 期号: ${issue.Issue}, ID: ${issue.ID}`);
        });

        // 5. 检查最新期号对是否有优化数据
        if (latestIssues.length >= 2) {
            console.log(`\n🔍 检查最近期号对的优化表覆盖:`);
            for (let i = 1; i < Math.min(5, latestIssues.length); i++) {
                const base = latestIssues[i - 1].Issue;
                const target = latestIssues[i].Issue;

                const exists = await HwcOptimized.findOne({
                    base_issue: base,
                    target_issue: target
                });

                console.log(`  - ${base} → ${target}: ${exists ? '✅ 有数据' : '❌ 无数据'}`);
            }
        }

        // 6. 统计期号对数量
        const pairCount = await HwcOptimized.aggregate([
            {
                $group: {
                    _id: { base: '$base_issue', target: '$target_issue' },
                    count: { $sum: 1 }
                }
            },
            { $count: 'total_pairs' }
        ]);

        console.log(`\n📈 统计信息:`);
        console.log(`  - 唯一期号对数量: ${pairCount.length > 0 ? pairCount[0].total_pairs : 0}`);

        // 7. 检查是否有重复数据
        const duplicates = await HwcOptimized.aggregate([
            {
                $group: {
                    _id: { base: '$base_issue', target: '$target_issue' },
                    count: { $sum: 1 }
                }
            },
            { $match: { count: { $gt: 1 } } }
        ]);

        if (duplicates.length > 0) {
            console.log(`\n⚠️ 发现重复数据: ${duplicates.length} 个期号对有多条记录`);
        } else {
            console.log(`\n✅ 无重复数据`);
        }

        mongoose.connection.close();

    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

checkCoverage();
