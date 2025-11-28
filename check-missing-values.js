const mongoose = require('mongoose');

async function check() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');
    const db = mongoose.connection.db;

    console.log('=== 检查遗漏值表 ===');

    // 检查可能的遗漏值集合
    const collections = await db.listCollections().toArray();
    const missingColls = collections.filter(c =>
        c.name.toLowerCase().includes('missing') ||
        c.name.toLowerCase().includes('redball')
    );
    console.log('遗漏值相关集合:', missingColls.map(c => c.name).join(', '));

    // 检查 hit_dlt_basictrendchart_redballmissing_histories
    const missingColl = db.collection('hit_dlt_basictrendchart_redballmissing_histories');
    const count = await missingColl.countDocuments();
    console.log('\nhit_dlt_basictrendchart_redballmissing_histories记录数:', count);

    if (count > 0) {
        // 查找期号25123的遗漏值
        const sample = await missingColl.findOne({ Issue: '25123' });
        if (sample) {
            console.log('\n期号25123的遗漏值数据:');
            console.log('热号(≤4):', []);
            console.log('温号(5-9):', []);
            console.log('冷号(≥10):', []);

            let hot = [], warm = [], cold = [];
            for (let i = 1; i <= 35; i++) {
                const key = String(i);
                const v = sample[key];
                if (v !== undefined) {
                    if (v <= 4) hot.push(`${i}(${v})`);
                    else if (v >= 5 && v <= 9) warm.push(`${i}(${v})`);
                    else cold.push(`${i}(${v})`);
                }
            }

            console.log('热号(≤4):', hot.length, '个 -', hot.join(', '));
            console.log('温号(5-9):', warm.length, '个 -', warm.join(', '));
            console.log('冷号(≥10):', cold.length, '个 -', cold.join(', '));
        } else {
            // 尝试数字类型
            const sample2 = await missingColl.findOne({ Issue: 25123 });
            if (sample2) {
                console.log('找到期号25123(数字类型)');
            } else {
                console.log('未找到期号25123');
                // 查看最新一条
                const latest = await missingColl.findOne({}, { sort: { _id: -1 } });
                console.log('最新一条Issue:', latest?.Issue, '类型:', typeof latest?.Issue);
            }
        }
    }

    await mongoose.disconnect();
}

check().catch(console.error);
