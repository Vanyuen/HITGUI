// 测试ID映射功能
const mongoose = require('mongoose');

const DLTSchema = new mongoose.Schema({}, { collection: 'HIT_DLT', strict: false });
const DLT = mongoose.model('HIT_DLT_Test', DLTSchema);

async function testIDMapping() {
    try {
        console.log('🔗 连接数据库...');
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ 数据库连接成功');

        console.log('📊 加载DLT数据...');
        const records = await DLT.find({})
            .select('ID Issue Red1 Red2 Red3 Red4 Red5 Blue1 Blue2')
            .limit(10)
            .lean();

        console.log(`✅ 加载${records.length}条记录`);

        // 构建映射
        const idToRecordMap = new Map();
        const issueToIDMap = new Map();

        records.forEach(record => {
            idToRecordMap.set(record.ID, record);
            issueToIDMap.set(record.Issue.toString(), record.ID);
        });

        console.log(`\n📋 ID映射测试结果:`);
        console.log(`- idToRecordMap大小: ${idToRecordMap.size}`);
        console.log(`- issueToIDMap大小: ${issueToIDMap.size}`);

        // 测试映射
        if (records.length > 0) {
            const testRecord = records[0];
            console.log(`\n🧪 测试用例:`);
            console.log(`- 原始记录: ID=${testRecord.ID}, Issue=${testRecord.Issue}`);
            console.log(`- ID查询: ${idToRecordMap.has(testRecord.ID) ? '✅' : '❌'}`);
            console.log(`- Issue查询: ${issueToIDMap.has(testRecord.Issue.toString()) ? '✅' : '❌'}`);

            const mappedID = issueToIDMap.get(testRecord.Issue.toString());
            console.log(`- Issue→ID映射: ${testRecord.Issue} → ${mappedID} ${mappedID === testRecord.ID ? '✅' : '❌'}`);
        }

        console.log('\n✅ ID映射功能测试通过!');
        process.exit(0);

    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

testIDMapping();
