/**
 * 检查现有任务的创建时间
 */

const mongoose = require('mongoose');

async function checkTimestamps() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        const db = mongoose.connection.db;

        console.log('=== 检查现有任务创建时间 ===\n');

        const tasks = await db.collection('hit_dlt_hwcpositivepredictiontasks')
            .find({})
            .sort({ created_at: -1 })
            .limit(10)
            .toArray();

        console.log(`共找到 ${tasks.length} 个任务:\n`);

        for (const task of tasks) {
            console.log(`任务ID: ${task.task_id}`);
            console.log(`任务名称: ${task.task_name}`);
            console.log(`创建时间: ${task.created_at}`);
            console.log(`期号范围: ${task.period_range?.start} - ${task.period_range?.end}`);

            // 检查字段名
            if (task.positive_selection) {
                const hasOldField = task.positive_selection.hwc_ratios !== undefined;
                const hasNewField = task.positive_selection.red_hot_warm_cold_ratios !== undefined;

                console.log(`字段检查:`);
                console.log(`  - hwc_ratios (旧字段): ${hasOldField ? '✅ 存在' : '❌ 不存在'}`);
                console.log(`  - red_hot_warm_cold_ratios (新字段): ${hasNewField ? '✅ 存在' : '❌ 不存在'}`);

                if (hasNewField) {
                    console.log(`  - 热温冷比数量: ${task.positive_selection.red_hot_warm_cold_ratios.length}`);
                }
            }
            console.log('---');
        }

        // 获取修复时间点 (查看备份文件的修改时间)
        const fs = require('fs');
        const backupFile = 'E:\\HITGUI\\src\\server\\server.js.backup_ispredicted_fix_20251114';

        if (fs.existsSync(backupFile)) {
            const stats = fs.statSync(backupFile);
            console.log(`\n修复时间点 (备份文件创建时间): ${stats.mtime}\n`);
        }

        console.log('=== 检查完成 ===');
        mongoose.connection.close();

    } catch (error) {
        console.error('错误:', error.message);
        process.exit(1);
    }
}

checkTimestamps();
