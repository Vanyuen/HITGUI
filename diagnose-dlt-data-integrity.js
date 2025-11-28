const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function diagnoseAndFixDLTData() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    console.log('🕵️ 大乐透数据诊断与修复脚本\n');

    try {
        // 1. 检查所有可能的hit_dlts相关集合
        const dltCollections = [
            'hit_dlts',
            'hit_dlts',
            'hit_dlts',
            'hit_dlts'
        ];

        let totalRecords = 0;
        const collectionsWithData = [];

        for (const collName of dltCollections) {
            const count = await db.collection(collName).countDocuments();
            console.log(`📊 ${collName} 集合记录数: ${count}`);

            if (count > 0) {
                totalRecords += count;
                collectionsWithData.push(collName);
            }
        }

        if (totalRecords === 0) {
            console.log('\n❌ 警告：所有hit_dlts相关集合均没有数据！');
            console.log('可能原因：');
            console.log('1. 数据库未初始化');
            console.log('2. 数据迁移失败');
            console.log('3. 数据误删');
        }

        // 2. 检查任务和结果集合
        const taskCollections = [
            'hit_dlt_hwcpositivepredictiontasks',
            'hit_dlt_hwcpositivepredictiontaskresults',
            'HIT_DLT_HwcPositivePredictionTask',
            'HIT_DLT_HwcPositivePredictionTaskResult'
        ];

        for (const collName of taskCollections) {
            const taskCount = await db.collection(collName).countDocuments();
            console.log(`📝 ${collName} 集合任务数: ${taskCount}`);
        }

        // 3. 检查最新任务详情
        const task = await db.collection('hit_dlt_hwcpositivepredictiontasks')
            .findOne({}, { sort: { created_at: -1 } });

        if (task) {
            console.log('\n🔍 最新任务配置:');
            console.log('  任务ID:', task.task_id);
            console.log('  期号范围配置:');
            console.log('    类型:', task.period_range.type);
            console.log('    起始期号:', task.period_range.start);
            console.log('    结束期号:', task.period_range.end);
            console.log('    总期数:', task.period_range.total);
        }

        // 4. 检查任务结果
        const results = await db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .find({ task_id: task.task_id })
            .sort({ period: 1 })
            .toArray();

        console.log('\n📊 任务结果详情:');
        console.log('期号\t组合数\t\tis_predicted');
        console.log('─'.repeat(50));

        results.forEach(result => {
            console.log(
                `${result.period}\t` +
                `${result.paired_combinations?.length || 0}\t\t` +
                `${result.is_predicted}`
            );
        });

        // 5. 建议修复方案
        console.log('\n🛠️ 修复建议:');
        if (totalRecords === 0) {
            console.log('1. 检查数据导入脚本是否正确执行');
            console.log('2. 确认数据源文件完整性');
            console.log('3. 重新运行数据初始化脚本');
        }

        if (results.some(r => r.paired_combinations?.length === 0)) {
            console.log('4. 修复 resolveIssueRangeInternal 处理空数据集的逻辑');
            console.log('5. 确保任务结果只生成有效期号');
        }

    } catch (error) {
        console.error('❌ 诊断过程中发生错误:', error);
    } finally {
        await mongoose.connection.close();
    }
}

diagnoseAndFixDLTData().catch(console.error);