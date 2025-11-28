const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

// 定义模式，移除复杂的Map类型
const dltRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({
    base_issue: {
        type: String,
        required: true,
        index: true
    },
    target_issue: {
        type: String,
        required: true,
        index: true
    },
    is_predicted: {
        type: Boolean,
        default: false
    },
    hit_analysis: {
        target_winning_reds: [Number],
        target_winning_blues: [Number],
        is_drawn: { type: Boolean, default: false }
    }
}, { collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds' });

async function rebuildHWCTable() {
    try {
        // 启用严格查询模式
        mongoose.set('strictQuery', false);

        await mongoose.connect(MONGODB_URI, {
            maxPoolSize: 10,
            socketTimeoutMS: 60000,
            connectTimeoutMS: 60000
        });
        console.log('✅ 已连接到数据库\n');

        // 注册模型
        const DLTRedCombinationsHotWarmColdOptimized = mongoose.model(
            'DLTRedCombinationsHotWarmColdOptimized',
            dltRedCombinationsHotWarmColdOptimizedSchema
        );

        const Hit_dlts = mongoose.connection.db.collection('hit_dlts');

        // 1. 获取所有已开奖期号
        const allIssues = await Hit_dlts.find({}).sort({ ID: 1 }).toArray();
        const latestIssue = allIssues[allIssues.length - 1];
        const nextIssue = parseInt(latestIssue.Issue) + 1;

        console.log('🔍 数据库信息:');
        console.log(`   - 总开奖期数: ${allIssues.length}`);
        console.log(`   - 最新期号: ${latestIssue.Issue}`);
        console.log(`   - 下一期预测期号: ${nextIssue}\n`);

        // 2. 清空现有表
        await DLTRedCombinationsHotWarmColdOptimized.deleteMany({});
        console.log('🗑️ 已删除现有记录\n');

        // 3. 准备批量插入
        const bulkOps = [];

        // 插入所有已开奖期
        for (const issue of allIssues) {
            bulkOps.push({
                base_issue: issue.Issue.toString(),
                target_issue: issue.Issue.toString(),
                is_predicted: false,
                hit_analysis: {
                    target_winning_reds: [
                        issue.Red1, issue.Red2, issue.Red3,
                        issue.Red4, issue.Red5
                    ],
                    target_winning_blues: [issue.Blue1, issue.Blue2],
                    is_drawn: true
                }
            });
        }

        // 插入下一期预测期
        bulkOps.push({
            base_issue: latestIssue.Issue.toString(),
            target_issue: nextIssue.toString(),
            is_predicted: true,
            hit_analysis: {
                target_winning_reds: [],
                target_winning_blues: [],
                is_drawn: false
            }
        });

        // 执行批量插入
        const insertResult = await DLTRedCombinationsHotWarmColdOptimized.insertMany(bulkOps);

        console.log('🎉 重建结果:');
        console.log(`   - 总处理记录数: ${insertResult.length}`);

        // 验证
        const finalCount = await DLTRedCombinationsHotWarmColdOptimized.countDocuments();
        console.log(`\n📊 最终记录数: ${finalCount}`);

        // 检查最后几条记录
        const lastRecords = await DLTRedCombinationsHotWarmColdOptimized
            .find({})
            .sort({ target_issue: -1 })
            .limit(10)
            .select('base_issue target_issue is_predicted hit_analysis.is_drawn');

        console.log('\n🕵️ 最后10条记录:');
        lastRecords.forEach((record, index) => {
            console.log(`记录 ${index + 1}:`);
            console.log(`  基准期: ${record.base_issue}`);
            console.log(`  目标期: ${record.target_issue}`);
            console.log(`  是否为预测期: ${record.is_predicted}`);
            console.log(`  是否已开奖: ${record.hit_analysis.is_drawn}`);
        });

        // 验证记录的正确性
        const validationIssues = lastRecords.map(r => r.target_issue);
        console.log('\n🔍 目标期号验证:');
        console.log(`   验证期号: ${validationIssues.join(', ')}`);
        console.log(`   是否包含最新期号 ${latestIssue.Issue}: ${validationIssues.includes(latestIssue.Issue.toString())}`);
        console.log(`   是否包含下一期预测期号 ${nextIssue}: ${validationIssues.includes(nextIssue.toString())}`);

        // 记录日志
        const logContent = JSON.stringify({
            timestamp: new Date().toISOString(),
            totalIssues: allIssues.length,
            latestIssue: latestIssue.Issue,
            nextIssue: nextIssue,
            insertedCount: insertResult.length
        }, null, 2);

        const logPath = path.join(__dirname, 'hwc_table_mongoose_rebuild_log.json');
        fs.writeFileSync(logPath, logContent);
        console.log(`\n📝 已将重建日志保存到: ${logPath}`);

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

rebuildHWCTable();