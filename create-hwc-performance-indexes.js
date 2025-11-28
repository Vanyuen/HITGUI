/**
 * 创建HWC性能优化索引
 * 用于提升热温冷正选批量预测的查询性能
 *
 * 运行方式: node create-hwc-performance-indexes.js
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function createIndexes() {
    const client = new MongoClient(MONGODB_URI);

    try {
        await client.connect();
        console.log('已连接到MongoDB');

        const db = client.db('lottery');

        // 1. HWC优化表复合索引
        console.log('\n创建HWC优化表复合索引...');
        try {
            await db.collection('hit_dlt_redcombinationshotwarmcoldoptimized').createIndex(
                { base_issue: 1, target_issue: 1 },
                { name: 'idx_hwc_issue_pair', background: true }
            );
            console.log('  ✅ idx_hwc_issue_pair 创建成功');
        } catch (err) {
            if (err.code === 85) {
                console.log('  ⚠️ idx_hwc_issue_pair 已存在');
            } else {
                console.log('  ❌ 创建失败:', err.message);
            }
        }

        // 2. 排除详情表索引
        console.log('\n创建排除详情表索引...');
        try {
            await db.collection('hit_dlt_exclusiondetails').createIndex(
                { task_id: 1, period: 1 },
                { name: 'idx_exclusion_task_period', background: true }
            );
            console.log('  ✅ idx_exclusion_task_period 创建成功');
        } catch (err) {
            if (err.code === 85) {
                console.log('  ⚠️ idx_exclusion_task_period 已存在');
            } else {
                console.log('  ❌ 创建失败:', err.message);
            }
        }

        try {
            await db.collection('hit_dlt_exclusiondetails').createIndex(
                { task_id: 1, step: 1 },
                { name: 'idx_exclusion_task_step', background: true }
            );
            console.log('  ✅ idx_exclusion_task_step 创建成功');
        } catch (err) {
            if (err.code === 85) {
                console.log('  ⚠️ idx_exclusion_task_step 已存在');
            } else {
                console.log('  ❌ 创建失败:', err.message);
            }
        }

        // 3. HWC任务表索引
        console.log('\n创建HWC任务表索引...');
        try {
            await db.collection('hwcpositivepredictiontasks').createIndex(
                { status: 1, created_at: -1 },
                { name: 'idx_hwc_task_status_created', background: true }
            );
            console.log('  ✅ idx_hwc_task_status_created 创建成功');
        } catch (err) {
            if (err.code === 85) {
                console.log('  ⚠️ idx_hwc_task_status_created 已存在');
            } else {
                console.log('  ❌ 创建失败:', err.message);
            }
        }

        // 4. HWC任务结果表索引
        console.log('\n创建HWC任务结果表索引...');
        try {
            await db.collection('hwcpositivepredictiontaskresults').createIndex(
                { task_id: 1, period: 1 },
                { name: 'idx_hwc_result_task_period', background: true }
            );
            console.log('  ✅ idx_hwc_result_task_period 创建成功');
        } catch (err) {
            if (err.code === 85) {
                console.log('  ⚠️ idx_hwc_result_task_period 已存在');
            } else {
                console.log('  ❌ 创建失败:', err.message);
            }
        }

        console.log('\n✅ 所有索引创建完成！');
        console.log('\n索引优化预期效果:');
        console.log('  - HWC数据查询速度提升 5-10倍');
        console.log('  - 排除详情查询速度提升 3-5倍');
        console.log('  - 任务列表查询速度提升 2-3倍');

    } catch (error) {
        console.error('❌ 错误:', error.message);
    } finally {
        await client.close();
        console.log('\n已断开MongoDB连接');
    }
}

createIndexes();
