/**
 * 应用HWC元数据优化
 * 解决创建热温冷正选批量预测任务慢的问题
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, 'src/server/server.js');

console.log('📖 读取 server.js...');
let content = fs.readFileSync(serverPath, 'utf-8');

// 修改1: 添加HWC元数据Schema和Model（在 DLTRedCombinationsHotWarmColdOptimized 之后）
const schemaMarker = `const DLTRedCombinationsHotWarmColdOptimized = mongoose.model('HIT_DLT_RedCombinationsHotWarmColdOptimized', dltRedCombinationsHotWarmColdOptimizedSchema);

// 保留旧表结构以保证兼容性`;

const schemaReplacement = `const DLTRedCombinationsHotWarmColdOptimized = mongoose.model('HIT_DLT_RedCombinationsHotWarmColdOptimized', dltRedCombinationsHotWarmColdOptimizedSchema);

// ⚡ 2025-12-07: HWC表元数据（用于快速查询覆盖范围，避免慢查询）
const hwcMetadataSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, default: 'hwc_coverage' },
    minTargetIssue: { type: Number, required: true },  // 最小目标期号
    maxTargetIssue: { type: Number, required: true },  // 最大目标期号
    recordCount: { type: Number, required: true },     // 总记录数
    updatedAt: { type: Date, default: Date.now }       // 更新时间
});
const HWCMetadata = mongoose.model('HWC_Metadata', hwcMetadataSchema);

// 保留旧表结构以保证兼容性`;

if (content.includes('HWC_Metadata')) {
    console.log('✅ HWC元数据Schema已存在，跳过添加');
} else if (content.includes(schemaMarker)) {
    content = content.replace(schemaMarker, schemaReplacement);
    console.log('✅ 已添加HWC元数据Schema和Model');
} else {
    console.log('❌ 未找到Schema插入位置');
}

// 修改2: 替换loadHwcCoverageCache函数（使用元数据替代慢查询）
const oldLoadFunc = `    /**
     * ⚡ 加载热温冷表覆盖范围缓存
     * 使用find+sort替代aggregate，利用target_id索引，性能提升100倍+
     */
    async loadHwcCoverageCache(forceRefresh = false) {
        if (this.hwcCoverageCache && !forceRefresh) {
            return this.hwcCoverageCache;
        }

        const startTime = Date.now();
        log(\`📊 [GlobalCache] 加载热温冷表覆盖范围缓存...\`);

        try {
            // 并行查询：最小target_id、最大target_id、总数
            const [minRecord, maxRecord, count] = await Promise.all([
                DLTRedCombinationsHotWarmColdOptimized.findOne({}).sort({ target_id: 1 }).select('target_issue target_id').lean(),
                DLTRedCombinationsHotWarmColdOptimized.findOne({}).sort({ target_id: -1 }).select('target_issue target_id').lean(),
                DLTRedCombinationsHotWarmColdOptimized.countDocuments()
            ]);

            if (count > 0 && minRecord && maxRecord) {
                this.hwcCoverageCache = {
                    minTarget: parseInt(minRecord.target_issue),
                    maxTarget: parseInt(maxRecord.target_issue),
                    count: count,
                    loadedAt: new Date()
                };
                log(\`✅ [GlobalCache] 热温冷表覆盖范围缓存加载完成: \${this.hwcCoverageCache.minTarget}-\${this.hwcCoverageCache.maxTarget}, \${count}条, 耗时\${Date.now() - startTime}ms\`);
            } else {
                this.hwcCoverageCache = { minTarget: null, maxTarget: null, count: 0, loadedAt: new Date() };
                log(\`⚠️ [GlobalCache] 热温冷表为空\`);
            }

            return this.hwcCoverageCache;
        } catch (error) {
            log(\`❌ [GlobalCache] 加载热温冷表覆盖范围缓存失败: \${error.message}\`);
            return null;
        }
    }`;

const newLoadFunc = `    /**
     * ⚡ 加载热温冷表覆盖范围缓存
     * 2025-12-07优化：从元数据表读取，毫秒级响应（原方案需要60秒+）
     */
    async loadHwcCoverageCache(forceRefresh = false) {
        if (this.hwcCoverageCache && !forceRefresh) {
            return this.hwcCoverageCache;
        }

        const startTime = Date.now();
        log(\`📊 [GlobalCache] 加载热温冷表覆盖范围缓存...\`);

        try {
            // ⚡ 从元数据表读取（毫秒级），不再使用慢查询
            const metadata = await HWCMetadata.findOne({ key: 'hwc_coverage' }).lean();

            if (metadata && metadata.recordCount > 0) {
                this.hwcCoverageCache = {
                    minTarget: metadata.minTargetIssue,
                    maxTarget: metadata.maxTargetIssue,
                    count: metadata.recordCount,
                    loadedAt: new Date()
                };
                log(\`✅ [GlobalCache] 热温冷表覆盖范围缓存加载完成: \${this.hwcCoverageCache.minTarget}-\${this.hwcCoverageCache.maxTarget}, \${metadata.recordCount}条, 耗时\${Date.now() - startTime}ms\`);
            } else {
                // 元数据不存在，需要初始化（仅首次运行）
                log(\`⚠️ [GlobalCache] HWC元数据不存在，正在初始化...\`);
                await this.initHwcMetadata();
            }

            return this.hwcCoverageCache;
        } catch (error) {
            log(\`❌ [GlobalCache] 加载热温冷表覆盖范围缓存失败: \${error.message}\`);
            return null;
        }
    }

    /**
     * ⚡ 初始化HWC元数据（仅首次运行时执行）
     * 通过aggregate一次性获取min/max，然后保存到元数据表
     */
    async initHwcMetadata() {
        const startTime = Date.now();
        log(\`🔧 [GlobalCache] 初始化HWC元数据...\`);

        try {
            // 使用aggregate获取min/max（只执行一次）
            const result = await DLTRedCombinationsHotWarmColdOptimized.aggregate([
                {
                    $group: {
                        _id: null,
                        minTargetIssue: { $min: { $toInt: '$target_issue' } },
                        maxTargetIssue: { $max: { $toInt: '$target_issue' } },
                        count: { $sum: 1 }
                    }
                }
            ]).allowDiskUse(true);

            if (result.length > 0 && result[0].count > 0) {
                const { minTargetIssue, maxTargetIssue, count } = result[0];

                // 保存到元数据表
                await HWCMetadata.findOneAndUpdate(
                    { key: 'hwc_coverage' },
                    { minTargetIssue, maxTargetIssue, recordCount: count, updatedAt: new Date() },
                    { upsert: true, new: true }
                );

                this.hwcCoverageCache = {
                    minTarget: minTargetIssue,
                    maxTarget: maxTargetIssue,
                    count: count,
                    loadedAt: new Date()
                };

                log(\`✅ [GlobalCache] HWC元数据初始化完成: \${minTargetIssue}-\${maxTargetIssue}, \${count}条, 耗时\${Date.now() - startTime}ms\`);
            } else {
                this.hwcCoverageCache = { minTarget: null, maxTarget: null, count: 0, loadedAt: new Date() };
                log(\`⚠️ [GlobalCache] 热温冷表为空\`);
            }
        } catch (error) {
            log(\`❌ [GlobalCache] 初始化HWC元数据失败: \${error.message}\`);
        }
    }`;

if (content.includes('initHwcMetadata')) {
    console.log('✅ loadHwcCoverageCache已优化，跳过修改');
} else if (content.includes(oldLoadFunc)) {
    content = content.replace(oldLoadFunc, newLoadFunc);
    console.log('✅ 已优化loadHwcCoverageCache函数');
} else {
    console.log('❌ 未找到loadHwcCoverageCache函数（可能格式不完全匹配）');
    // 尝试更宽松的匹配
    const loadFuncStart = content.indexOf('async loadHwcCoverageCache(forceRefresh = false) {');
    if (loadFuncStart !== -1) {
        console.log('   找到函数起始位置，行号约:', content.substring(0, loadFuncStart).split('\n').length);
    }
}

// 修改3: 在generateUnifiedHotWarmColdOptimizedTable函数末尾添加元数据更新
const oldGenEnd = `    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    log(\`\\n✅ 热温冷比生成完成! 新建: \${createdCount}条 (已开奖期: \${createdCount - 1}, 推算期: 1), 跳过: \${skippedCount}条, 耗时: \${totalTime}秒\\n\`);

    return { createdCount, totalCount: processedCount };
}`;

const newGenEnd = `    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    log(\`\\n✅ 热温冷比生成完成! 新建: \${createdCount}条 (已开奖期: \${createdCount - 1}, 推算期: 1), 跳过: \${skippedCount}条, 耗时: \${totalTime}秒\\n\`);

    // ⚡ 2025-12-07: 更新HWC元数据（供创建任务时快速查询覆盖范围）
    try {
        const result = await DLTRedCombinationsHotWarmColdOptimized.aggregate([
            {
                $group: {
                    _id: null,
                    minTargetIssue: { $min: { $toInt: '$target_issue' } },
                    maxTargetIssue: { $max: { $toInt: '$target_issue' } },
                    count: { $sum: 1 }
                }
            }
        ]).allowDiskUse(true);

        if (result.length > 0 && result[0].count > 0) {
            const { minTargetIssue, maxTargetIssue, count } = result[0];
            await HWCMetadata.findOneAndUpdate(
                { key: 'hwc_coverage' },
                { minTargetIssue, maxTargetIssue, recordCount: count, updatedAt: new Date() },
                { upsert: true }
            );
            log(\`📝 HWC元数据已更新: \${minTargetIssue}-\${maxTargetIssue}, \${count}条\`);

            // 刷新全局缓存
            if (globalCacheManager) {
                globalCacheManager.hwcCoverageCache = {
                    minTarget: minTargetIssue,
                    maxTarget: maxTargetIssue,
                    count: count,
                    loadedAt: new Date()
                };
            }
        }
    } catch (metaError) {
        log(\`⚠️ 更新HWC元数据失败: \${metaError.message}\`);
    }

    return { createdCount, totalCount: processedCount };
}`;

if (content.includes('// ⚡ 2025-12-07: 更新HWC元数据')) {
    console.log('✅ generateUnifiedHotWarmColdOptimizedTable已添加元数据更新，跳过修改');
} else if (content.includes(oldGenEnd)) {
    content = content.replace(oldGenEnd, newGenEnd);
    console.log('✅ 已在generateUnifiedHotWarmColdOptimizedTable末尾添加元数据更新');
} else {
    console.log('❌ 未找到generateUnifiedHotWarmColdOptimizedTable结束位置');
}

// 写回文件
console.log('\n💾 写入修改...');
fs.writeFileSync(serverPath, content);
console.log('✅ 所有修改已保存到 server.js');

console.log('\n📋 修改摘要:');
console.log('1. 添加了 HWC_Metadata Schema 和 Model（存储min/max期号）');
console.log('2. 优化了 loadHwcCoverageCache（从元数据表读取，毫秒级）');
console.log('3. 在 generateUnifiedHotWarmColdOptimizedTable 末尾添加元数据更新');
console.log('\n⚠️  首次运行需要初始化元数据（会自动执行，仅一次慢查询）');
