const mongoose = require('mongoose');

async function testFullExclusion() {
    await mongoose.connect('mongodb://localhost:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const targetIssue = '25083';
    const periods = 1;
    const combo2 = false;
    const combo3 = false;
    const combo4 = false;

    console.log('=== 测试同出排除完整流程 ===\n');
    console.log(`目标期号: ${targetIssue}`);
    console.log(`期数: ${periods}`);
    console.log(`2码勾选: ${combo2}, 3码勾选: ${combo3}, 4码勾选: ${combo4}`);
    console.log(`模式: ${combo2 || combo3 || combo4 ? 'selective' : 'all'}\n`);

    // 1. 获取同出API数据
    console.log('1. 调用同出API...');
    const apiResponse = await fetch(`http://localhost:3003/api/dlt/cooccurrence-per-ball?targetIssue=${targetIssue}&periods=${periods}`);
    const apiData = await apiResponse.json();

    if (!apiData.success) {
        console.error('API调用失败:', apiData.message);
        process.exit(1);
    }

    const analyzedDetails = Object.entries(apiData.data.analyzedDetails || {});
    console.log(`✓ 分析了 ${analyzedDetails.length} 个红球`);

    // 2. 提取涉及的期号
    const allIssues = new Set();
    analyzedDetails.forEach(([_, info]) => {
        if (info.lastAppearedIssue) {
            allIssues.add(info.lastAppearedIssue);
        }
    });
    const issuesList = Array.from(allIssues);
    console.log(`✓ 涉及期号: ${issuesList.join(', ')}\n`);

    // 3. 查询这些期号的ComboFeatures
    console.log('2. 查询ComboFeatures...');
    const DLTComboFeatures = mongoose.connection.db.collection('hit_dlt_combofeatures');
    const features = await DLTComboFeatures.find({
        Issue: { $in: issuesList }  // 关键：使用string类型
    }).toArray();

    console.log(`✓ 找到 ${features.length} 条特征记录`);

    // 4. 聚合待排除特征
    console.log('\n3. 聚合待排除特征...');
    const excludeFeatures = {
        combo_2: new Set(),
        combo_3: new Set(),
        combo_4: new Set()
    };

    const mode = (combo2 || combo3 || combo4) ? 'selective' : 'all';
    console.log(`模式: ${mode}`);

    features.forEach(record => {
        if ((mode === 'all' || combo2) && record.combo_2) {
            record.combo_2.forEach(feature => excludeFeatures.combo_2.add(feature));
        }
        if ((mode === 'all' || combo3) && record.combo_3) {
            record.combo_3.forEach(feature => excludeFeatures.combo_3.add(feature));
        }
        if ((mode === 'all' || combo4) && record.combo_4) {
            record.combo_4.forEach(feature => excludeFeatures.combo_4.add(feature));
        }
    });

    console.log(`✓ 2码特征: ${excludeFeatures.combo_2.size} 个`);
    console.log(`✓ 3码特征: ${excludeFeatures.combo_3.size} 个`);
    console.log(`✓ 4码特征: ${excludeFeatures.combo_4.size} 个`);
    console.log('示例2码特征:', Array.from(excludeFeatures.combo_2).slice(0, 5));
    console.log('示例3码特征:', Array.from(excludeFeatures.combo_3).slice(0, 3));

    // 5. 测试过滤逻辑
    console.log('\n4. 测试过滤逻辑...');
    const DLTRedCombination = mongoose.connection.db.collection('hit_dlt_redcombinations');

    // 获取10个组合样本
    let allCombinations = await DLTRedCombination.find({}).limit(10).toArray();
    const beforeCount = allCombinations.length;
    console.log(`原始组合数: ${beforeCount}`);

    // 应用过滤
    allCombinations = allCombinations.filter(combo => {
        const combo_2 = combo.combo_2 || [];
        const combo_3 = combo.combo_3 || [];
        const combo_4 = combo.combo_4 || [];

        // 检查2码特征
        if (excludeFeatures.combo_2.size > 0) {
            for (const feature of combo_2) {
                if (excludeFeatures.combo_2.has(feature)) {
                    return false;
                }
            }
        }

        // 检查3码特征
        if (excludeFeatures.combo_3.size > 0) {
            for (const feature of combo_3) {
                if (excludeFeatures.combo_3.has(feature)) {
                    return false;
                }
            }
        }

        // 检查4码特征
        if (excludeFeatures.combo_4.size > 0) {
            for (const feature of combo_4) {
                if (excludeFeatures.combo_4.has(feature)) {
                    return false;
                }
            }
        }

        return true;
    });

    const afterCount = allCombinations.length;
    console.log(`过滤后组合数: ${afterCount}`);
    console.log(`排除了: ${beforeCount - afterCount} 个组合`);

    if (afterCount < beforeCount) {
        console.log('\n✅ 过滤逻辑正常工作！');
    } else {
        console.log('\n❌ 过滤逻辑没有生效！');
    }

    await mongoose.connection.close();
    process.exit(0);
}

testFullExclusion().catch(err => {
    console.error('错误:', err);
    process.exit(1);
});
