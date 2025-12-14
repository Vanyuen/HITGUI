const mongoose = require('mongoose');

async function test() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const hwcCol = mongoose.connection.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

    // 生成100个期号对
    const issuePairs = [];
    for (let i = 25042; i <= 25141; i++) {
        issuePairs.push({
            base_issue: (i - 1).toString(),
            target_issue: i.toString()
        });
    }

    console.log('期号对数:', issuePairs.length);

    // 测试$or查询的实际返回
    const query = {
        $or: issuePairs.map(p => ({
            base_issue: p.base_issue,
            target_issue: p.target_issue
        }))
    };

    console.log('\n执行$or查询（100个条件）...');
    const startTime = Date.now();
    const results = await hwcCol.find(query).toArray();
    const endTime = Date.now();

    console.log('查询耗时:', endTime - startTime, 'ms');
    console.log('返回记录数:', results.length);

    // 检查哪些期号对被返回了
    const returnedPairs = new Set(results.map(r => r.target_issue));

    const missing = issuePairs.filter(p => !returnedPairs.has(p.target_issue));
    console.log('\n缺失的期号对数:', missing.length);

    if (missing.length > 0) {
        console.log('缺失target_issue:', missing.slice(0, 20).map(p => p.target_issue).join(', '), missing.length > 20 ? '...' : '');
    }

    // 验证：单独查询第一个期号对
    console.log('\n=== 单独验证查询 ===');
    const testPairs = [
        { base: '25041', target: '25042' },
        { base: '25096', target: '25097' },
        { base: '25140', target: '25141' }
    ];

    for (const p of testPairs) {
        const single = await hwcCol.findOne({
            base_issue: p.base,
            target_issue: p.target
        });
        console.log(`${p.base}->${p.target}: ${single ? '✅ 存在' : '❌ 不存在'}`);
    }

    await mongoose.disconnect();
}

test().catch(console.error);
