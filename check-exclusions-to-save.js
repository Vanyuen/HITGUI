const mongoose = require('mongoose');

async function investigate() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    // 检查结果中exclusions_to_save字段的存储情况
    const tkaResult = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({ task_id: 'hwc-pos-20251209-tka', period: 25141 });

    const vw8Result = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({ task_id: 'hwc-pos-20251209-vw8', period: 25141 });

    console.log('=== tka 25141期 ===');
    console.log('字段列表:', Object.keys(tkaResult || {}));
    console.log('exclusions_to_save存在?', 'exclusions_to_save' in (tkaResult || {}));

    console.log('\n=== vw8 25141期 ===');
    console.log('字段列表:', Object.keys(vw8Result || {}));
    console.log('exclusions_to_save存在?', 'exclusions_to_save' in (vw8Result || {}));

    // 查看结果的完整结构
    console.log('\n=== tka 结果中的所有字段值类型 ===');
    for (const [key, value] of Object.entries(tkaResult || {})) {
        if (key === '_id' || key === '__v') continue;
        const typeStr = Array.isArray(value) ? `[Array:${value.length}]` : (typeof value === 'object' ? '{Object}' : value);
        console.log(`  ${key}: ${typeof value} = ${typeStr}`);
    }

    await mongoose.disconnect();
}

investigate().catch(console.error);
