# Sticky 导航问题深度诊断

## DOM 结构树

```
body (overflow: auto) ← 应该是滚动容器
└─ .container (display: flex, flex-direction: column)
   ├─ nav.nav-bar (position: sticky, top: 0, z-index: 100)
   │  ├─ .nav-logo "HIT"
   │  └─ .nav-menu
   │     ├─ button.nav-item "双色球"
   │     └─ button.nav-item "大乐透"
   │
   └─ main.main-content (flex: 1, overflow: visible, position: relative)
      └─ div#ssq-panel.panel (overflow: visible, min-height: 100%)
         ├─ div.sub-nav (position: sticky, top: 60px, z-index: 99) ← 问题所在
         │  ├─ button.sub-nav-item "往期开奖"
         │  ├─ button.sub-nav-item "走势图"
         │  └─ ...
         │
         └─ div.panel-container (flex: 1, overflow: visible, position: relative)
            └─ div.panel-content (overflow: visible, min-height: 100%)
               ├─ .content-header
               └─ .content-body
                  └─ 实际内容
```

## CSS 属性清单

### 1. body
```css
overflow: auto;  ← 滚动容器
height: 100%;
```

### 2. .container
```css
display: flex;
flex-direction: column;
width: 100%;
min-height: 100vh;
```

### 3. .nav-bar（主导航）
```css
position: sticky;  ← 工作正常
top: 0;
z-index: 100;
height: 60px;
background: #fff;
padding: 15px 30px;
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
```

### 4. .main-content
```css
flex: 1;
min-height: calc(100vh - 60px);
overflow: visible;  ← 已改为visible
position: relative;
```

### 5. .panel
```css
width: 100%;
background: #fff;
display: none / flex (when active);
flex-direction: column;
overflow: visible;  ← 已改为visible
min-height: 100%;
```

### 6. .sub-nav（子导航 - 问题所在）
```css
position: sticky;  ← 不工作
top: 60px;
z-index: 99;
padding: 15px 30px;
background: #f8f9fa;
border-bottom: 1px solid #e9ecef;
margin: 0;
```

### 7. .panel-container
```css
flex: 1;
overflow: visible;
position: relative;
```

### 8. .panel-content
```css
width: 100%;
display: none / flex (when active);
flex-direction: column;
overflow: visible;
min-height: 100%;
```

## Sticky 定位的工作原理

**关键规则：**
1. `position: sticky` 元素相对于**最近的具有滚动机制的祖先元素**定位
2. 滚动机制 = `overflow: auto/scroll/hidden` (不包括 `visible`)
3. 如果没有滚动祖先，则相对于视口（viewport）

## 问题分析

### 预期行为
- `.nav-bar` sticky 相对于 body（因为 body 有 `overflow: auto`）✅
- `.sub-nav` sticky 应该相对于 body（因为所有中间容器都是 `overflow: visible`）✅

### 实际行为
- `.nav-bar` 正常工作 ✅
- `.sub-nav` 随滚动上移并消失 ❌

### 可能的原因

1. **`.panel` 的 `min-height: 100%` 问题**
   - `min-height: 100%` 需要父元素有明确的高度
   - `.main-content` 使用 `flex: 1`，高度可能不确定

2. **`.panel-container` 的 `position: relative` 可能干扰**
   - relative 定位可能影响 sticky 的参照系

3. **`.panel` 没有明确的父级高度参照**
   - `min-height: 100%` 在 flex 容器中可能不生效

4. **可能存在其他隐藏的 overflow 设置**
   - 需要检查是否有其他 CSS 文件覆盖

## 需要验证的点

1. 检查是否有其他CSS文件（dlt-styles.css, scrollbar-fix.css）影响布局
2. 使用开发者工具实际查看 `.sub-nav` 的 sticky 容器是谁
3. 检查 `.panel` 的实际渲染高度是否正确
4. 验证所有祖先元素的 overflow 计算值（computed value）
