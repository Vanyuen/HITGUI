#!/usr/bin/env node

const mongoose = require('mongoose');

async function testDirectQuery() {
    console.log('\n🔍 直接测试数据库查询\n');

    await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const db = mongoose.connection.db;

    console.log('='.repeat(70));
    console.log('测试1: 直接使用 db.collection() 查询');
    console.log('='.repeat(70));

    const coll = db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');
    const count = await coll.countDocuments();
    console.log(`记录数: ${count}`);

    const sample = await coll.findOne({ target_issue: '25124' });
    console.log(`期号25124存在: ${sample ? '是' : '否'}`);
    if (sample) {
        console.log(`  - 有 hot_warm_cold_data: ${sample.hot_warm_cold_data ? '是' : '否'}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('测试2: 使用 Mongoose Model 查询');
    console.log('='.repeat(70));

    // 定义schema (与server.js一致)
    const hwcSchema = new mongoose.Schema({
        base_issue: String,
        target_issue: String,
        hot_warm_cold_data: mongoose.Schema.Types.Mixed
    }, {
        collection: 'hit_dlt_redcombinationshotwarmcoldoptimizeds'
    });

    const HwcModel = mongoose.model('TestHwcModel', hwcSchema);

    const modelCount = await HwcModel.countDocuments();
    console.log(`记录数: ${modelCount}`);

    const modelSample = await HwcModel.findOne({ target_issue: '25124' });
    console.log(`期号25124存在: ${modelSample ? '是' : '否'}`);
    if (modelSample) {
        console.log(`  - 有 hot_warm_cold_data: ${modelSample.hot_warm_cold_data ? '是' : '否'}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('测试3: 模拟API查询逻辑');
    console.log('='.repeat(70));

    const testQuery = { base_issue: '25123', target_issue: '25124' };
    console.log(`查询条件:`, testQuery);

    const result = await HwcModel.findOne(testQuery).lean();
    console.log(`查询结果: ${result ? '找到' : '未找到'}`);
    if (result) {
        console.log(`  - base_issue: ${result.base_issue}`);
        console.log(`  - target_issue: ${result.target_issue}`);
        console.log(`  - 有 hot_warm_cold_data: ${result.hot_warm_cold_data ? '是' : '否'}`);
    }

    await mongoose.disconnect();
}

testDirectQuery().catch(console.error);
