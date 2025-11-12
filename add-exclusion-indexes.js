/**
 * 为排除详情表添加性能优化索引
 *
 * 索引目的:
 * 1. 加速组合排除路径查询（通过task_id + period + excluded_combination_ids查询）
 * 2. 加速步骤统计查询（通过task_id + period + step查询）
 *
 * 运行方式: node add-exclusion-indexes.js
 */

const mongoose = require('mongoose');

const DB_URL = 'mongodb://127.0.0.1:27017/lottery';

async function addIndexes() {
    try {
        console.log('\n📡 连接数据库...');
        await mongoose.connect(DB_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        const db = mongoose.connection.db;
        const collection = db.collection('hit_dlt_exclusiondetails');

        console.log('📊 开始创建索引...\n');

        // 索引1: 任务+期号+步骤（用于步骤统计查询）
        console.log('  创建索引1: { task_id: 1, period: 1, step: 1 }');
        try {
            await collection.createIndex(
                { task_id: 1, period: 1, step: 1 },
                { name: 'idx_task_period_step' }
            );
            console.log('  ✅ 索引1创建成功');
        } catch (err) {
            if (err.message.includes('already exists')) {
                console.log('  ⚠️ 索引1已存在，跳过');
            } else {
                throw err;
            }
        }

        // 索引2: 任务+期号+排除ID（用于组合排除路径查询）
        console.log('\n  创建索引2: { task_id: 1, period: 1, excluded_combination_ids: 1 }');
        try {
            await collection.createIndex(
                { task_id: 1, period: 1, excluded_combination_ids: 1 },
                { name: 'idx_task_period_excluded_ids' }
            );
            console.log('  ✅ 索引2创建成功');
        } catch (err) {
            if (err.message.includes('already exists')) {
                console.log('  ⚠️ 索引2已存在，跳过');
            } else {
                throw err;
            }
        }

        // 索引3: 任务ID（用于任务相关的所有查询）
        console.log('\n  创建索引3: { task_id: 1 }');
        try {
            await collection.createIndex(
                { task_id: 1 },
                { name: 'idx_task_id' }
            );
            console.log('  ✅ 索引3创建成功');
        } catch (err) {
            if (err.message.includes('already exists')) {
                console.log('  ⚠️ 索引3已存在，跳过');
            } else {
                throw err;
            }
        }

        // 显示所有索引
        console.log('\n📋 当前所有索引:');
        const indexes = await collection.indexes();
        indexes.forEach(idx => {
            console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
        });

        console.log('\n✅ 索引创建完成！\n');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 数据库连接已关闭\n');
    }
}

addIndexes();
