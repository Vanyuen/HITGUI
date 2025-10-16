async function test() {
    const url = 'http://localhost:3003/api/dlt/cooccurrence-per-ball?targetIssue=25083&periods=1';
    const response = await fetch(url);
    const data = await response.json();

    console.log('API返回成功:', data.success);

    if (data.success) {
        const details = Object.entries(data.data.analyzedDetails || {});
        console.log('分析的红球数量:', details.length);

        console.log('\n前5个红球的分析:');
        details.slice(0, 5).forEach(([ball, info]) => {
            console.log(`  红球${ball}: 最近出现期号${info.lastAppearedIssue}, 同出号码: ${info.coOccurredNumbers?.join(',')}`);
        });

        // 收集所有涉及的期号
        const allIssues = new Set();
        details.forEach(([_, info]) => {
            if (info.lastAppearedIssue) {
                allIssues.add(info.lastAppearedIssue);
            }
        });

        const issuesList = Array.from(allIssues).sort();
        console.log('\n涉及的所有期号 (' + issuesList.length + '期):', issuesList.join(', '));

        // 检查这些期号的ComboFeatures
        console.log('\n检查这些期号的ComboFeatures是否存在...');
        const mongoose = require('mongoose');
        await mongoose.connect('mongodb://localhost:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        const DLTComboFeatures = mongoose.connection.db.collection('hit_dlt_combofeatures');

        const features = await DLTComboFeatures.find({
            Issue: { $in: issuesList }
        }).toArray();

        console.log('找到的ComboFeatures记录数:', features.length);
        console.log('期号匹配情况:');
        issuesList.forEach(issue => {
            const found = features.find(f => f.Issue === issue);
            console.log(`  期号${issue}: ${found ? '✓ 存在' : '✗ 不存在'}`);
        });

        // 统计总特征数
        let total2 = 0, total3 = 0, total4 = 0;
        features.forEach(f => {
            total2 += f.combo_2?.length || 0;
            total3 += f.combo_3?.length || 0;
            total4 += f.combo_4?.length || 0;
        });

        console.log('\n总特征数统计:');
        console.log(`  2码特征: ${total2}个`);
        console.log(`  3码特征: ${total3}个`);
        console.log(`  4码特征: ${total4}个`);

        await mongoose.connection.close();
    }

    process.exit(0);
}

test().catch(err => {
    console.error(err);
    process.exit(1);
});
