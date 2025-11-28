#!/usr/bin/env node

const mongoose = require('mongoose');

async function compareTwoCollections() {
    console.log('\n🔍 对比两个热温冷优化表 collection\n');
    console.log('='.repeat(80));

    await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const db = mongoose.connection.db;

    // 两个collection名称
    const coll1 = 'HIT_DLT_RedCombinationsHotWarmColdOptimized';  // 大写，我们刚生成的
    const coll2 = 'hit_dlt_redcombinationshotwarmcoldoptimizeds';  // 小写，服务端使用的

    console.log('Collection 1 (大写): ' + coll1);
    console.log('Collection 2 (小写): ' + coll2);
    console.log('='.repeat(80));

    // ========== Collection 1 分析 ==========
    console.log('\n📊 Collection 1 (大写 - 生成脚本写入)');
    console.log('-'.repeat(80));

    const count1 = await db.collection(coll1).countDocuments();
    console.log(`记录数: ${count1}`);

    if (count1 > 0) {
        const sample1 = await db.collection(coll1).findOne({});
        console.log('\n字段结构:');
        Object.keys(sample1).forEach(key => {
            console.log(`  - ${key}: ${typeof sample1[key]} ${Array.isArray(sample1[key]) ? '(array)' : ''}`);
        });

        // 检查时间戳
        const earliest1 = await db.collection(coll1).find({}).sort({ generated_at: 1 }).limit(1).toArray();
        const latest1 = await db.collection(coll1).find({}).sort({ generated_at: -1 }).limit(1).toArray();

        console.log('\n生成时间范围:');
        console.log(`  最早: ${earliest1[0]?.generated_at}`);
        console.log(`  最晚: ${latest1[0]?.generated_at}`);

        // 检查期号25124
        const target25124_1 = await db.collection(coll1).findOne({ target_issue: '25124' });
        if (target25124_1) {
            console.log('\n✅ 包含期号25124:');
            console.log(`  - base_issue: ${target25124_1.base_issue}`);
            console.log(`  - generated_at: ${target25124_1.generated_at}`);
            const ratios1 = Object.keys(target25124_1.hot_warm_cold_data || {});
            const withWarm1 = ratios1.filter(r => {
                const [h, w, c] = r.split(':').map(Number);
                return w > 0;
            });
            console.log(`  - 比例种类: ${ratios1.length}`);
            console.log(`  - 含温号比例: ${withWarm1.length}`);
            console.log(`  - 4:1:0组合数: ${target25124_1.hot_warm_cold_data['4:1:0']?.length || 0}`);
        } else {
            console.log('\n❌ 未找到期号25124');
        }

        // 检查是否所有记录都有温号
        console.log('\n检查数据质量 (抽样5条):');
        const samples1 = await db.collection(coll1).find({}).limit(5).toArray();
        let hasWarmCount1 = 0;
        for (const record of samples1) {
            const ratios = Object.keys(record.hot_warm_cold_data || {});
            const withWarm = ratios.filter(r => {
                const [h, w, c] = r.split(':').map(Number);
                return w > 0;
            });
            if (withWarm.length > 0) hasWarmCount1++;
            console.log(`  ${record.base_issue}→${record.target_issue}: ${ratios.length}种比例, ${withWarm.length}含温号`);
        }
        console.log(`\n  抽样结果: ${hasWarmCount1}/5 包含温号`);
    }

    // ========== Collection 2 分析 ==========
    console.log('\n\n📊 Collection 2 (小写 - 服务端连接)');
    console.log('-'.repeat(80));

    const count2 = await db.collection(coll2).countDocuments();
    console.log(`记录数: ${count2}`);

    if (count2 > 0) {
        const sample2 = await db.collection(coll2).findOne({});
        console.log('\n字段结构:');
        Object.keys(sample2).forEach(key => {
            console.log(`  - ${key}: ${typeof sample2[key]} ${Array.isArray(sample2[key]) ? '(array)' : ''}`);
        });

        // 检查时间戳
        const earliest2 = await db.collection(coll2).find({}).sort({ created_at: 1 }).limit(1).toArray();
        const latest2 = await db.collection(coll2).find({}).sort({ created_at: -1 }).limit(1).toArray();

        console.log('\n生成时间范围:');
        console.log(`  最早: ${earliest2[0]?.created_at}`);
        console.log(`  最晚: ${latest2[0]?.created_at}`);

        // 检查期号25124
        const target25124_2 = await db.collection(coll2).findOne({ target_issue: '25124' });
        if (target25124_2) {
            console.log('\n✅ 包含期号25124:');
            console.log(`  - base_issue: ${target25124_2.base_issue}`);
            console.log(`  - created_at: ${target25124_2.created_at}`);

            // 检查数据格式
            if (target25124_2.hot_warm_cold_data) {
                const ratios2 = Object.keys(target25124_2.hot_warm_cold_data);
                const withWarm2 = ratios2.filter(r => {
                    const [h, w, c] = r.split(':').map(Number);
                    return w > 0;
                });
                console.log(`  - 比例种类: ${ratios2.length}`);
                console.log(`  - 含温号比例: ${withWarm2.length}`);
                console.log(`  - 4:1:0组合数: ${target25124_2.hot_warm_cold_data['4:1:0']?.length || 0}`);
            } else {
                console.log(`  - ⚠️ 数据格式可能不同 (无 hot_warm_cold_data 字段)`);
            }
        } else {
            console.log('\n❌ 未找到期号25124');
        }

        // 检查是否所有记录都有温号
        console.log('\n检查数据质量 (抽样5条):');
        const samples2 = await db.collection(coll2).find({}).limit(5).toArray();
        let hasWarmCount2 = 0;
        for (const record of samples2) {
            if (record.hot_warm_cold_data) {
                const ratios = Object.keys(record.hot_warm_cold_data);
                const withWarm = ratios.filter(r => {
                    const [h, w, c] = r.split(':').map(Number);
                    return w > 0;
                });
                if (withWarm.length > 0) hasWarmCount2++;
                console.log(`  ${record.base_issue}→${record.target_issue}: ${ratios.length}种比例, ${withWarm.length}含温号`);
            } else {
                console.log(`  ${record.base_issue || record.target_issue || 'unknown'}: ⚠️ 无 hot_warm_cold_data 字段`);
            }
        }
        console.log(`\n  抽样结果: ${hasWarmCount2}/5 包含温号`);
    }

    // ========== 对比总结 ==========
    console.log('\n\n' + '='.repeat(80));
    console.log('📋 对比总结');
    console.log('='.repeat(80));

    console.log(`\n记录数对比:`);
    console.log(`  Collection 1 (大写): ${count1} 条`);
    console.log(`  Collection 2 (小写): ${count2} 条`);
    console.log(`  差异: ${Math.abs(count1 - count2)} 条`);

    // 检查结构兼容性
    if (count1 > 0 && count2 > 0) {
        const sample1 = await db.collection(coll1).findOne({});
        const sample2 = await db.collection(coll2).findOne({});

        const keys1 = Object.keys(sample1);
        const keys2 = Object.keys(sample2);

        const commonKeys = keys1.filter(k => keys2.includes(k));
        const onlyIn1 = keys1.filter(k => !keys2.includes(k));
        const onlyIn2 = keys2.filter(k => !keys1.includes(k));

        console.log(`\n字段兼容性:`);
        console.log(`  共同字段: ${commonKeys.length} 个 (${commonKeys.join(', ')})`);
        if (onlyIn1.length > 0) {
            console.log(`  仅在Collection 1: ${onlyIn1.join(', ')}`);
        }
        if (onlyIn2.length > 0) {
            console.log(`  仅在Collection 2: ${onlyIn2.join(', ')}`);
        }

        // 判断是否可以迁移
        const canMigrate = sample1.hot_warm_cold_data && sample2.hot_warm_cold_data;
        console.log(`\n✅ 数据结构兼容: ${canMigrate ? '是 (可以迁移)' : '否 (需要重新生成)'}`);
    }

    // ========== 推荐方案 ==========
    console.log('\n' + '='.repeat(80));
    console.log('💡 推荐方案');
    console.log('='.repeat(80));

    if (count1 > count2) {
        console.log(`\n✅ Collection 1 (大写) 有更多记录 (${count1} > ${count2})`);
        console.log(`   推荐: 将 Collection 1 的数据迁移到 Collection 2`);
        console.log(`\n迁移步骤:`);
        console.log(`   1. 备份 Collection 2 (小写)`);
        console.log(`   2. 清空 Collection 2`);
        console.log(`   3. 从 Collection 1 复制所有记录到 Collection 2`);
        console.log(`   4. 验证 Collection 2 数据完整性`);
        console.log(`   5. 删除 Collection 1 (大写)`);
    } else if (count2 > count1) {
        console.log(`\n✅ Collection 2 (小写) 有更多记录 (${count2} > ${count1})`);
        console.log(`   推荐: 保留 Collection 2，删除 Collection 1`);
    } else {
        console.log(`\n⚠️  两个 collection 记录数相同 (${count1})`);
        console.log(`   需要检查时间戳和数据质量来决定保留哪个`);
    }

    await mongoose.disconnect();
}

compareTwoCollections().catch(error => {
    console.error('❌ 对比失败:', error);
    process.exit(1);
});
