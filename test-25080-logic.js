const mongoose = require('mongoose');
const fetch = require('node-fetch');

mongoose.connect('mongodb://localhost:27017/lottery', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log('测试25080期的同出排除逻辑...\n');

    const targetIssue = '25080';
    const periods = 1;

    // 1. 调用同出API
    console.log('1. 调用同出API...');
    const url = \;
    const response = await fetch(url);
    const result = await response.json();

    console.log('API返回成功:', result.success);
    
    if (\!result.success) {
        console.log('❌ API调用失败');
        process.exit(1);
    }

    const analyzedDetails = result.data.analyzedDetails || [];
    console.log('分析的红球数量:', analyzedDetails.length);

    // 2. 提取涉及的期号
    const allIssues = new Set();
    analyzedDetails.forEach(detail => {
        if (detail.analyzed_issues) {
            detail.analyzed_issues.forEach(issue => allIssues.add(issue));
        }
    });

    const issuesList = Array.from(allIssues);
    console.log('\n2. 涉及的期号数:', issuesList.length);
    console.log('期号列表:', issuesList.slice(0, 10).join(', '));

    // 3. 查询DLTComboFeatures
    console.log('\n3. 查询DLTComboFeatures...');
    const DLTComboFeatures = mongoose.connection.db.collection('hit_dlt_combofeatures');
    const features = await DLTComboFeatures.find({
        Issue: { : issuesList }
    }).toArray();

    console.log('找到的features数量:', features.length);

    if (features.length > 0) {
        const first = features[0];
        console.log('\n示例feature:');
        console.log('期号:', first.Issue);
        console.log('2码特征数量:', first.combo_2?.length || 0);
        console.log('3码特征数量:', first.combo_3?.length || 0);
        console.log('4码特征数量:', first.combo_4?.length || 0);
    }

    // 4. 聚合特征
    console.log('\n4. 聚合待排除特征...');
    const combo2 = false, combo3 = false, combo4 = false;
    const mode = (combo2 || combo3 || combo4) ? 'selective' : 'all';
    console.log('模式:', mode);

    const excludeFeatures = { combo_2: new Set(), combo_3: new Set(), combo_4: new Set() };

    features.forEach(record => {
        if ((mode === 'all' || combo2) && record.combo_2) {
            record.combo_2.forEach(f => excludeFeatures.combo_2.add(f));
        }
        if ((mode === 'all' || combo3) && record.combo_3) {
            record.combo_3.forEach(f => excludeFeatures.combo_3.add(f));
        }
        if ((mode === 'all' || combo4) && record.combo_4) {
            record.combo_4.forEach(f => excludeFeatures.combo_4.add(f));
        }
    });

    console.log('\n待排除特征:');
    console.log('2码特征:', excludeFeatures.combo_2.size + ' 个');
    console.log('3码特征:', excludeFeatures.combo_3.size + ' 个');
    console.log('4码特征:', excludeFeatures.combo_4.size + ' 个');

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
