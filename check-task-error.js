const mongoose = require('mongoose');

async function diagnoseIssue() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    console.log('=== 1. hit_dlts Issue类型检查 ===');
    // 使用NUMBER查询
    const record25075 = await mongoose.connection.db.collection('hit_dlts')
        .findOne({ Issue: 25075 });  // NUMBER类型
    console.log('Issue=25075 (number):', record25075 ? 'ID=' + record25075.ID : '不存在');

    const record25074 = await mongoose.connection.db.collection('hit_dlts')
        .findOne({ Issue: 25074 });
    console.log('Issue=25074 (number):', record25074 ? 'ID=' + record25074.ID : '不存在');

    console.log('\n=== 2. HWC优化表结构检查 ===');
    const hwcSample = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .findOne({});
    if (hwcSample) {
        console.log('字段:', Object.keys(hwcSample));
        console.log('base_issue:', hwcSample.base_issue, '类型:', typeof hwcSample.base_issue);
        console.log('target_issue:', hwcSample.target_issue, '类型:', typeof hwcSample.target_issue);
        const hasHwcData = hwcSample.hot_warm_cold_data ? true : false;
        console.log('hot_warm_cold_data存在:', hasHwcData);
        if (hwcSample.hot_warm_cold_data) {
            const keys = Object.keys(hwcSample.hot_warm_cold_data);
            console.log('hot_warm_cold_data比例数:', keys.length);
            console.log('前3个比例:', keys.slice(0, 3));
        }
    } else {
        console.log('HWC表为空!');
    }

    console.log('\n=== 3. 查找期号25074->25075的HWC数据 ===');
    const hwc25075 = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .findOne({ base_issue: '25074', target_issue: '25075' });
    console.log('25074->25075 (字符串):', hwc25075 ? '存在' : '不存在');

    // 也检查数字类型
    const hwc25075num = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .findOne({ base_issue: 25074, target_issue: 25075 });
    console.log('25074->25075 (数字):', hwc25075num ? '存在' : '不存在');

    if (hwc25075) {
        console.log('\nhot_warm_cold_data内容示例:');
        const keys = Object.keys(hwc25075.hot_warm_cold_data || {});
        console.log('比例数:', keys.length);
        console.log('比例列表:', keys.join(', '));
        const firstKey = keys[0];
        if (firstKey) {
            console.log('第一个比例', firstKey, '的组合数:', hwc25075.hot_warm_cold_data[firstKey].length);
        }
    }

    console.log('\n=== 4. HWC表期号范围 (数字排序) ===');
    const allHwc = await mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds')
        .find({}).project({ target_issue: 1 }).toArray();
    const issues = allHwc.map(h => parseInt(h.target_issue)).filter(n => !isNaN(n));
    console.log('HWC记录总数:', allHwc.length);
    if (issues.length > 0) {
        console.log('最小target_issue:', Math.min(...issues));
        console.log('最大target_issue:', Math.max(...issues));
    }

    console.log('\n=== 5. 检查任务结果结构 ===');
    const result = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
        .findOne({});
    if (result) {
        console.log('任务结果字段:', Object.keys(result));
        console.log('period:', result.period, '类型:', typeof result.period);
        console.log('base_issue:', result.base_issue);
        console.log('is_predicted:', result.is_predicted);
        console.log('red_combinations长度:', result.red_combinations ? result.red_combinations.length : 0);
        console.log('positive_selection_details:', JSON.stringify(result.positive_selection_details, null, 2));
    } else {
        console.log('任务结果表为空');
    }

    console.log('\n=== 6. 检查最新任务 ===');
    const task = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontasks')
        .findOne({}, { sort: { created_at: -1 } });
    if (task) {
        console.log('task_id:', task.task_id);
        console.log('status:', task.status);
        const hasTargetIssues = task.target_issues ? true : false;
        console.log('target_issues字段存在:', hasTargetIssues);
        console.log('target_issues类型:', Array.isArray(task.target_issues) ? 'Array' : typeof task.target_issues);

        // 检查任务结果的统计
        const taskId = task.task_id;
        const totalResults = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .countDocuments({ task_id: taskId });
        console.log('该任务的结果数:', totalResults);

        // 分别统计有/无组合的
        const withComb = await mongoose.connection.db.collection('hit_dlt_hwcpositivepredictiontaskresults')
            .find({ task_id: taskId })
            .toArray();

        const withCombCount = withComb.filter(r => r.red_combinations && r.red_combinations.length > 0).length;
        const withoutCombCount = withComb.filter(r => !r.red_combinations || r.red_combinations.length === 0).length;

        console.log('有组合的期号数:', withCombCount);
        console.log('无组合的期号数:', withoutCombCount);

        // 显示一个有组合和一个无组合的样例
        const sampleWith = withComb.find(r => r.red_combinations && r.red_combinations.length > 0);
        const sampleWithout = withComb.find(r => !r.red_combinations || r.red_combinations.length === 0);

        if (sampleWith) {
            console.log('\n--- 有组合样例 ---');
            console.log('period:', sampleWith.period);
            console.log('base_issue:', sampleWith.base_issue);
            console.log('is_predicted:', sampleWith.is_predicted);
            console.log('red_combinations数量:', sampleWith.red_combinations.length);
        }

        if (sampleWithout) {
            console.log('\n--- 无组合样例 ---');
            console.log('period:', sampleWithout.period);
            console.log('base_issue:', sampleWithout.base_issue);
            console.log('is_predicted:', sampleWithout.is_predicted);
            console.log('positive_selection_details:', JSON.stringify(sampleWithout.positive_selection_details, null, 2));
        }
    }

    await mongoose.disconnect();
}

diagnoseIssue().catch(console.error);
