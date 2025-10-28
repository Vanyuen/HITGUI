# 测试排除详情记录修复

## 测试步骤

### 1. 启动服务器
```bash
npm start
```

### 2. 创建一个测试任务

通过前端界面或API创建一个小范围的测试任务：
- 期号范围：最近3期
- 启用至少一个排除条件（如热温冷比排除）

### 3. 等待任务完成

查看服务器日志，确认出现以下日志：
```
📝 [sessionId] 记录基础条件排除: XX个组合
⚔️ [sessionId] 相克过滤后: XX个组合 (排除XX个)
🔗 [sessionId] 同出(按红球)过滤后: XX个组合 (排除XX个)
🔥 [sessionId] 热温冷比过滤后: XX个组合 (排除XX个)
```

### 4. 检查数据库

使用MongoDB客户端或以下脚本检查：

```javascript
// check-exclusion-data.js
const mongoose = require('mongoose');

async function check() {
    await mongoose.connect('mongodb://127.0.0.1:27017/lottery');

    const ExclusionDetails = mongoose.model('Test', new mongoose.Schema({}, {strict: false}), 'HIT_DLT_ExclusionDetails');

    const count = await ExclusionDetails.countDocuments();
    console.log(`HIT_DLT_ExclusionDetails 总记录数: ${count}`);

    if (count > 0) {
        const sample = await ExclusionDetails.find().limit(5).lean();
        console.log('\n示例记录:');
        sample.forEach((doc, i) => {
            console.log(`\n记录 ${i + 1}:`);
            console.log(`  任务ID: ${doc.task_id}`);
            console.log(`  期号: ${doc.period}`);
            console.log(`  步骤: ${doc.step}`);
            console.log(`  条件: ${doc.condition}`);
            console.log(`  排除数量: ${doc.excluded_count || doc.excluded_combination_ids?.length || 0}`);
        });
    }

    await mongoose.disconnect();
}

check();
```

### 5. 导出排除详情Excel

1. 在前端找到刚创建的任务
2. 点击"导出排除详情"
3. 选择一个期号
4. 下载Excel文件

### 6. 检查Excel文件

打开导出的Excel文件，应该包含：
- **Sheet1**: 保留的组合 (22列)
- **Sheet2**: 基础条件排除 (17列) - 如果有基础条件排除
- **Sheet3**: 热温冷比排除 (17列) - 如果有热温冷比排除
- **Sheet4**: 相克排除 (17列) - 如果有相克排除
- **Sheet5**: 同出排除(按红球) (17列) - 如果有同出排除

检查每个Sheet的列结构：
- ✅ 序号
- ✅ 组合ID
- ✅ 红球1-5
- ✅ 和值、跨度、区间比、奇偶比、热温冷比、连号组数、最长连号
- ✅ 红球命中
- ✅ 排除原因
- ✅ 排除详情

## 预期结果

### 成功标志

1. ✅ 服务器日志显示"记录基础条件排除"等信息
2. ✅ HIT_DLT_ExclusionDetails集合有数据
3. ✅ Excel导出包含多个Sheet（不只是保留的组合）
4. ✅ 排除表包含17列，包含序号和红球命中
5. ✅ 数据准确，红球命中数正确

### 失败标志

1. ❌ 日志中没有"记录基础条件排除"信息
2. ❌ HIT_DLT_ExclusionDetails集合仍然为空
3. ❌ Excel只有Sheet1（保留的组合）
4. ❌ 排除表列数不对或缺少字段

## 故障排查

### 如果Excel仍然只有1个Sheet

**检查1**: 查看服务器日志，搜索"记录基础条件排除"
- 如果没有，说明recordExclusionDetails没被调用
- 检查batchPredictor.taskId是否设置成功

**检查2**: 查询数据库
```javascript
db.HIT_DLT_ExclusionDetails.find({ task_id: "你的任务ID" })
```
- 如果为空，说明记录失败
- 检查EXCLUSION_DETAILS_CONFIG.enabled是否为true

**检查3**: 检查导出API日志
- 查看"📊 查询到 X 条排除详情记录"
- 查看"📊 排除条件统计"输出

### 如果数据库有数据但Excel没有Sheet

可能是导出代码的问题，检查：
1. excludedByCondition对象是否正确填充
2. conditionNames映射是否包含所有条件
3. for循环是否正确遍历excludedByCondition

## 附加测试

### 测试不同的配对模式

1. **默认模式**: 100红球 × 66蓝球 = 6,600组合
2. **普通无限制**: 324,632红球，1:1蓝球配对
3. **真正无限制**: 324,632红球 × 66蓝球 = 21,445,712组合

### 测试不同的排除条件

1. 仅基础条件
2. 仅热温冷比
3. 仅相克
4. 仅同出
5. 组合多个条件

---

## 修复总结

本次修复包含两部分：

### Part 1: Excel列结构修复
- 新增excludedColumns定义（17列）
- 添加序号和红球命中字段
- 不包含蓝球相关列

### Part 2: recordExclusionDetails调用修复
- 在executePredictionTask中设置batchPredictor.taskId
- 在processSingleIssue中从this.taskId获取taskId
- 在每个排除步骤后调用recordExclusionDetails

**关键代码位置**:
- `src/server/server.js:15197` - 设置batchPredictor.taskId
- `src/server/server.js:11019-11020` - 生成actualTaskId和actualResultId
- `src/server/server.js:11128-11136` - 记录基础条件排除
- `src/server/server.js:11143-11150` - 记录相克排除
- `src/server/server.js:11242-11249` - 记录同出排除
- `src/server/server.js:11325-11332` - 记录热温冷比排除
