# MongoDB高占用问题 - 完整分析与优化方案

## 📊 诊断结果总结

### 当前状态
- **MongoDB内存占用**: 9.2 GB 常驻内存 + 20.7 GB 虚拟内存
- **数据库总大小**: 12.7 GB (数据) + 3.7 GB (索引)
- **连接数**: 303 个 (异常高，正常应为10-50)
- **WiredTiger缓存**: 9.4 GB / 15.8 GB

---

## 🎯 核心问题定位

### 问题1: 热温冷比优化表体积巨大 ⭐最严重

**集合名**: `hit_dlt_redcombinationshotwarmcoldoptimizeds`

| 指标 | 数值 | 说明 |
|------|------|------|
| 数据大小 | 9.1 GB | 占总数据70% |
| 存储大小 | 5.3 GB | 磁盘实际占用 |
| 文档数 | 2,788 条 | 每期一条 |
| 平均文档大小 | **3.42 MB** | 每个文档超大 |
| 索引数 | 4 个 | 正常 |

**数据结构分析**:
```javascript
{
  _id: ObjectId("..."),
  base_issue: "7001",           // 基准期号
  target_issue: "7002",         // 目标期号
  hot_warm_cold_data: {
    "5:0:0": [1, 2, 3, ...],    // 每个热温冷比对应一个组合ID数组
    "4:1:0": [10, 20, ...],
    "3:2:0": [100, 200, ...],
    // ... 约15-20个热温冷比
    // 每个比例可能包含数万个组合ID
  },
  total_combinations: 324632
}
```

**为什么体积这么大？**

1. **每个文档存储324,632个组合ID**
   - 每个ID: 4 bytes (Number类型)
   - 324,632 × 4 = 1.3 MB (纯ID数据)
   - 加上Map结构开销和BSON格式 = **3.4 MB/文档**

2. **2,788个文档**
   - 2,788期历史数据 × 3.4 MB = **9.1 GB**

3. **这是"预处理优化"的设计目的**
   - **问题背景**: 实时计算热温冷比导致批量预测多期时内存不足、运行慢
   - **优化策略**: 预先计算所有组合的热温冷比，存储到数据库
   - **查询性能**: 从3-5秒降至0.5-1秒 (3-5倍提升)
   - **代价**: 占用9.1 GB存储空间

---

### 问题2: 排除详情表索引过多

**集合名**: `hit_dlt_exclusiondetails`

| 指标 | 数值 |
|------|------|
| 数据大小 | 3.4 GB |
| **索引大小** | **3.7 GB** (超过数据本身!) |
| 文档数 | 6,955 条 |
| 索引数 | **10 个** (过多) |

**索引列表**:
1. `_id` (默认)
2. `task_id`
3. `issue_pair`
4. `created_at`
5. `sum_condition` ← 可删除
6. `span_condition` ← 可删除
7. `zone_ratio_condition` ← 可删除
8. `odd_even_ratio_condition` ← 可删除
9. `hot_warm_cold_condition` ← 可删除
10. 其他...

**问题**: 条件字段索引很少用于查询，却占用大量空间

---

### 问题3: 红球组合表冗余索引

**集合名**: `hit_dlt_redcombinations`

| 指标 | 数值 |
|------|------|
| 索引数 | **17 个** (严重过多) |
| 索引大小 | 25.87 MB |
| 文档数 | 324,632 |

**冗余索引对**:
- `sum` 和 `sum_value` (重复)
- `sumRange` 和 `sum_value` (重复)
- `zoneRatio` 和 `zone_ratio` (重复)
- `evenOddRatio` 和 `odd_even_ratio` (重复)
- `consecutiveCount` 和其他连号字段 (重复)

**问题**: 字段重命名后未删除旧索引，导致双倍索引

---

### 问题4: 连接数异常高

**当前状态**:
- 连接数: **303 个**
- 正常值: 10-50 个

**原因推测**:
1. 连接池配置未限制最大连接数
2. 连接未正确关闭，出现泄漏
3. Electron应用多次重启导致旧连接未释放

---

## 💡 优化方案对比

### 方案A: 保守优化 (推荐) ✅

**核心思想**: 保留热温冷比优化表，仅优化次要问题

**优化内容**:
1. ✅ 删除冗余索引 (释放 ~15 MB)
2. ✅ 优化排除详情索引 (释放 ~1.5 GB)
3. ✅ 修复连接池配置 (连接数降至10-20)
4. ✅ 配置WiredTiger缓存限制 (限制为4GB)
5. ✅ 清理旧的排除详情数据 (保留最近30天)

**预期效果**:
- MongoDB内存占用: 9.2 GB → **4-5 GB** (减少50%)
- 连接数: 303 → **10-20** (正常)
- 功能影响: **无** (批量预测性能保持不变)
- 风险等级: **低** 🟢

---

### 方案B: 激进优化 (高风险) ⚠️

**核心思想**: 删除热温冷比优化表，改用智能缓存策略

**优化内容**:
1. ❌ 删除整个热温冷比优化表 (释放 5.3 GB)
2. 🔄 实施以下三选一策略:

#### 策略B1: Redis缓存 + 实时计算
```javascript
// 使用Redis缓存热门期号的热温冷数据
// TTL: 1小时，自动过期
const cacheKey = `hwc:${baseIssue}:${targetIssue}`;
let hwcData = await redis.get(cacheKey);

if (!hwcData) {
  // 实时计算并缓存
  hwcData = await calculateHotWarmColdData(baseIssue, targetIssue);
  await redis.setex(cacheKey, 3600, JSON.stringify(hwcData));
}
```

**优势**:
- 释放5.3GB MongoDB存储
- 热门查询仍然快速 (Redis内存访问)

**劣势**:
- 需要安装Redis
- 首次查询变慢 (实时计算)
- 冷门期号每次都要计算

---

#### 策略B2: 按需生成 + LRU缓存
```javascript
// 使用Node.js的LRU缓存 (如 lru-cache)
const cache = new LRUCache({
  max: 100,  // 最多缓存100期数据
  maxSize: 500 * 1024 * 1024,  // 最大500MB
  sizeCalculation: (value) => JSON.stringify(value).length
});

async function getHotWarmColdData(baseIssue, targetIssue) {
  const key = `${baseIssue}:${targetIssue}`;

  if (cache.has(key)) {
    return cache.get(key);
  }

  // 实时计算
  const data = await calculateHotWarmColdData(baseIssue, targetIssue);
  cache.set(key, data);
  return data;
}
```

**优势**:
- 无需外部依赖
- 自动淘汰不常用数据
- 内存占用可控 (最多500MB)

**劣势**:
- 应用重启后缓存丢失
- 并发请求可能重复计算

---

#### 策略B3: 分期存储 + 延迟加载
```javascript
// 不在一个文档存储所有组合ID，改为按热温冷比分别存储
{
  base_issue: "7001",
  target_issue: "7002",
  ratio: "3:2:0",  // 单个热温冷比
  combination_ids: [1, 15, 89, ...],  // 该比例的组合ID
  count: 78456
}

// 查询时只加载需要的热温冷比
const ratiosToQuery = ["3:2:0", "2:2:1", "2:3:0"];
const hwcDocs = await HWCTable.find({
  base_issue: "7001",
  target_issue: "7002",
  ratio: { $in: ratiosToQuery }
});
```

**优势**:
- 仍然使用MongoDB (无需Redis)
- 按需加载，减少单次查询数据量
- 总存储空间相同，但查询更灵活

**劣势**:
- 文档数量大幅增加 (2,788 → 约50,000)
- 需要重构数据生成逻辑
- 索引维护成本增加

---

### 方案B的整体评估

| 策略 | 释放空间 | 查询速度 | 开发成本 | 运维成本 | 风险等级 |
|------|---------|---------|---------|---------|---------|
| **B1: Redis缓存** | 5.3 GB | 首次慢，后续快 | 中 | 高 (需维护Redis) | 🟡 中 |
| **B2: LRU缓存** | 5.3 GB | 首次慢，后续快 | 低 | 低 | 🟢 低 |
| **B3: 分期存储** | 0 GB | 略慢 | 高 | 中 | 🟡 中 |

**⚠️ 批量预测性能影响**:

| 场景 | 当前 (优化表) | B1 (Redis) | B2 (LRU) | B3 (分期) |
|------|-------------|-----------|---------|----------|
| 预测1期 (热门) | 0.5s | 0.5s (缓存命中) | 0.5s (缓存命中) | 0.8s |
| 预测1期 (冷门) | 0.5s | 3-5s (实时计算) | 3-5s (实时计算) | 0.8s |
| 预测20期 | 10s | 15-60s (多次实时计算) | 15-60s (多次实时计算) | 16s |
| 预测100期 | 50s | 300s+ (大量实时计算) | 300s+ (大量实时计算) | 80s |

**结论**: 方案B会显著降低批量预测性能 ❌

---

## 🎯 最终推荐方案

### 推荐: 方案A (保守优化)

**理由**:
1. ✅ **保留核心优化**: 热温冷比预处理表是解决批量预测性能的关键
2. ✅ **显著减少内存**: 仍可减少50%内存占用 (9.2GB → 4-5GB)
3. ✅ **零功能影响**: 批量预测性能保持不变
4. ✅ **低风险**: 不涉及核心逻辑改动
5. ✅ **快速实施**: 1-2小时即可完成

**不建议方案B的原因**:
1. ❌ **违背原设计初衷**: 当初就是因为实时计算太慢才做的预处理优化
2. ❌ **批量预测性能下降**: 20期从10秒退化到15-60秒
3. ❌ **开发成本高**: 需要重构大量代码并充分测试
4. ❌ **性价比低**: 释放5.3GB空间的代价太大

---

## 📋 方案A详细实施步骤

### 第一步: 删除冗余索引 (15分钟)

```javascript
// 连接到MongoDB
use lottery

// 删除hit_dlt_redcombinations的冗余索引
db.hit_dlt_redcombinations.dropIndex("sum_1")
db.hit_dlt_redcombinations.dropIndex("sumRange_1")
db.hit_dlt_redcombinations.dropIndex("zoneRatio_1")
db.hit_dlt_redcombinations.dropIndex("evenOddRatio_1")
db.hit_dlt_redcombinations.dropIndex("consecutiveCount_1")
db.hit_dlt_redcombinations.dropIndex("consecutive_groups_1")
db.hit_dlt_redcombinations.dropIndex("max_consecutive_length_1")

// 保留的有效索引:
// - _id
// - combination_id
// - sum_value (新)
// - span_value
// - zone_ratio (新)
// - odd_even_ratio (新)
// - combo_2, combo_3, combo_4
// - acValue
```

**预期效果**: 释放约15 MB，减少写入开销

---

### 第二步: 优化排除详情索引 (30分钟)

```javascript
// 删除不常用的条件字段索引
db.hit_dlt_exclusiondetails.dropIndex("sum_condition_1")
db.hit_dlt_exclusiondetails.dropIndex("span_condition_1")
db.hit_dlt_exclusiondetails.dropIndex("zone_ratio_condition_1")
db.hit_dlt_exclusiondetails.dropIndex("odd_even_ratio_condition_1")
db.hit_dlt_exclusiondetails.dropIndex("hot_warm_cold_condition_1")

// 保留核心索引:
// - _id
// - task_id (常用查询)
// - issue_pair (常用查询)
// - created_at (用于清理旧数据)
```

**预期效果**: 释放约1.5 GB

---

### 第三步: 修复连接池配置 (15分钟)

编辑 `src/database/config.js`:

```javascript
// 修改前
mongoose.connect(MONGODB_URI);

// 修改后
mongoose.connect(MONGODB_URI, {
  maxPoolSize: 10,        // 限制最大连接数为10
  minPoolSize: 2,         // 最小连接数2
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4               // 强制使用IPv4
});
```

**预期效果**: 连接数从303降至10-20

---

### 第四步: 配置WiredTiger缓存限制 (30分钟)

找到MongoDB配置文件 (通常在 `C:\Program Files\MongoDB\Server\<version>\bin\mongod.cfg`)

添加或修改:

```yaml
storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 4  # 限制缓存为4GB (原15.8GB)
```

重启MongoDB服务:
```powershell
net stop MongoDB
net start MongoDB
```

**预期效果**: WiredTiger缓存从15.8GB降至4GB

---

### 第五步: 清理旧排除详情数据 (可选)

```javascript
// 删除30天前的排除详情记录
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - 30);

db.hit_dlt_exclusiondetails.deleteMany({
  created_at: { $lt: cutoffDate }
});

// 查看删除结果
db.hit_dlt_exclusiondetails.countDocuments()
```

**预期效果**: 进一步减少数据大小

---

## 📊 优化后预期效果

| 指标 | 优化前 | 优化后 (方案A) | 改善 |
|------|--------|---------------|------|
| MongoDB内存占用 | 9.2 GB | 4-5 GB | ⬇️ 50% |
| 连接数 | 303 | 10-20 | ⬇️ 95% |
| 索引大小 | 3.7 GB | 2.2 GB | ⬇️ 40% |
| 批量预测性能 | 10秒/20期 | 10秒/20期 | ✅ 不变 |
| 功能完整性 | 100% | 100% | ✅ 无影响 |

---

## ⚠️ 重要注意事项

### 关于热温冷比优化表

**请勿删除此表！** 理由:

1. **历史背景**: 当初就是因为实时计算导致"批量预测多期时内存不足、运行慢"
2. **性能差异**:
   - 有优化表: 0.5-1秒/期
   - 无优化表: 3-5秒/期 (实时计算)
   - 批量20期: 10秒 vs 60秒+
3. **用户体验**: 批量预测是核心功能，性能退化不可接受
4. **存储成本**: 9GB存储空间换取5-10倍性能提升，是值得的

### 如果实在需要释放空间

**替代方案**: 只保留最近200期的热温冷数据

```javascript
// 查询最新期号
const latestIssue = await DLT.findOne().sort({ Issue: -1 });

// 计算200期前的期号
const cutoffIssue = (parseInt(latestIssue.Issue) - 200).toString();

// 删除旧数据
await DLTRedCombinationsHotWarmColdOptimized.deleteMany({
  target_issue: { $lt: cutoffIssue }
});
```

**效果**:
- 从2,788期降至200期
- 存储从9.1GB降至约650MB
- 释放约8.5GB空间
- 常用数据仍然保留

---

## 🚀 下一步行动

### 请确认以下问题:

1. **是否执行方案A (保守优化)?**
   - [ ] 是，执行全部5个步骤 (推荐)
   - [ ] 是，但跳过WiredTiger缓存限制
   - [ ] 否，我想考虑方案B

2. **是否清理旧的热温冷数据 (只保留200期)?**
   - [ ] 是，释放8.5GB空间
   - [ ] 否，保留全部2,788期数据

3. **是否需要备份数据库?**
   - [ ] 是，先备份再优化 (推荐)
   - [ ] 否，直接优化

4. **是否需要我生成可执行的优化脚本?**
   - [ ] 是，生成Node.js脚本
   - [ ] 是，生成MongoDB Shell脚本
   - [ ] 否，我手动执行

---

## 📝 总结

**核心结论**: 热温冷比优化表占用9.1GB是**合理的性能优化代价**，不应删除。

**推荐行动**: 执行方案A的其他优化措施，可将内存占用从9.2GB降至4-5GB，同时保持批量预测的高性能。

**如需进一步优化**: 考虑只保留最近200期热温冷数据，可额外释放8.5GB空间。

---

**文档版本**: v1.0
**创建时间**: 2025-10-27
**分析工具**: diagnose-mongodb-usage.js
**待用户确认后实施**
