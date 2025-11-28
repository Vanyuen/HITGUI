/**
 * ⚡ 优化点4: 数据库索引优化
 *
 * 功能：创建优化的复合索引，加速查询性能
 * 预期提升：3-8%
 *
 * @author Claude Code
 * @date 2025-11-11
 */

const mongoose = require('mongoose');

/**
 * 创建优化索引
 */
async function createOptimizedIndexes() {
    try {
        console.log('🔗 连接到MongoDB...');
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到MongoDB');

        const db = mongoose.connection.db;

        // ========== 1. 红球组合表索引优化 ==========
        console.log('\n📊 【红球组合表】创建复合索引...');

        // 1.1 和值+跨度复合索引（高频查询组合）
        try {
            await db.collection('hit_dlts').createIndex(
                {
                    sum_value: 1,
                    span_value: 1
                },
                {
                    name: 'idx_sum_span_optimized',
                    background: true
                }
            );
            console.log('  ✅ 索引 idx_sum_span_optimized 创建成功');
        } catch (error) {
            if (error.code === 85) {
                console.log('  ⚠️  索引 idx_sum_span_optimized 已存在');
            } else {
                throw error;
            }
        }

        // 1.2 区间比+奇偶比复合索引
        try {
            await db.collection('hit_dlts').createIndex(
                {
                    zone_ratio: 1,
                    odd_even_ratio: 1
                },
                {
                    name: 'idx_zone_oddeven_optimized',
                    background: true
                }
            );
            console.log('  ✅ 索引 idx_zone_oddeven_optimized 创建成功');
        } catch (error) {
            if (error.code === 85) {
                console.log('  ⚠️  索引 idx_zone_oddeven_optimized 已存在');
            } else {
                throw error;
            }
        }

        // 1.3 AC值索引
        try {
            await db.collection('hit_dlts').createIndex(
                { ac_value: 1 },
                {
                    name: 'idx_ac_value_optimized',
                    background: true
                }
            );
            console.log('  ✅ 索引 idx_ac_value_optimized 创建成功');
        } catch (error) {
            if (error.code === 85) {
                console.log('  ⚠️  索引 idx_ac_value_optimized 已存在');
            } else {
                throw error;
            }
        }

        // 1.4 同出组合索引（combo_2, combo_3, combo_4）
        try {
            await db.collection('hit_dlts').createIndex(
                { combo_2: 1 },
                {
                    name: 'idx_combo_2_optimized',
                    background: true
                }
            );
            console.log('  ✅ 索引 idx_combo_2_optimized 创建成功');
        } catch (error) {
            if (error.code === 85) {
                console.log('  ⚠️  索引 idx_combo_2_optimized 已存在');
            } else {
                throw error;
            }
        }

        try {
            await db.collection('hit_dlts').createIndex(
                { combo_3: 1 },
                {
                    name: 'idx_combo_3_optimized',
                    background: true
                }
            );
            console.log('  ✅ 索引 idx_combo_3_optimized 创建成功');
        } catch (error) {
            if (error.code === 85) {
                console.log('  ⚠️  索引 idx_combo_3_optimized 已存在');
            } else {
                throw error;
            }
        }

        try {
            await db.collection('hit_dlts').createIndex(
                { combo_4: 1 },
                {
                    name: 'idx_combo_4_optimized',
                    background: true
                }
            );
            console.log('  ✅ 索引 idx_combo_4_optimized 创建成功');
        } catch (error) {
            if (error.code === 85) {
                console.log('  ⚠️  索引 idx_combo_4_optimized 已存在');
            } else {
                throw error;
            }
        }

        // ========== 2. 热温冷比优化表索引 ==========
        console.log('\n📊 【热温冷比优化表】创建复合索引...');

        try {
            await db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized').createIndex(
                {
                    base_issue: 1,
                    target_issue: 1,
                    hwc_ratio: 1
                },
                {
                    name: 'idx_issue_pair_ratio_optimized',
                    background: true
                }
            );
            console.log('  ✅ 索引 idx_issue_pair_ratio_optimized 创建成功');
        } catch (error) {
            if (error.code === 85) {
                console.log('  ⚠️  索引 idx_issue_pair_ratio_optimized 已存在');
            } else {
                throw error;
            }
        }

        try {
            await db.collection('HIT_DLT_RedCombinationsHotWarmColdOptimized').createIndex(
                { combination_id: 1 },
                {
                    name: 'idx_combination_id_optimized',
                    background: true
                }
            );
            console.log('  ✅ 索引 idx_combination_id_optimized 创建成功');
        } catch (error) {
            if (error.code === 85) {
                console.log('  ⚠️  索引 idx_combination_id_optimized 已存在');
            } else {
                throw error;
            }
        }

        // ========== 3. 历史数据表索引 ==========
        console.log('\n📊 【历史数据表】创建索引...');

        try {
            await db.collection('hit_dlts').createIndex(
                { Issue: 1 },
                {
                    name: 'idx_issue_optimized',
                    background: true,
                    unique: true
                }
            );
            console.log('  ✅ 索引 idx_issue_optimized 创建成功');
        } catch (error) {
            if (error.code === 85) {
                console.log('  ⚠️  索引 idx_issue_optimized 已存在');
            } else {
                throw error;
            }
        }

        try {
            await db.collection('hit_dlts').createIndex(
                { ID: 1 },
                {
                    name: 'idx_id_optimized',
                    background: true
                }
            );
            console.log('  ✅ 索引 idx_id_optimized 创建成功');
        } catch (error) {
            if (error.code === 85) {
                console.log('  ⚠️  索引 idx_id_optimized 已存在');
            } else {
                throw error;
            }
        }

        // ========== 4. 蓝球组合表索引 ==========
        console.log('\n📊 【蓝球组合表】创建索引...');

        try {
            await db.collection('hit_dlts').createIndex(
                { combination_id: 1 },
                {
                    name: 'idx_combination_id_optimized',
                    background: true
                }
            );
            console.log('  ✅ 索引 idx_combination_id_optimized 创建成功');
        } catch (error) {
            if (error.code === 85) {
                console.log('  ⚠️  索引 idx_combination_id_optimized 已存在');
            } else {
                throw error;
            }
        }

        // ========== 5. 任务表索引 ==========
        console.log('\n📊 【任务表】创建索引...');

        try {
            await db.collection('PredictionTask').createIndex(
                { status: 1, created_at: -1 },
                {
                    name: 'idx_status_created_optimized',
                    background: true
                }
            );
            console.log('  ✅ 索引 idx_status_created_optimized 创建成功');
        } catch (error) {
            if (error.code === 85) {
                console.log('  ⚠️  索引 idx_status_created_optimized 已存在');
            } else {
                throw error;
            }
        }

        // ========== 查看所有索引 ==========
        console.log('\n📋 【索引统计】');

        const collections = [
            'hit_dlts',
            'HIT_DLT_RedCombinationsHotWarmColdOptimized',
            'hit_dlts',
            'hit_dlts',
            'PredictionTask'
        ];

        for (const collName of collections) {
            try {
                const indexes = await db.collection(collName).indexes();
                console.log(`\n  📂 ${collName}:`);
                console.log(`     索引数量: ${indexes.length}`);
                indexes.forEach(idx => {
                    const keyStr = JSON.stringify(idx.key);
                    const unique = idx.unique ? ' [UNIQUE]' : '';
                    const background = idx.background ? ' [BACKGROUND]' : '';
                    console.log(`     - ${idx.name}: ${keyStr}${unique}${background}`);
                });

                // 统计索引大小
                const stats = await db.collection(collName).stats();
                const indexSizeMB = (stats.totalIndexSize / 1024 / 1024).toFixed(2);
                const dataSizeMB = (stats.size / 1024 / 1024).toFixed(2);
                console.log(`     数据大小: ${dataSizeMB} MB, 索引大小: ${indexSizeMB} MB`);
            } catch (error) {
                console.log(`  ⚠️  集合 ${collName} 不存在或无法访问`);
            }
        }

        console.log('\n✅ 所有优化索引创建完成！');
        console.log('\n💡 索引优化说明:');
        console.log('   1. 复合索引 (sum_value + span_value): 优化基础条件查询');
        console.log('   2. 复合索引 (zone_ratio + odd_even_ratio): 优化比例条件查询');
        console.log('   3. 单列索引 (ac_value): 优化AC值过滤');
        console.log('   4. 同出组合索引 (combo_2/3/4): 优化同出排除查询');
        console.log('   5. 期号对索引 (base_issue + target_issue + hwc_ratio): 优化热温冷比查询');
        console.log('   6. 任务状态索引 (status + created_at): 优化任务列表查询');
        console.log('\n📈 预期性能提升: 3-8%');

    } catch (error) {
        console.error('\n❌ 索引创建失败:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 已断开MongoDB连接');
    }
}

// 执行索引创建
createOptimizedIndexes();
