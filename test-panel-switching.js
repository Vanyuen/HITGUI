/**
 * 测试区间比分析面板切换功能
 *
 * 使用方法：
 * 1. 手动启动应用 (npm start)
 * 2. 打开开发者工具 (F12)
 * 3. 在Console中粘贴并执行此脚本的全部内容
 */

console.log('='.repeat(60));
console.log('🧪 测试：区间比分析面板切换功能');
console.log('='.repeat(60));

//  1. 检查页面元素
console.log('\n📍 步骤1: 检查页面元素...');

const statsSubNav = document.querySelector('.stats-sub-nav');
const hwcButton = document.querySelector('.stats-sub-nav-btn[data-panel="hwc-analysis"]');
const zoneButton = document.querySelector('.stats-sub-nav-btn[data-panel="zone-analysis"]');
const hwcPanel = document.getElementById('hwc-analysis-panel');
const zonePanel = document.getElementById('zone-analysis-panel');

console.log('  - 子导航容器:', statsSubNav ? '✅ 找到' : '❌ 未找到');
console.log('  - 热温冷比按钮:', hwcButton ? '✅ 找到' : '❌ 未找到');
console.log('  - 区间比按钮:', zoneButton ? '✅ 找到' : '❌ 未找到');
console.log('  - 热温冷比面板:', hwcPanel ? '✅ 找到' : '❌ 未找到');
console.log('  - 区间比面板:', zonePanel ? '✅ 找到' : '❌ 未找到');

if (!zoneButton || !hwcPanel || !zonePanel) {
    console.error('❌ 缺少必要元素，无法继续测试！');
    console.log('\n💡 提示：请确保已导航到"大乐透 → 统计关系"页面');
    console.log('='.repeat(60));
} else {
    // 2. 检查当前状态
    console.log('\n📍 步骤2: 检查当前面板状态...');
    console.log('  - 热温冷比按钮active:', hwcButton.classList.contains('active') ? '是' : '否');
    console.log('  - 区间比按钮active:', zoneButton.classList.contains('active') ? '是' : '否');
    console.log('  - 热温冷比面板active:', hwcPanel.classList.contains('active') ? '是' : '否');
    console.log('  - 区间比面板active:', zonePanel.classList.contains('active') ? '是' : '否');

    // 3. 模拟点击区间比按钮
    console.log('\n📍 步骤3: 模拟点击"区间比分析"按钮...');
    zoneButton.click();

    // 等待一小段时间让DOM更新
    setTimeout(() => {
        console.log('\n📍 步骤4: 检查点击后的状态...');
        console.log('  - 热温冷比按钮active:', hwcButton.classList.contains('active') ? '是' : '否');
        console.log('  - 区间比按钮active:', zoneButton.classList.contains('active') ? '是' : '否');
        console.log('  - 热温冷比面板active:', hwcPanel.classList.contains('active') ? '是' : '否');
        console.log('  - 区间比面板active:', zonePanel.classList.contains('active') ? '是' : '否');

        // 5. 验证结果
        console.log('\n📍 步骤5: 验证测试结果...');
        const success =
            !hwcButton.classList.contains('active') &&
            zoneButton.classList.contains('active') &&
            !hwcPanel.classList.contains('active') &&
            zonePanel.classList.contains('active');

        if (success) {
            console.log('\n✅✅✅ 测试通过！面板切换功能正常工作！');
            console.log('\n📝 功能已验证：');
            console.log('  ✓ 区间比按钮已激活');
            console.log('  ✓ 热温冷比按钮已失活');
            console.log('  ✓ 区间比面板已显示');
            console.log('  ✓ 热温冷比面板已隐藏');
        } else {
            console.log('\n❌❌❌ 测试失败！面板切换不正常！');
            console.log('\n🔍 问题诊断：');
            if (hwcButton.classList.contains('active')) {
                console.log('  ❌ 热温冷比按钮仍然是active状态');
            }
            if (!zoneButton.classList.contains('active')) {
                console.log('  ❌ 区间比按钮没有变成active状态');
            }
            if (hwcPanel.classList.contains('active')) {
                console.log('  ❌ 热温冷比面板仍然可见');
            }
            if (!zonePanel.classList.contains('active')) {
                console.log('  ❌ 区间比面板没有显示');
            }
            console.log('\n💡 可能的原因：');
            console.log('  1. Electron缓存了旧的JavaScript代码');
            console.log('  2. 事件监听器没有正确绑定');
            console.log('  3. CSS类切换逻辑有问题');
        }

        console.log('\n' + '='.repeat(60));
    }, 100);
}
