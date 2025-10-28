/**
 * 简化版蓝球组合初始化脚本
 * 使用MongoDB原生驱动，不依赖Mongoose
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';
const COLLECTION_NAME = 'HIT_DLT_BlueCombinations';

async function main() {
    const client = new MongoClient(MONGO_URI);

    try {
        console.log('🔗 连接MongoDB...');
        await client.connect();
        console.log('✅ 连接成功');

        const db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);

        // 检查现有数据
        const existingCount = await collection.countDocuments();
        console.log(`📊 当前记录数: ${existingCount}`);

        if (existingCount > 0) {
            console.log('⚠️  集合已有数据，跳过初始化');
            const samples = await collection.find({}).limit(5).toArray();
            console.log('现有数据样本:');
            samples.forEach(s => console.log(`  ID=${s.combination_id}, 蓝球=[${s.blue_ball_1}, ${s.blue_ball_2}]`));
            return;
        }

        // 生成组合
        console.log('\n🔧 生成蓝球组合...');
        const combinations = [];
        let combinationId = 1;

        for (let i = 1; i <= 12; i++) {
            for (let j = i + 1; j <= 12; j++) {
                combinations.push({
                    combination_id: combinationId,
                    blue_ball_1: i,
                    blue_ball_2: j,
                    sum_value: i + j,
                    created_at: new Date()
                });
                combinationId++;
            }
        }

        console.log(`📊 生成组合数: ${combinations.length}个`);
        console.log('前5个组合:');
        combinations.slice(0, 5).forEach(c =>
            console.log(`  ID=${c.combination_id}, 蓝球=[${c.blue_ball_1}, ${c.blue_ball_2}], 和值=${c.sum_value}`)
        );

        // 插入数据
        console.log('\n💾 插入数据库...');
        const result = await collection.insertMany(combinations);
        console.log(`✅ 插入成功: ${result.insertedCount}条`);

        // 验证
        const finalCount = await collection.countDocuments();
        console.log(`📊 最终记录数: ${finalCount}`);

        // 测试查询
        console.log('\n🧪 测试查询 ID 1-5:');
        const testDocs = await collection.find({ combination_id: { $in: [1, 2, 3, 4, 5] } }).toArray();
        testDocs.forEach(doc =>
            console.log(`  ID=${doc.combination_id}, 蓝球=[${doc.blue_ball_1}, ${doc.blue_ball_2}]`)
        );

        console.log('\n✅ 初始化完成！');

    } catch (error) {
        console.error('❌ 错误:', error);
    } finally {
        await client.close();
        console.log('📦 连接已关闭');
    }
}

main();
