const mongoose = require('mongoose');

async function diagnoseCollections() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    console.log('🕵️ 大乐透相关集合诊断\n');

    const dltCollections = [
        'hit_dlts',
        'hit_dlts',
        'hit_dlts',
        'hit_dlts'
    ];

    const detailedReport = [];

    for (const collName of dltCollections) {
        try {
            const count = await db.collection(collName).countDocuments();
            const sample = await db.collection(collName).findOne();

            const report = {
                name: collName,
                recordCount: count,
                sampleDoc: sample ? Object.keys(sample) : null,
                sampleFirstDoc: sample ? JSON.stringify(sample, null, 2).substring(0, 500) : null
            };

            detailedReport.push(report);
        } catch (error) {
            console.error(`❌ 查询 ${collName} 失败:`, error.message);
        }
    }

    console.log('📊 集合诊断报告:\n');
    detailedReport.forEach(report => {
        console.log(`集合名称: ${report.name}`);
        console.log(`记录数: ${report.recordCount}`);

        if (report.sampleDoc) {
            console.log('文档字段:');
            console.log(report.sampleDoc.join(', '));
            console.log('\n首个文档样本:');
            console.log(report.sampleFirstDoc);
        } else {
            console.log('❌ 无可用文档样本');
        }
        console.log('\n' + '─'.repeat(50) + '\n');
    });

    // 检查代码中引用的集合
    console.log('🔍 代码引用分析:');
    const serverJsPath = require('path').join(__dirname, 'src', 'server', 'server.js');
    const fs = require('fs');

    try {
        const serverJs = fs.readFileSync(serverJsPath, 'utf-8');
        const collectionMatches = serverJs.match(/collection\(['"]([^'"]+)['"]\)/g);

        if (collectionMatches) {
            console.log('代码中引用的集合名称:');
            const uniqueCollections = [...new Set(collectionMatches.map(m =>
                m.match(/collection\(['"]([^'"]+)['"]\)/)[1]
            ))];
            console.log(uniqueCollections.join(', '));
        }
    } catch (error) {
        console.error('❌ 读取server.js失败:', error);
    }

    await mongoose.connection.close();
}

diagnoseCollections().catch(console.error);