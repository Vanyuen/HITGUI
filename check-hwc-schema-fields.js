const mongoose = require('mongoose');

async function checkSchemaFields() {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

        const col = mongoose.connection.db.collection('hit_dlt_redcombinationshotwarmcoldoptimizeds');

        console.log('🔍 检查 hit_dlt_redcombinationshotwarmcoldoptimizeds 表字段...\n');

        // 1. 获取记录总数
        const totalCount = await col.countDocuments();
        console.log(`📊 记录总数: ${totalCount}\n`);

        // 2. 随机抽取一条记录查看所有字段
        const sample = await col.findOne({});

        console.log('📋 实际存在的字段列表:');
        console.log('─'.repeat(60));

        const actualFields = Object.keys(sample);
        actualFields.forEach((field, index) => {
            const value = sample[field];
            let type = typeof value;

            if (value === null) type = 'null';
            else if (value === undefined) type = 'undefined';
            else if (Array.isArray(value)) type = 'Array';
            else if (value instanceof Date) type = 'Date';
            else if (typeof value === 'object') {
                if (value.constructor && value.constructor.name === 'Map') {
                    type = 'Map';
                } else {
                    type = 'Object';
                }
            }

            console.log(`${(index + 1).toString().padStart(2)}. ${field.padEnd(25)} → ${type}`);
        });

        console.log('─'.repeat(60));
        console.log(`总计: ${actualFields.length} 个字段\n`);

        // 3. 检查新Schema定义的字段
        console.log('📋 Schema定义的字段检查:');
        console.log('─'.repeat(60));

        const expectedFields = {
            'base_issue': 'String (必需)',
            'target_issue': 'String (必需)',
            'base_id': 'Number (新增，用于性能优化)',
            'target_id': 'Number (新增，用于性能优化)',
            'is_predicted': 'Boolean (新增，是否为推算期)',
            'hot_warm_cold_data': 'Map (必需，热温冷数据)',
            'total_combinations': 'Number (新增，总组合数)',
            'hit_analysis': 'Object (新增，命中分析数据)',
            'created_at': 'Date (时间戳)',
            'updated_at': 'Date (时间戳)'
        };

        let existCount = 0;
        let missingCount = 0;

        Object.entries(expectedFields).forEach(([field, desc]) => {
            const exists = field in sample;
            const status = exists ? '✅ 存在' : '❌ 缺失';
            const value = exists ? sample[field] : 'N/A';

            let actualType = 'N/A';
            if (exists) {
                if (value === null) actualType = 'null';
                else if (value === undefined) actualType = 'undefined';
                else if (Array.isArray(value)) actualType = 'Array';
                else if (value instanceof Date) actualType = 'Date';
                else if (typeof value === 'object') {
                    if (value.constructor && value.constructor.name === 'Map') {
                        actualType = 'Map/Object';
                    } else {
                        actualType = 'Object';
                    }
                } else {
                    actualType = typeof value;
                }
            }

            console.log(`${status} ${field.padEnd(25)} (${desc})`);
            if (exists) {
                console.log(`       实际类型: ${actualType}, 实际值: ${actualType === 'Object' || actualType === 'Map/Object' ? '[Object/Map]' : value}`);
            }

            if (exists) existCount++;
            else missingCount++;
        });

        console.log('─'.repeat(60));
        console.log(`存在字段: ${existCount}/${Object.keys(expectedFields).length}`);
        console.log(`缺失字段: ${missingCount}/${Object.keys(expectedFields).length}\n`);

        // 4. 统计各字段的覆盖率
        console.log('📊 字段覆盖率统计:');
        console.log('─'.repeat(60));

        for (const [field, desc] of Object.entries(expectedFields)) {
            const count = await col.countDocuments({ [field]: { $exists: true, $ne: null } });
            const coverage = ((count / totalCount) * 100).toFixed(1);
            const status = count === totalCount ? '✅' : count > 0 ? '⚠️' : '❌';

            console.log(`${status} ${field.padEnd(25)} ${count.toString().padStart(5)}/${totalCount} (${coverage}%)`);
        }

        console.log('─'.repeat(60));

        // 5. 检查非Schema定义的额外字段
        console.log('\n📋 额外字段 (不在Schema定义中):');
        console.log('─'.repeat(60));

        const extraFields = actualFields.filter(f => !(f in expectedFields));
        if (extraFields.length > 0) {
            extraFields.forEach(field => {
                console.log(`  • ${field}`);
            });
        } else {
            console.log('  (无)');
        }

        console.log('─'.repeat(60));

        // 6. 详细检查特殊字段
        console.log('\n🔍 特殊字段详细检查:');
        console.log('─'.repeat(60));

        // 检查 hot_warm_cold_data
        if (sample.hot_warm_cold_data) {
            const hwcKeys = Object.keys(sample.hot_warm_cold_data);
            console.log(`✅ hot_warm_cold_data: Map类型，包含 ${hwcKeys.length} 种比例`);
        } else {
            console.log('❌ hot_warm_cold_data: 不存在');
        }

        // 检查 hit_analysis
        if (sample.hit_analysis) {
            console.log('✅ hit_analysis: 存在');
            console.log('   子字段:', Object.keys(sample.hit_analysis).join(', '));
        } else {
            console.log('❌ hit_analysis: 不存在');
        }

        // 检查 base_id / target_id
        console.log(`${sample.base_id !== undefined ? '✅' : '❌'} base_id: ${sample.base_id !== undefined ? sample.base_id : '不存在'}`);
        console.log(`${sample.target_id !== undefined ? '✅' : '❌'} target_id: ${sample.target_id !== undefined ? sample.target_id : '不存在'}`);

        // 检查 is_predicted
        console.log(`${sample.is_predicted !== undefined ? '✅' : '❌'} is_predicted: ${sample.is_predicted !== undefined ? sample.is_predicted : '不存在'}`);

        // 检查 total_combinations
        console.log(`${sample.total_combinations !== undefined ? '✅' : '❌'} total_combinations: ${sample.total_combinations !== undefined ? sample.total_combinations : '不存在'}`);

        console.log('─'.repeat(60));

        // 7. 最终结论
        console.log('\n' + '='.repeat(60));
        console.log('📋 字段检查结论:');
        console.log('='.repeat(60));

        const requiredFields = ['base_issue', 'target_issue', 'hot_warm_cold_data'];
        const newFields = ['base_id', 'target_id', 'is_predicted', 'total_combinations', 'hit_analysis'];

        const requiredOK = requiredFields.every(f => f in sample);
        const newFieldsAdded = newFields.filter(f => f in sample && sample[f] !== undefined);
        const newFieldsMissing = newFields.filter(f => !(f in sample) || sample[f] === undefined);

        console.log(`✅ 核心必需字段: ${requiredOK ? '完整' : '不完整'}`);
        console.log(`${newFieldsAdded.length > 0 ? '✅' : '❌'} 已添加的新字段 (${newFieldsAdded.length}/${newFields.length}): ${newFieldsAdded.join(', ') || '无'}`);
        console.log(`${newFieldsMissing.length > 0 ? '⚠️' : '✅'} 缺失的新字段 (${newFieldsMissing.length}/${newFields.length}): ${newFieldsMissing.join(', ') || '无'}`);

        console.log('='.repeat(60));

        await mongoose.connection.close();
        console.log('\n🎉 检查完成！');

    } catch (error) {
        console.error('❌ 检查失败:', error.message);
        process.exit(1);
    }
}

checkSchemaFields();
