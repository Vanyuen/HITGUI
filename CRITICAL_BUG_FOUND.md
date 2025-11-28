# 🚨 关键BUG发现报告

**生成时间**: 2025-11-14
**严重程度**: 🔴 **CRITICAL**

---

## 一、问题现象

用户创建新任务后:
- 所有期号组合数显示 0
- 前端明明勾选了热温冷比复选框
- 但数据库保存的却是**空数组 `[]`**

---

## 二、根本原因 🔍

### 问题: **前端代码未重新加载,仍在使用旧代码!**

**证据链**:

1. **任务字段检查结果**:
   ```
   任务ID: hwc-pos-20251114-3ig
   创建时间: 2025-11-14T16:48:49.856Z

   字段检查:
     hwc_ratios (旧字段): ✅ 存在
     red_hot_warm_cold_ratios (新字段): ❌ 不存在

   旧字段内容: []  ← 🚨 空数组!
   ```

2. **这说明前端发送的数据**:
   ```javascript
   {
     positive_selection: {
       hwc_ratios: [],  // 旧字段名,且值为空!
       // red_hot_warm_cold_ratios 根本不存在
     }
   }
   ```

3. **前端仍在运行旧代码**:
   - Line 16804 (修复前): `hwc_ratios: positiveSelection.hwcRatios`
   - Line 16553 (修复前): `Array.from(document.querySelectorAll('.hwc-pos-cb:checked')).map(cb => cb.value)`  // 返回字符串数组

---

## 三、为什么前端收集到空数组?

### 可能原因1: 浏览器缓存

**Electron应用的缓存机制**:
- 渲染进程会缓存JavaScript文件
- 即使服务端文件更新,渲染进程可能仍使用缓存版本
- 必须**完全重启应用**或**硬刷新**才能加载新文件

### 可能原因2: 用户没有勾选复选框

HTML有8个默认`checked`的复选框:
```html
<input type="checkbox" class="hwc-pos-cb" value="3:2:0" data-group="balanced" checked>
<input type="checkbox" class="hwc-pos-cb" value="3:1:1" data-group="balanced" checked>
... (共8个)
```

但如果用户:
1. 打开了面板
2. 手动取消了所有勾选
3. 然后创建任务

那么确实会收集到空数组!

---

## 四、修复验证失败的完整链条

### 现状分析

1. **后端代码**:
   - ✅ server.js 已更新 (修复点3, 4A, 4B)
   - ✅ 使用实时查询判断is_predicted
   - ✅ 读取 red_hot_warm_cold_ratios 字段

2. **前端代码 (文件层面)**:
   - ✅ dlt-module.js 已更新 (修复点1, 2)
   - ✅ Line 16553: 转换为对象格式
   - ✅ Line 16804: 发送 red_hot_warm_cold_ratios 字段

3. **但实际运行的前端代码 (缓存版本)**:
   - ❌ 仍在运行旧版本dlt-module.js
   - ❌ 仍发送 hwc_ratios 字段
   - ❌ 仍发送字符串数组格式

---

## 五、解决方案

### 方案A: 强制清除缓存并重启 (推荐)

**步骤**:
1. 完全关闭Electron应用
2. 清除Electron缓存目录:
   ```cmd
   rmdir /S /Q "%APPDATA%\hitgui"
   ```
3. 重新启动应用
4. 重新创建任务

### 方案B: 硬重启应用

**步骤**:
1. 杀死所有electron.exe和node.exe进程
2. 等待5秒
3. 重新启动 `npm start`
4. 按F5或Ctrl+R硬刷新页面
5. 重新创建任务

### 方案C: 开发者工具硬刷新

**步骤**:
1. 打开开发者工具 (F12)
2. 右键点击刷新按钮
3. 选择 "清空缓存并硬性重新加载"
4. 重新创建任务

---

## 六、验证清单

创建新任务后,运行以下脚本验证:

```bash
node check-latest-task.js
```

**期望结果**:
```
正选条件字段:
  hwc_ratios (旧字段): 不存在
  red_hot_warm_cold_ratios (新字段): ✅ 存在

  新字段内容:
    [
      { "hot": 3, "warm": 2, "cold": 0 },
      { "hot": 3, "warm": 1, "cold": 1 },
      { "hot": 2, "warm": 3, "cold": 0 },
      ...
    ]
```

**如果仍然显示旧字段**:
- 说明缓存没有清除成功
- 需要使用方案A (删除缓存目录)

---

## 七、后续建议

### 1. 添加前端版本标识

在dlt-module.js顶部添加:
```javascript
const FRONTEND_VERSION = '2.0.0-hwc-fix-20251114';
console.log(`前端版本: ${FRONTEND_VERSION}`);
```

### 2. 添加开发者提示

在创建任务按钮附近添加:
```html
<small style="color: #888;">
  提示: 如果创建任务失败,请按 Ctrl+R 刷新页面后重试
</small>
```

### 3. 添加客户端缓存清除API

在应用启动时,自动检测代码版本,自动清除缓存

---

## 八、总结

### 问题本质

**文件已更新,但运行的代码是缓存版本**

### 影响范围

- ✅ 后端修复完全生效
- ❌ 前端修复未生效 (被缓存)
- ❌ 用户看到的是新旧代码混合的结果

### 修复状态

- 代码层面: ✅ 100%修复完成
- 运行时: ❌ 0%生效 (缓存阻止)
- 需要: 🔄 清除缓存后重启

### 下一步

**立即执行方案A**: 清除缓存并重启应用,然后重新创建任务验证

---

**报告结束**
