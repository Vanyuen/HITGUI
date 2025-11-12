/**
 * 列出所有集合并检查热温冷任务数据
 */

const mongoose = require('mongoose');

const DB_URI = 'mongodb://127.0.0.1:27017/lottery';

async function check() {
    try {
        console.log('🔍 连接数据库...');
        await mongoose.connect(DB_URI);
        console.log('✅ 数据库连接成功\n');

        // 1. 列出所有集合
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('📋 数据库中的所有集合:');
        const hwcCollections = [];
        for (const coll of collections) {
            console.log(`  - ${coll.name}`);
            if (coll.name.toLowerCase().includes('hwc') || coll.name.toLowerCase().includes('positive')) {
                hwcCollections.push(coll.name);
            }
        }

        console.log(`\n🎯 发现 ${hwcCollections.length} 个相关集合:`);
        hwcCollections.forEach(name => console.log(`  - ${name}`));

        // 2. 查询每个相关集合
        for (const collName of hwcCollections) {
            console.log(`\n${'='.repeat(70)}`);
            console.log(`📊 集合: ${collName}`);

            const Model = mongoose.model(collName + '_temp', new mongoose.Schema({}, { strict: false, collection: collName }));
            const count = await Model.countDocuments();
            console.log(`   记录数: ${count}`);

            if (count > 0) {
                const sample = await Model.findOne({}).lean();
                console.log(`   示例记录字段: ${Object.keys(sample).join(', ')}`);

                // 如果包含task相关字段
                if (sample.task_id || sample.task_name) {
                    console.log(`\n   任务信息:`);
                    if (sample.task_name) console.log(`     task_name: ${sample.task_name}`);
                    if (sample.task_id) console.log(`     task_id: ${sample.task_id}`);
                    if (sample.status) console.log(`     status: ${sample.status}`);
                    if (sample.created_at) console.log(`     created_at: ${sample.created_at}`);
                }

                // 如果包含period相关字段
                if (sample.period) {
                    console.log(`\n   期号数据:`);
                    console.log(`     period: ${sample.period}`);
                    if (sample.combination_count !== undefined) {
                        console.log(`     combination_count: ${sample.combination_count}`);
                    }
                    if (sample.winning_numbers !== undefined) {
                        console.log(`     winning_numbers: ${JSON.stringify(sample.winning_numbers)}`);
                    }
                    if (sample.hit_analysis !== undefined) {
                        console.log(`     hit_analysis exists: ${sample.hit_analysis ? 'Yes' : 'No'}`);
                        if (sample.hit_analysis && sample.hit_analysis.prize_stats) {
                            const ps = sample.hit_analysis.prize_stats;
                            console.log(`     一等奖: ${ps.first_prize?.count || 0}`);
                            console.log(`     六等奖: ${ps.sixth_prize?.count || 0}`);
                        }
                    }
                }
            }
        }

    } catch (error) {
        console.error('❌ 检查失败:', error);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\n🔌 数据库连接已关闭');
    }
}

check();
