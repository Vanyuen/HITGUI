const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function investigateHitDltsOrigin() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    console.log('🕵️ hit_dlts 集合来源深度调查\n');

    // 1. 集合基本信息
    const totalCount = await db.collection('hit_dlts').countDocuments();
    console.log(`📊 hit_dlts 集合总记录数: ${totalCount}`);

    // 2. 检查记录的时间跨度
    const timeSpan = await db.collection('hit_dlts').aggregate([
        { $group: {
            _id: null,
            earliestDate: { $min: "$DrawDate" },
            latestDate: { $max: "$DrawDate" }
        }}
    ]).toArray();

    console.log('\n⏰ 数据时间跨度:');
    console.log(`  起始日期: ${timeSpan[0].earliestDate}`);
    console.log(`  结束日期: ${timeSpan[0].latestDate}`);

    // 3. 检查期号范围
    const issueSpan = await db.collection('hit_dlts').aggregate([
        { $group: {
            _id: null,
            minIssue: { $min: "$Issue" },
            maxIssue: { $max: "$Issue" }
        }}
    ]).toArray();

    console.log('\n🎲 期号范围:');
    console.log(`  最小期号: ${issueSpan[0].minIssue}`);
    console.log(`  最大期号: ${issueSpan[0].maxIssue}`);

    // 4. 查找可能的导入脚本
    const scriptSearchPaths = [
        'E:\\HITGUI',
        'E:\\HITGUI\\src',
        'E:\\HITGUI\\scripts'
    ];

    console.log('\n🔍 搜索可能的导入脚本:');
    const importScripts = [];

    scriptSearchPaths.forEach(searchPath => {
        try {
            const files = fs.readdirSync(searchPath);
            const matchingScripts = files.filter(file =>
                (file.includes('import') || file.includes('migrate')) &&
                (file.includes('dlt') || file.includes('lottery')) &&
                file.endsWith('.js')
            );

            matchingScripts.forEach(script => {
                const fullPath = path.join(searchPath, script);
                importScripts.push(fullPath);
                console.log(`  ✅ 可疑脚本: ${fullPath}`);
            });
        } catch (error) {
            console.log(`  ❌ 搜索 ${searchPath} 失败: ${error.message}`);
        }
    });

    // 5. 检查集合结构
    const sampleDoc = await db.collection('hit_dlts').findOne();
    console.log('\n📋 集合字段结构:');
    console.log(Object.keys(sampleDoc).join(', '));

    // 6. 检查文档的统计特征
    const stats = await db.collection('hit_dlts').aggregate([
        { $group: {
            _id: null,
            avgRedSum: { $avg: { $add: ["$Red1", "$Red2", "$Red3", "$Red4", "$Red5"] } },
            avgBlueSum: { $avg: { $add: ["$Blue1", "$Blue2"] } },
            redSumMin: { $min: { $add: ["$Red1", "$Red2", "$Red3", "$Red4", "$Red5"] } },
            redSumMax: { $max: { $add: ["$Red1", "$Red2", "$Red3", "$Red4", "$Red5"] } }
        }}
    ]).toArray();

    console.log('\n📊 文档统计特征:');
    console.log(`  平均红球和: ${stats[0].avgRedSum.toFixed(2)}`);
    console.log(`  平均蓝球和: ${stats[0].avgBlueSum.toFixed(2)}`);
    console.log(`  红球和范围: ${stats[0].redSumMin} - ${stats[0].redSumMax}`);

    // 7. 检查索引
    const indexes = await db.collection('hit_dlts').indexes();
    console.log('\n🔬 集合索引:');
    indexes.forEach(index => {
        console.log(`  ${JSON.stringify(index.key)}`);
    });

    // 8. 检查项目中是否有相关的数据处理文档
    const docSearchPaths = [
        'E:\\HITGUI',
        'E:\\HITGUI\\docs'
    ];

    console.log('\n📄 搜索相关文档:');
    docSearchPaths.forEach(searchPath => {
        try {
            const files = fs.readdirSync(searchPath);
            const matchingDocs = files.filter(file =>
                (file.includes('dlt') || file.includes('lottery')) &&
                (file.includes('data') || file.includes('migrate') || file.includes('import')) &&
                (file.endsWith('.md') || file.endsWith('.txt'))
            );

            matchingDocs.forEach(doc => {
                const fullPath = path.join(searchPath, doc);
                console.log(`  📋 可疑文档: ${fullPath}`);
            });
        } catch (error) {
            console.log(`  ❌ 搜索 ${searchPath} 失败: ${error.message}`);
        }
    });

    await mongoose.connection.close();
}

investigateHitDltsOrigin().catch(console.error);