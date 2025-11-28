const mongoose = require('mongoose');
const fs = require('fs');

// 数据库连接配置
const dbConfig = {
    uri: 'mongodb://127.0.0.1:27017/lottery',
    options: {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }
};

async function investigateDatabaseSchema() {
    try {
        await mongoose.connect(dbConfig.uri, dbConfig.options);
        console.log('📡 成功连接到数据库');

        // 获取集合信息
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log('📊 可用集合:');
        collections.forEach(collection => {
            console.log(`   - ${collection.name}`);
        });

        // 检查 hit_dlts 集合的详细信息
        const hitDltsCollection = mongoose.connection.db.collection('hit_dlts');

        // 获取总记录数
        const totalRecords = await hitDltsCollection.countDocuments();
        console.log(`\n📈 hit_dlts 集合总记录数: ${totalRecords}`);

        // 抽样检查文档结构
        const sampleDocuments = await hitDltsCollection.find({}).limit(5).toArray();

        console.log('\n🔍 抽样文档结构:');
        sampleDocuments.forEach((doc, index) => {
            console.log(`\n文档 ${index + 1}:`);
            console.log(JSON.stringify(doc, null, 2));
        });

        // 获取所有字段名
        const allFields = sampleDocuments.length > 0
            ? Object.keys(sampleDocuments[0])
            : [];

        console.log('\n📋 所有字段:');
        allFields.forEach(field => {
            console.log(`   - ${field}`);
        });

        // 检查特定字段的类型和分布
        const missingFieldPatterns = [
            'Missing',
            'missing',
            '_missing',
            'Missed',
            'missed'
        ];

        const matchedFields = allFields.filter(field =>
            missingFieldPatterns.some(pattern => field.toLowerCase().includes(pattern))
        );

        console.log('\n🕵️ 可疑的遗漏字段:');
        matchedFields.forEach(field => {
            console.log(`   - ${field}`);
        });

        // 关闭数据库连接
        await mongoose.connection.close();

    } catch (error) {
        console.error('❌ 调查过程出错:', error);
    }
}

investigateDatabaseSchema();