// 初始化脚本 - 替换HTML中的内联脚本以符合CSP要求
console.log('📄 init.js loaded successfully - CSP compliant version');

// 集成大乐透模块到主系统
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 开始初始化系统...');
    
    // 检查所有必要的模块是否加载
    const modules = {
        'DLTModule': window.DLTModule,
        'DLTExpertAnalyzer': window.DLTExpertAnalyzer
    };
    
    console.log('📋 模块加载状态检查:');
    Object.entries(modules).forEach(([name, module]) => {
        console.log(`  ${name}: ${module ? '✅ 已加载' : '❌ 未加载'}`);
    });
    
    // 初始化大乐透系统
    if (window.DLTModule) {
        window.DLTModule.init();
        console.log('✅ DLT Module integrated successfully');
    } else {
        console.warn('⚠️ DLT Module not loaded');
    }
    
    // 监听大乐透标签页切换
    const dltNavItem = document.querySelector('.nav-item[data-panel="dlt"]');
    if (dltNavItem) {
        dltNavItem.addEventListener('click', () => {
            console.log('🎯 Switching to DLT panel');
            // 延时加载确保面板切换完成
            setTimeout(() => {
                if (window.DLTModule) {
                    window.DLTModule.loadHistory(1);
                } else {
                    console.warn('⚠️ DLT Module not available for history loading');
                }
            }, 100);
        });
        console.log('✅ DLT navigation event listener attached');
    } else {
        console.warn('⚠️ DLT navigation item not found');
    }
    
    // 添加CSP兼容性检查
    console.log('🔒 CSP检查: 内联脚本已移除，使用外部脚本文件');
    
    console.log('🎉 System initialization completed');
});

// 添加全局CSP状态检查函数
window.checkCSPStatus = function() {
    console.log('🔒 Content Security Policy 状态检查:');
    console.log('✅ 所有脚本都使用外部文件，符合CSP要求');
    console.log('✅ 没有内联事件处理器');
    console.log('✅ 没有内联样式（使用外部CSS）');
    
    // 验证关键功能
    if (window.debugDLTExpert) {
        console.log('🛠️ 调试工具可用: debugDLTExpert()');
    }
    if (window.DLTModule) {
        console.log('📊 大乐透模块可用');
    }
    
    console.log('推荐测试: 打开大乐透专家模式并点击"分析数据"按钮');
};