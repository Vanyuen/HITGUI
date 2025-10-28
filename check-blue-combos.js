/**
 * 检查蓝球组合数据
 */
const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://127.0.0.1:27017';
const DB_NAME = 'lottery';
const COLLECTION_NAME = 'HIT_DLT_BlueCombinations';

async function main() {
    const client = new MongoClient(MONGO_URI);

    try {
        await client.connect();
        const db = client.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);

        console.log('📊 检查蓝球组合数据...\n');

        // 总记录数
        const total = await collection.countDocuments();
        console.log(`总记录数: ${total}`);

        // 前10条记录
        console.log('\n前10条记录:');
        const docs = await collection.find({}).limit(10).toArray();
        docs.forEach(doc => {
            console.log(`  ID=${doc.combination_id}, 类型=${typeof doc.combination_id}, 蓝球=[${doc.blue_ball_1}, ${doc.blue_ball_2}]`);
        });

        // 测试查询 ID=1
        console.log('\n测试查询 combination_id=1:');
        const test1 = await collection.findOne({ combination_id: 1 });
        console.log(`  结果: ${test1 ? '找到' : '未找到'}`);
        if (test1) {
            console.log(`  ID=${test1.combination_id}, 类型=${typeof test1.combination_id}, 蓝球=[${test1.blue_ball_1}, ${test1.blue_ball_2}]`);
        }

        // 测试查询 ID in [1,2,3,4,5]
        console.log('\n测试查询 combination_id in [1,2,3,4,5]:');
        const test2 = await collection.find({ combination_id: { $in: [1, 2, 3, 4, 5] } }).toArray();
        console.log(`  查询到 ${test2.length} 条`);
        test2.forEach(doc => {
            console.log(`  ID=${doc.combination_id}, 蓝球=[${doc.blue_ball_1}, ${doc.blue_ball_2}]`);
        });

        // 检查是否有重复的 combination_id=1
        console.log('\n检查 combination_id=1 的所有记录:');
        const dup1 = await collection.find({ combination_id: 1 }).toArray();
        console.log(`  找到 ${dup1.length} 条记录`);

        // 检查所有不同的 combination_id
        console.log('\n检查所有 combination_id:');
        const allIds = await collection.distinct('combination_id');
        console.log(`  不同的ID数量: ${allIds.length}`);
        console.log(`  ID范围: ${Math.min(...allIds)} - ${Math.max(...allIds)}`);
        console.log(`  前10个ID: ${allIds.slice(0, 10).join(', ')}`);

    } catch (error) {
        console.error('❌ 错误:', error);
    } finally {
        await client.close();
    }
}

main();
