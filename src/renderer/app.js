document.addEventListener('DOMContentLoaded', () => {
    console.log('App.js loaded at:', new Date().toISOString());
    // 初始化页面状态恢复
    restorePageState();
    
    // 强制检查hit_dlts组合预测面板并初始化（备用方案）
    setTimeout(() => {
        const dltCombinationPanel = document.getElementById('dlt-combination');
        if (dltCombinationPanel && dltCombinationPanel.classList.contains('active')) {
            console.log('🎯 页面加载时检测到hit_dlts组合预测面板已激活，强制初始化...');
            if (typeof initDLTCombinationModule === 'function') {
                console.log('⚡ 强制执行initDLTCombinationModule()...');
                initDLTCombinationModule();
            } else {
                console.log('⚠️ initDLTCombinationModule函数不存在，等待模块加载...');
                // 再等待一下然后重试
                setTimeout(() => {
                    if (typeof initDLTCombinationModule === 'function') {
                        console.log('⚡ 延迟执行initDLTCombinationModule()...');
                        initDLTCombinationModule();
                    } else {
                        console.error('❌ hit_dlts模块加载失败！');
                    }
                }, 2000);
            }
        }
    }, 1000);
    
    // 初始化主导航事件监听
    initMainNavigation();
    // 初始化子导航事件监听
    initSubNavigation();
    // 初始化刷新按钮事件监听
    initRefreshButtons();
    // 初始化分页事件监听
    initPagination();
    // 初始化走势图按钮事件
    initTrendButtons();

    // 初始化双色球缩放控制
    initSSQZoomControls();

    // 初始化大乐透系统
    if (typeof DLTModule !== 'undefined' && DLTModule.init) {
        DLTModule.init();
    } else {
        // 如果hit_dlts模块还没加载，延迟初始化
        setTimeout(() => {
            if (typeof DLTModule !== 'undefined' && DLTModule.init) {
                console.log('延迟初始化大乐透系统');
                DLTModule.init();
            }
        }, 1000);
    }
    
    // 检查是否有保存的状态，如果没有则加载默认内容
    const savedState = getPageState();
    if (!savedState.mainPanel) {
        // 没有保存状态，加载默认内容（双色球-往期开奖）
        loadSSQContent('history');
    }

    // 如果URL中包含走势图标识，加载走势图
    if (window.location.hash === '#trend' || document.querySelector('.sub-nav-item[data-content="trend"].active')) {
        const trendContent = document.getElementById('ssq-trend');
        if (trendContent) {
            document.querySelectorAll('.panel-content').forEach(content => {
                content.classList.remove('active');
            });
            trendContent.classList.add('active');
            loadTrendData();
        }
    }

    // 初始化预选行事件
    initPreSelectRows();
    
    // 初始化大乐透预选行事件
    if (window.DLTModule && typeof window.DLTModule === 'object') {
        // 确保hit_dlts模块已加载，然后初始化预选功能
        setTimeout(() => {
            if (typeof initDLTPreSelectRows === 'function') {
                initDLTPreSelectRows();
            }
        }, 100);
    }
    
    // 添加页面刷新监听器，确保状态保持
    window.addEventListener('beforeunload', () => {
        savePageState();
    });
    
    // 监听F5刷新
    window.addEventListener('keydown', (e) => {
        if (e.key === 'F5' || (e.ctrlKey && e.key === 'r')) {
            e.preventDefault(); // 阻止默认行为
            savePageState();
            location.reload(); // 重新加载页面
        }
        // Ctrl+Shift+R 强制刷新（忽略缓存）
        if (e.ctrlKey && e.shiftKey && e.key === 'R') {
            e.preventDefault();
            savePageState();
            location.reload(true); // 强制从服务器重新加载
        }
    });
});

// 页面状态管理
function savePageState() {
    const state = {
        mainPanel: null,
        subPanel: null,
        timestamp: Date.now()
    };
    
    // 获取当前激活的主面板
    const activeMainNav = document.querySelector('.nav-item.active');
    if (activeMainNav) {
        state.mainPanel = activeMainNav.dataset.panel;
        
        // 获取当前主面板下激活的子面板
        const activeMainPanel = document.querySelector('.panel.active');
        if (activeMainPanel) {
            const activeSubNav = activeMainPanel.querySelector('.sub-nav-item.active');
            if (activeSubNav) {
                state.subPanel = activeSubNav.dataset.content;
            }
        }
    }
    
    localStorage.setItem('hit-page-state', JSON.stringify(state));
}

function getPageState() {
    try {
        const stateStr = localStorage.getItem('hit-page-state');
        if (stateStr) {
            const state = JSON.parse(stateStr);
            // 检查状态是否过期（24小时）
            if (Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
                return state;
            }
        }
    } catch (error) {
        console.error('Error reading page state:', error);
    }
    return {};
}

function restorePageState() {
    const savedState = getPageState();
    
    if (savedState.mainPanel) {
        // 恢复主面板状态
        const mainNavItem = document.querySelector(`.nav-item[data-panel="${savedState.mainPanel}"]`);
        if (mainNavItem) {
            // 移除所有主导航激活状态
            document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
            // 激活保存的主导航
            mainNavItem.classList.add('active');
            
            // 隐藏所有面板
            document.querySelectorAll('.panel').forEach(panel => panel.classList.remove('active'));
            // 显示保存的面板
            const targetPanel = document.getElementById(savedState.mainPanel + '-panel');
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        }
    }
    
    if (savedState.subPanel) {
        // 延时恢复子面板状态，确保DOM已经准备好
        setTimeout(() => {
            // 先确定当前激活的面板
            const activePanel = document.querySelector('.panel.active');
            if (!activePanel) return;
            
            // 在激活面板内查找对应的子导航项
            const subNavItem = activePanel.querySelector(`.sub-nav-item[data-content="${savedState.subPanel}"]`);
            if (subNavItem) {
                // 移除当前面板内所有子导航激活状态
                activePanel.querySelectorAll('.sub-nav-item').forEach(nav => nav.classList.remove('active'));
                // 激活保存的子导航
                subNavItem.classList.add('active');
                
                // 隐藏当前面板内所有内容
                activePanel.querySelectorAll('.panel-content').forEach(content => content.classList.remove('active'));
                
                // 显示保存的内容面板
                let targetContentId;
                if (savedState.mainPanel === 'dlt') {
                    targetContentId = savedState.subPanel; // 大乐透直接使用 content 值
                } else {
                    targetContentId = `ssq-${savedState.subPanel}`; // 双色球需要前缀
                }
                
                const targetContent = document.getElementById(targetContentId);
                if (targetContent) {
                    targetContent.classList.add('active');
                    
                    // 根据面板类型加载对应数据
                    if (savedState.mainPanel === 'dlt') {
                        if (savedState.subPanel === 'dlt-history') {
                            // 加载大乐透历史数据
                            if (window.DLTModule) {
                                window.DLTModule.loadHistory(1);
                            }
                        } else if (savedState.subPanel === 'dlt-trend') {
                            // 加载大乐透走势图数据
                            if (window.DLTModule) {
                                window.DLTModule.loadTrendData();
                            }
                        } else if (savedState.subPanel === 'dlt-expert') {
                            // 加载大乐透专家推荐数据
                            if (window.DLTModule) {
                                window.DLTModule.loadExpert();
                            }
                        }
                    } else if (savedState.mainPanel === 'ssq') {
                        if (savedState.subPanel === 'trend') {
                            loadTrendData();
                        } else {
                            loadSSQContent(savedState.subPanel);
                        }
                    }
                }
            }
        }, 150);
    }
}

// 主导航切换
function initMainNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // 移除所有导航项的激活状态
            navItems.forEach(nav => nav.classList.remove('active'));
            // 激活当前点击的导航项
            item.classList.add('active');
            
            // 获取对应面板ID
            const panelId = item.dataset.panel + '-panel';
            
            // 隐藏所有面板
            document.querySelectorAll('.panel').forEach(panel => {
                panel.classList.remove('active');
            });
            
            // 显示当前选中的面板
            const targetPanel = document.getElementById(panelId);
            if (targetPanel) {
                targetPanel.classList.add('active');
                
                // 确保激活往期开奖子面板
                const subNavItems = targetPanel.querySelectorAll('.sub-nav-item');
                const contentItems = targetPanel.querySelectorAll('.panel-content');
                
                // 重置所有子导航状态
                subNavItems.forEach(nav => nav.classList.remove('active'));
                contentItems.forEach(content => content.classList.remove('active'));
                
                // 激活往期开奖子面板
                if (item.dataset.panel === 'ssq') {
                    // 双色球：激活往期开奖
                    const historySubNav = targetPanel.querySelector('.sub-nav-item[data-content="history"]');
                    const historyContent = targetPanel.querySelector('#ssq-history');
                    if (historySubNav && historyContent) {
                        historySubNav.classList.add('active');
                        historyContent.classList.add('active');
                    }
                    loadSSQContent('history');
                } else if (item.dataset.panel === 'dlt') {
                    // 大乐透：激活往期开奖
                    const historySubNav = targetPanel.querySelector('.sub-nav-item[data-content="dlt-history"]');
                    const historyContent = targetPanel.querySelector('#dlt-history');
                    if (historySubNav && historyContent) {
                        historySubNav.classList.add('active');
                        historyContent.classList.add('active');
                    }
                    // 大乐透面板，加载默认内容（往期开奖）
                    if (window.DLTModule) {
                        window.DLTModule.loadHistory(1);
                    }
                }
                
                // 保存页面状态
                savePageState();
            }
        });
    });
}

// 子导航切换
function initSubNavigation() {
    const subNavItems = document.querySelectorAll('.sub-nav-item');
    
    subNavItems.forEach(item => {
        item.addEventListener('click', () => {
            const contentType = item.dataset.content;
            const parentPanel = item.closest('.panel');
            
            console.log(`🔍 子导航点击: ${contentType}, 面板: ${parentPanel.id}`);
            
            // 更新子导航激活状态
            parentPanel.querySelectorAll('.sub-nav-item').forEach(nav => {
                nav.classList.remove('active');
            });
            item.classList.add('active');
            
            // 更新内容显示
            parentPanel.querySelectorAll('.panel-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // 确定目标内容ID
            let targetContentId;
            if (parentPanel.id === 'dlt-panel') {
                // 大乐透面板直接使用contentType
                targetContentId = contentType;
            } else {
                // 双色球面板使用ssq-前缀
                targetContentId = `ssq-${contentType}`;
            }
            
            const targetContent = document.getElementById(targetContentId);
            if (targetContent) {
                targetContent.classList.add('active');
                
                // 根据面板类型加载对应数据
                if (parentPanel.id === 'dlt-panel') {
                    // 大乐透面板
                    if (contentType === 'dlt-history') {
                        if (window.DLTModule) {
                            window.DLTModule.loadHistory(1);
                        }
                    } else if (contentType === 'dlt-trend') {
                        if (window.DLTModule) {
                            window.DLTModule.loadTrendData();
                        }
                    } else if (contentType === 'dlt-combination') {
                        console.log('🎯 用户切换到hit_dlts组合预测面板');

                        // 当用户点击组合预测时，确保期号数据已加载
                        if (window.loadLatestIssues) {
                            console.log('🔄 加载期号数据...');
                            setTimeout(() => window.loadLatestIssues(), 100);
                        } else {
                            console.log('⚠️ loadLatestIssues函数不存在');
                        }

                        // 初始化hit_dlts组合预测模块（包括数据生成管理）- 总是执行
                        console.log('🔧 开始初始化hit_dlts组合预测模块...');
                        if (typeof initDLTCombinationModule === 'function') {
                            console.log('✅ 找到initDLTCombinationModule函数，开始执行...');
                            setTimeout(() => {
                                console.log('⚡ 执行initDLTCombinationModule()...');
                                initDLTCombinationModule();
                            }, 300);
                        } else {
                            console.error('❌ initDLTCombinationModule函数不存在！');
                        }
                    } else if (contentType === 'dlt-hwc-positive-prediction') {
                        console.log('🌡️ 用户切换到热温冷正选批量预测面板');

                        // 初始化热温冷正选批量预测模块
                        if (typeof initHwcPositivePrediction === 'function') {
                            console.log('✅ 找到initHwcPositivePrediction函数，开始执行...');
                            setTimeout(() => {
                                console.log('⚡ 执行initHwcPositivePrediction()...');
                                initHwcPositivePrediction();
                            }, 300);
                        } else {
                            console.error('❌ initHwcPositivePrediction函数不存在！');
                        }
                    }
                } else {
                    // 双色球面板
                    if (contentType === 'trend') {
                        loadTrendData();
                    } else {
                        loadSSQContent(contentType);
                    }
                }
            }
            
            // 保存页面状态（在内容加载完成后）
            setTimeout(() => {
                savePageState();
            }, 100);
        });
    });
    
    // 添加立即检查当前激活的hit_dlts组合面板（用于页面刷新后的状态恢复）
    setTimeout(() => {
        const dltCombinationPanel = document.getElementById('dlt-combination');
        if (dltCombinationPanel && dltCombinationPanel.classList.contains('active')) {
            console.log('🔄 initSubNavigation完成后检测到hit_dlts组合预测面板激活，立即初始化...');
            if (typeof initDLTCombinationModule === 'function') {
                console.log('⚡ 立即执行initDLTCombinationModule()...');
                initDLTCombinationModule();
            }
        }
    }, 200);
}

// 刷新按钮事件
function initRefreshButtons() {
    const refreshButtons = document.querySelectorAll('.refresh-btn');
    
    refreshButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 旧版hit_dlts组合预测按钮已删除，只使用新版界面
            
            const contentType = button.closest('.panel-content').id.split('-')[1];
            loadSSQContent(contentType, true);
        });
    });
}

// 加载双色球内容
function loadSSQContent(contentType, isRefresh = false) {
    const contentElement = document.getElementById(`ssq-${contentType}`);
    const contentBody = contentElement.querySelector('.content-body');
    
    // 显示加载状态
    if (contentType === 'history') {
        const tbody = contentElement.querySelector('tbody');
        tbody.innerHTML = '<tr><td colspan="3" class="loading">加载中...</td></tr>';
    } else {
        contentBody.innerHTML = '<div class="loading">加载中...</div>';
    }
    
    // 根据内容类型加载不同的数据
    switch (contentType) {
        case 'history':
            loadHistoryData();
            break;
        case 'trend':
            loadTrendData();
            break;
        case 'expert':
            loadExpertData(contentBody);
            break;
    }
}

// 当前页码
let currentPage = 1;
const pageSize = 30;

// 初始化分页
function initPagination() {
    const prevBtn = document.querySelector('.prev-page');
    const nextBtn = document.querySelector('.next-page');
    
    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadHistoryData();
        }
    });
    
    nextBtn.addEventListener('click', () => {
        currentPage++;
        loadHistoryData();
    });
}

// 加载往期开奖数据
async function loadHistoryData() {
    try {
        const response = await fetch(`http://localhost:3003/api/ssq/history?page=${currentPage}&limit=${pageSize}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message);
        }
        
        displayHistoryData(result.data, result.pagination);
    } catch (error) {
        console.error('Error loading history data:', error);
        const tbody = document.querySelector('.lottery-table tbody');
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="error-message">
                    加载数据失败: ${error.message}
                </td>
            </tr>
        `;
    }
}

// 显示往期开奖数据
function displayHistoryData(data, pagination) {
    const tbody = document.querySelector('.lottery-table tbody');
    const pageInfo = document.querySelector('.page-info');
    const prevBtn = document.querySelector('.prev-page');
    const nextBtn = document.querySelector('.next-page');
    
    // 更新表格数据
    tbody.innerHTML = data.map(item => `
        <tr>
            <td>${item.Issue}</td>
            <td>${item.DrawingWeek}</td>
            <td>
                <span class="ball red-ball">${item.Red1}</span>
                <span class="ball red-ball">${item.Red2}</span>
                <span class="ball red-ball">${item.Red3}</span>
                <span class="ball red-ball">${item.Red4}</span>
                <span class="ball red-ball">${item.Red5}</span>
                <span class="ball red-ball">${item.Red6}</span>
                <span class="ball blue-ball">${item.Blue}</span>
            </td>
        </tr>
    `).join('');
    
    // 更新分页信息
    pageInfo.textContent = `第 ${pagination.current} 页`;
    prevBtn.disabled = pagination.current === 1;
    nextBtn.disabled = pagination.current * pagination.size >= pagination.total;
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// 加载专家推荐数据
async function loadExpertData(container) {
    container.innerHTML = '<div class="info-message">专家推荐功能正在开发中...</div>';
}

// 走势图相关变量
let currentPeriods = 30;
let customRangeMode = false;
let lastRedBallMissing = [];

// 初始化双色球缩放控制
function initSSQZoomControls() {
    const ssqPanel = document.getElementById('ssq-trend');
    if (!ssqPanel) return;

    const zoomBtns = ssqPanel.querySelectorAll('.zoom-btn');
    const zoomWrapper = ssqPanel.querySelector('.trend-zoom-wrapper');

    if (!zoomWrapper) {
        console.warn('SSQ Zoom wrapper not found');
        return;
    }

    // 从localStorage读取保存的缩放值
    const savedZoom = localStorage.getItem('ssq-trend-zoom') || '1.0';
    applySSQZoom(zoomWrapper, parseFloat(savedZoom));

    // 设置对应按钮为活跃状态
    zoomBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.zoom === savedZoom) {
            btn.classList.add('active');
        }
    });

    // 为每个缩放按钮添加事件监听器
    zoomBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const zoomValue = parseFloat(btn.dataset.zoom);

            // 更新按钮状态
            zoomBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // 应用缩放
            applySSQZoom(zoomWrapper, zoomValue);

            // 保存到localStorage
            localStorage.setItem('ssq-trend-zoom', btn.dataset.zoom);
        });
    });
}

// 应用双色球缩放变换
function applySSQZoom(wrapper, zoomValue) {
    wrapper.style.transform = `scale(${zoomValue})`;
    wrapper.style.transformOrigin = 'top left';

    // 调整容器大小以适应缩放后的内容
    const container = wrapper.parentElement;
    if (container) {
        if (zoomValue < 1) {
            container.style.overflowX = 'visible';
        } else {
            container.style.overflowX = 'auto';
        }
    }
}

// 初始化走势图按钮事件
function initTrendButtons() {
    const periodBtns = document.querySelectorAll('.period-btn');
    const customRangeBtn = document.querySelector('.custom-range-btn');
    const coOccurrenceBtn = document.querySelector('.co-occurrence-btn');
    const conflictDataBtn = document.querySelector('.conflict-data-btn');
    const startIssueInput = document.getElementById('startIssue');
    const endIssueInput = document.getElementById('endIssue');
    
    // 最近N期按钮事件
    periodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            customRangeMode = false;
            periodBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentPeriods = parseInt(btn.dataset.periods);
            loadTrendData();
            
            // 清空自定义期号输入
            startIssueInput.value = '';
            endIssueInput.value = '';
        });
    });
    
    // 自定义期号范围查询事件
    customRangeBtn.addEventListener('click', () => {
        const startIssue = startIssueInput.value.trim();
        const endIssue = endIssueInput.value.trim();
        
        // 验证输入
        if (!startIssue || !endIssue) {
            alert('请输入起始和结束期号');
            return;
        }
        
        if (!/^\d{7}$/.test(startIssue) || !/^\d{7}$/.test(endIssue)) {
            alert('期号格式不正确，请输入7位数字');
            return;
        }
        
        if (parseInt(startIssue) > parseInt(endIssue)) {
            alert('起始期号不能大于结束期号');
            return;
        }
        
        // 切换到自定义范围模式
        customRangeMode = true;
        periodBtns.forEach(btn => btn.classList.remove('active'));
        loadTrendData(startIssue, endIssue);
    });
    
    // 输入框按回车触发查询
    [startIssueInput, endIssueInput].forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                customRangeBtn.click();
            }
        });
        
        // 限制只能输入数字
        input.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    });
    
    // 同出数据按钮事件
    if (coOccurrenceBtn) {
        coOccurrenceBtn.addEventListener('click', () => {
            handleCoOccurrenceData();
        });
    }
    
    // 相克数据按钮事件（预留功能）
    if (conflictDataBtn) {
        conflictDataBtn.addEventListener('click', () => {
            handleConflictData();
        });
    }
}

// 加载走势图数据
async function loadTrendData(startIssue = null, endIssue = null) {
    try {
        const container = document.querySelector('.trend-table-container');
        
        // 显示加载状态
        container.innerHTML = `
            <div class="loading-overlay">
                <div class="loading-spinner"></div>
            </div>
            <table class="trend-table">
                <thead>
                    <tr class="header-row">
                        <th rowspan="2" class="fixed-col">期号</th>
                        <th rowspan="2" class="fixed-col">星期</th>
                        <th colspan="11" class="zone-header red-zone">一区(1-11)</th>
                        <th colspan="11" class="zone-header red-zone red-zone-two">二区(12-22)</th>
                        <th colspan="11" class="zone-header red-zone">三区(23-33)</th>
                        <th colspan="16" class="zone-header blue-zone blue-section-start">蓝球区(1-16)</th>
                        <th colspan="5" class="zone-header stat-zone stat-section-start">统计数据</th>
                    </tr>
                    <tr class="number-row">
                        ${Array.from({length: 11}, (_, i) => `<th class="red-section">${i + 1}</th>`).join('')}
                        ${Array.from({length: 11}, (_, i) => `<th class="red-section${i === 0 ? ' zone-separator' : ''}">${i + 12}</th>`).join('')}
                        ${Array.from({length: 11}, (_, i) => `<th class="red-section${i === 0 ? ' zone-separator' : ''}">${i + 23}</th>`).join('')}
                        ${Array.from({length: 16}, (_, i) => `<th${i === 0 ? ' class="blue-section-start"' : ''}>${i + 1}</th>`).join('')}
                        <th class="stat-col-head stat-section-start">和值</th>
                        <th class="stat-col-head">跨度</th>
                        <th class="stat-col-head">热温冷比</th>
                        <th class="stat-col-head">区间比</th>
                        <th class="stat-col-head">奇偶比</th>
                    </tr>
                </thead>
                <tbody id="trendTableBody"></tbody>
                <tfoot id="preSelectRows">
                    ${Array.from({length: 3}, (_, rowIndex) => `
                        <tr class="pre-select-row" data-row="${rowIndex + 1}">
                            <td class="fixed-col">预选${rowIndex + 1}</td>
                            <td class="fixed-col">-</td>
                            ${Array.from({length: 33}, (_, i) => {
                                const zoneClass = (i === 11 || i === 22) ? 'zone-separator' : '';
                                const zoneColorClass = (i >= 11 && i <= 21) ? 'zone-two' : '';
                                return `
                                    <td class="selectable-cell red-cell ${zoneClass} ${zoneColorClass}" data-number="${i + 1}" title="点击选择红球号码 ${i + 1}">
                                        <div class="cell-content">${i + 1}</div>
                                    </td>
                                `;
                            }).join('')}
                            ${Array.from({length: 16}, (_, i) => `
                                <td class="selectable-cell blue-cell${i === 0 ? ' blue-section-start' : ''}" data-number="${i + 1}" title="点击选择蓝球号码 ${i + 1}">
                                    <div class="cell-content">${i + 1}</div>
                                </td>
                            `).join('')}
                        </tr>
                    `).join('')}
                </tfoot>
            </table>
        `;
        
        // 构建查询参数
        const queryParams = customRangeMode ? 
            `startIssue=${startIssue}&endIssue=${endIssue}` : 
            `recentPeriods=${currentPeriods}`;
        
        const [trendResponse, frequencyResponse, historyResponse] = await Promise.all([
            fetch(`http://localhost:3003/api/trendchart?${queryParams}`),
            fetch('http://localhost:3003/api/frequency'),
            fetch(`http://localhost:3003/api/ssq/history?page=1&limit=200`)
        ]);
        const result = await trendResponse.json();
        const frequencyResult = await frequencyResponse.json();
        const historyResult = await historyResponse.json();
        
        if (!result.success) {
            throw new Error(result.message || '加载数据失败');
        }
        
        // 缓存最后一期红球遗漏值
        if (result.data && result.data.length > 0) {
            const lastRecord = result.data[result.data.length - 1];
            if (lastRecord.redBalls) {
                // /api/ssq/trend 数据结构
                lastRedBallMissing = lastRecord.redBalls.map(ball => ({
                    number: ball.number,
                    missing: ball.missing
                }));
            } else if (lastRecord.zone1) {
                // /api/trendchart 数据结构
                const allRedBalls = [...lastRecord.zone1, ...lastRecord.zone2, ...lastRecord.zone3];
                lastRedBallMissing = allRedBalls.map(ball => ({
                    number: ball.number,
                    missing: ball.missing
                }));
            } else {
                lastRedBallMissing = [];
            }
        } else {
            lastRedBallMissing = [];
        }
        updateTrendTable(result.data, frequencyResult.data, historyResult.data);
        initPreSelectRows();
        
        // 移除加载状态
        const loadingOverlay = container.querySelector('.loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.remove();
        }
    } catch (error) {
        console.error('Error loading trend data:', error);
        const container = document.querySelector('.trend-table-container');
        container.innerHTML = `
            <div class="error-message">
                加载数据失败: ${error.message}
            </div>
        `;
    }
}

// 更新走势表格
function updateTrendTable(data, frequencyData, historyData) {
    const tbody = document.getElementById('trendTableBody');
    if (!tbody) return;
    
    // 创建期号到开奖数据的映射
    const historyMap = {};
    if (historyData && historyData.length > 0) {
        historyData.forEach(item => {
            historyMap[item.Issue] = {
                redBalls: [item.Red1, item.Red2, item.Red3, item.Red4, item.Red5, item.Red6],
                blueBall: item.Blue
            };
        });
    }
    
    // 后端数据已按ID升序排列，直接使用
    
    // 调试输出：检查数据结构
    if (data.length > 0) {
        if (data[0].redBalls) {
            console.log('Using /api/ssq/trend data structure');
            console.log('First record redBalls:', data[0].redBalls.filter(b => b.isDrawn));
        } else if (data[0].zone1) {
            console.log('Using /api/trendchart data structure');
            console.log('First record zones:', data[0].zone1.slice(0, 3));
        }
    }
    
    // 生成表格行
    const rows = data.map((item, idx) => {
        // 获取该期的实际开奖数据
        const actualDrawData = historyMap[item.issue];
        
        // 适配不同的数据结构
        let redBalls, blueBalls;
        if (item.redBalls) {
            // 来自 /api/ssq/trend 的数据结构
            redBalls = item.redBalls || [];
            blueBalls = item.blueBalls || [];
        } else if (item.zone1) {
            // 来自 /api/trendchart 的数据结构
            redBalls = [...(item.zone1 || []), ...(item.zone2 || []), ...(item.zone3 || [])];
            blueBalls = item.blueZone || [];
        } else {
            redBalls = [];
            blueBalls = [];
        }
        
        // 如果有实际开奖数据，修正isDrawn状态
        if (actualDrawData) {
            redBalls.forEach(ball => {
                ball.isDrawn = actualDrawData.redBalls.includes(ball.number);
            });
            blueBalls.forEach(ball => {
                ball.isDrawn = ball.number === actualDrawData.blueBall;
            });
        }
        
        // 使用后端预计算的统计数据（如果可用），否则前端计算
        let statHtml = '';
        if (item.statistics) {
            // 使用后端统计数据
            statHtml = `
                <td class="stat-col stat-sum stat-section-start">${item.statistics.sum}</td>
                <td class="stat-col stat-span">${item.statistics.span}</td>
                <td class="stat-col stat-hotwarmcold">${item.statistics.hotWarmColdRatio}</td>
                <td class="stat-col stat-zone">${item.statistics.zoneRatio}</td>
                <td class="stat-col stat-oddeven">${item.statistics.oddEvenRatio}</td>
            `;
        } else {
            // 前端计算（兼容性处理）
            const reds = redBalls.filter(b => b.isDrawn).map(b => b.number);
            const sum = reds.reduce((a, b) => a + b, 0);
            const span = Math.max(...reds) - Math.min(...reds);
            // 热温冷比需要基于开奖号码在上一期的遗漏值计算
            // 前端无法获取上一期数据，所以显示提示信息
            const hotWarmColdRatio = '需要后端数据(v2.0)';
            // 区间比
            let zone1=0, zone2=0, zone3=0;
            reds.forEach(n => {
                if (n <= 11) zone1++;
                else if (n <= 22) zone2++;
                else zone3++;
            });
            // 奇偶比
            let odd=0, even=0;
            reds.forEach(n => n%2===0 ? even++ : odd++);
            statHtml = `
                <td class="stat-col stat-sum stat-section-start">${sum}</td>
                <td class="stat-col stat-span">${span}</td>
                <td class="stat-col stat-hotwarmcold">${hotWarmColdRatio}</td>
                <td class="stat-col stat-zone">${zone1}:${zone2}:${zone3}</td>
                <td class="stat-col stat-oddeven">${odd}:${even}</td>
            `;
        }
        return `
            <tr>
                <td class="fixed-col">${item.issue}</td>
                <td class="fixed-col">${item.drawingWeek}</td>
                ${redBalls.map((ball, index) => {
                    const zoneClass = index === 11 || index === 22 ? 'zone-separator' : '';
                    const zoneColorClass = index >= 11 && index <= 21 ? 'zone-two' : 'red-section';
                    // 调试：检查不匹配的情况
                    if (ball.number !== index + 1) {
                        console.warn(`Red ball number mismatch: index=${index}, ball.number=${ball.number}, expected=${index + 1}`);
                    }
                    return `
                        <td class="${zoneClass} ${zoneColorClass}">
                            ${ball.isDrawn 
                                ? `<span class="drawn-number red-number">${ball.number}</span>`
                                : `<span class="missing">${ball.missing}</span>`
                            }
                        </td>
                    `;
                }).join('')}
                ${blueBalls.map((ball, index) => `
                    <td class="${index === 0 ? 'blue-section-start' : ''}">
                        ${ball.isDrawn 
                            ? `<span class="drawn-number blue-number">${ball.number}</span>`
                            : `<span class="missing">${ball.missing}</span>`
                        }
                    </td>
                `).join('')}
                ${statHtml}
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = rows;
    
    // 应用频率突显效果
    applySSQFrequencyHighlight(data);
    
    // 添加走势连线
    drawTrendLines();
}

/**
 * 应用双色球频率突显效果
 */
function applySSQFrequencyHighlight(data) {
    if (!data || data.length === 0) return;
    
    // 统计各列数据的出现频率
    const statFrequency = {
        sum: {},
        span: {},
        hotWarmColdRatio: {},
        zoneRatio: {},
        oddEvenRatio: {}
    };
    
    // 遍历数据统计频率
    data.forEach(item => {
        if (item.statistics) {
            const stats = item.statistics;
            
            // 统计和值频率
            if (stats.sum !== undefined) {
                statFrequency.sum[stats.sum] = (statFrequency.sum[stats.sum] || 0) + 1;
            }
            
            // 统计跨度频率
            if (stats.span !== undefined) {
                statFrequency.span[stats.span] = (statFrequency.span[stats.span] || 0) + 1;
            }
            
            // 统计热温冷比频率
            if (stats.hotWarmColdRatio) {
                statFrequency.hotWarmColdRatio[stats.hotWarmColdRatio] = (statFrequency.hotWarmColdRatio[stats.hotWarmColdRatio] || 0) + 1;
            }
            
            // 统计区间比频率
            if (stats.zoneRatio) {
                statFrequency.zoneRatio[stats.zoneRatio] = (statFrequency.zoneRatio[stats.zoneRatio] || 0) + 1;
            }
            
            // 统计奇偶比频率
            if (stats.oddEvenRatio) {
                statFrequency.oddEvenRatio[stats.oddEvenRatio] = (statFrequency.oddEvenRatio[stats.oddEvenRatio] || 0) + 1;
            }
        }
    });
    
    // 找出每列的最高和最低频率
    const frequencyStats = {};
    Object.keys(statFrequency).forEach(statType => {
        const frequencies = Object.values(statFrequency[statType]);
        if (frequencies.length > 0) {
            const maxFreq = Math.max(...frequencies);
            const minFreq = Math.min(...frequencies);
            
            // 找出最高频率和最低频率对应的值
            const maxValues = Object.keys(statFrequency[statType]).filter(key => statFrequency[statType][key] === maxFreq);
            const minValues = Object.keys(statFrequency[statType]).filter(key => statFrequency[statType][key] === minFreq);
            
            frequencyStats[statType] = {
                maxFreq,
                minFreq,
                maxValues,
                minValues
            };
        }
    });
    
    // 应用颜色突显
    const tbody = document.getElementById('trendTableBody');
    if (!tbody) return;
    
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        
        // 统计列从第51列开始（期号 + 星期 + 33个红球 + 16个蓝球 = 51列，索引从51开始）
        const statStartIndex = 51;
        
        // 和值 (索引51) - 只对重复出现的和值显示绿色
        if (cells[statStartIndex] && frequencyStats.sum) {
            const value = cells[statStartIndex].textContent.trim();
            // 检查该和值的出现频率是否大于1（即重复出现）
            if (statFrequency.sum[value] && statFrequency.sum[value] > 1) {
                cells[statStartIndex].classList.add('ssq-freq-highest');
            }
            // 移除红色显示规则，不再添加 ssq-freq-lowest 类
        }
        
        // 跨度 (索引52)
        if (cells[statStartIndex + 1] && frequencyStats.span) {
            const value = cells[statStartIndex + 1].textContent.trim();
            if (frequencyStats.span.maxValues.includes(value)) {
                cells[statStartIndex + 1].classList.add('ssq-freq-highest');
            } else if (frequencyStats.span.minValues.includes(value)) {
                cells[statStartIndex + 1].classList.add('ssq-freq-lowest');
            }
        }
        
        // 热温冷比 (索引53) - 重复出现次数最多的显示绿色，最少的显示红色
        if (cells[statStartIndex + 2] && frequencyStats.hotWarmColdRatio) {
            const value = cells[statStartIndex + 2].textContent.trim();
            if (frequencyStats.hotWarmColdRatio.maxValues.includes(value)) {
                cells[statStartIndex + 2].classList.add('ssq-freq-highest');
            } else if (frequencyStats.hotWarmColdRatio.minValues.includes(value)) {
                cells[statStartIndex + 2].classList.add('ssq-freq-lowest');
            }
        }
        
        // 区间比 (索引54)
        if (cells[statStartIndex + 3] && frequencyStats.zoneRatio) {
            const value = cells[statStartIndex + 3].textContent.trim();
            if (frequencyStats.zoneRatio.maxValues.includes(value)) {
                cells[statStartIndex + 3].classList.add('ssq-freq-highest');
            } else if (frequencyStats.zoneRatio.minValues.includes(value)) {
                cells[statStartIndex + 3].classList.add('ssq-freq-lowest');
            }
        }
        
        // 奇偶比 (索引55)
        if (cells[statStartIndex + 4] && frequencyStats.oddEvenRatio) {
            const value = cells[statStartIndex + 4].textContent.trim();
            if (frequencyStats.oddEvenRatio.maxValues.includes(value)) {
                cells[statStartIndex + 4].classList.add('ssq-freq-highest');
            } else if (frequencyStats.oddEvenRatio.minValues.includes(value)) {
                cells[statStartIndex + 4].classList.add('ssq-freq-lowest');
            }
        }
    });
    
    console.log('SSQ frequency highlighting applied:', frequencyStats);
    
    // 在浏览器控制台显示频率统计信息
    if (Object.keys(frequencyStats).length > 0) {
        console.group('双色球统计数据频率分析结果');
        Object.keys(frequencyStats).forEach(statType => {
            const stat = frequencyStats[statType];
            console.log(`${statType}:`);
            console.log(`  最高频率: ${stat.maxFreq}次 - 值: [${stat.maxValues.join(', ')}]`);
            console.log(`  最低频率: ${stat.minFreq}次 - 值: [${stat.minValues.join(', ')}]`);
        });
        console.groupEnd();
    }
}

// 绘制走势连线
function drawTrendLines() {
    const tbody = document.getElementById('trendTableBody');
    if (!tbody) return;
    
    const container = document.querySelector('.trend-table-container');
    
    // 清除现有的连线
    document.querySelectorAll('.trend-line').forEach(line => line.remove());
    
    // 如果正在滚动，不绘制连线
    if (container.dataset.scrolling === 'true') {
        return;
    }
    
    const rows = tbody.getElementsByTagName('tr');
    
    // 为红球和蓝球分别绘制连线
    for (let ballIndex = 0; ballIndex < 49; ballIndex++) {
        const isBlue = ballIndex >= 33;
        
        for (let rowIndex = 0; rowIndex < rows.length - 1; rowIndex++) {
            const currentCell = rows[rowIndex].cells[ballIndex + 2]; // +2 是因为前面有期号和星期两列
            const nextCell = rows[rowIndex + 1].cells[ballIndex + 2];
            
            const currentBall = currentCell.querySelector('.drawn-number');
            const nextBall = nextCell.querySelector('.drawn-number');
            
            if (currentBall && nextBall) {
                const line = document.createElement('div');
                line.className = `trend-line ${isBlue ? 'blue' : ''}`;
                
                const rect1 = currentBall.getBoundingClientRect();
                const rect2 = nextBall.getBoundingClientRect();
                const containerRect = tbody.getBoundingClientRect();
                
                const x1 = rect1.left + rect1.width / 2 - containerRect.left;
                const y1 = rect1.top + rect1.height / 2 - containerRect.top;
                const x2 = rect2.left + rect2.width / 2 - containerRect.left;
                const y2 = rect2.top + rect2.height / 2 - containerRect.top;
                
                const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                const angle = Math.atan2(y2 - y1, x2 - x1);
                
                line.style.width = `${length}px`;
                line.style.transform = `translate(${x1}px, ${y1}px) rotate(${angle}rad)`;
                
                tbody.appendChild(line);
            }
        }
    }
}

// 监听窗口大小变化和滚动事件
window.addEventListener('resize', debounce(() => {
    drawTrendLines();
}, 150));

// 添加滚动事件处理
document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('.trend-table-container');
    if (container) {
        let scrollTimeout;
        
        container.addEventListener('scroll', () => {
            container.dataset.scrolling = 'true';
            document.querySelectorAll('.trend-line').forEach(line => {
                line.style.opacity = '0';
            });
            
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                container.dataset.scrolling = 'false';
                drawTrendLines();
            }, 150);
        });
    }
});

// 防抖函数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// 初始化预选行事件
function initPreSelectRows() {
    const preSelectRows = document.getElementById('preSelectRows');
    if (!preSelectRows) return;

    // 移除TIPS面板相关逻辑，只保留选中逻辑
    preSelectRows.addEventListener('click', (e) => {
        const cell = e.target.closest('.selectable-cell');
        if (!cell) return;
        cell.classList.toggle('selected');
        updateRowSelections(cell.closest('.pre-select-row'));
    });
}

// 更新行选择状态
function updateRowSelections(row) {
    if (!row) return;
    // 只处理红球底色，不做数量限制
    row.querySelectorAll('.red-cell').forEach(cell => {
        const content = cell.querySelector('.cell-content');
        if (content) {
            content.classList.remove('miss-green', 'miss-yellow', 'miss-red');
        }
        if (cell.classList.contains('selected')) {
            const number = parseInt(cell.dataset.number);
            const missObj = lastRedBallMissing.find(b => b.number === number);
            if (missObj && content) {
                if (missObj.missing <= 4) {
                    content.classList.add('miss-green');
                } else if (missObj.missing <= 9) {
                    content.classList.add('miss-yellow');
                } else {
                    content.classList.add('miss-red');
                }
            }
        }
    });
    
    // 添加历史和值排除复选框的切换逻辑
    const sumExcludeCheckboxes = [
        'sum-exclude-recent-5',
        'sum-exclude-recent-10', 
        'sum-exclude-recent-30'
    ];
    
    sumExcludeCheckboxes.forEach(id => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.addEventListener('change', function() {
                if (this.checked) {
                    // 取消其他复选框的选中状态
                    sumExcludeCheckboxes.forEach(otherId => {
                        if (otherId !== id) {
                            const otherCheckbox = document.getElementById(otherId);
                            if (otherCheckbox) {
                                otherCheckbox.checked = false;
                            }
                        }
                    });
                }
            });
        }
    });
}

// 处理同出数据请求
async function handleCoOccurrenceData() {
    try {
        // 显示加载状态
        showCoOccurrenceLoading();
        
        // 获取当前筛选条件
        const params = getCurrentFilterParams();
        
        // 请求同出数据
        const response = await fetch(`http://localhost:3003/api/ssq/cooccurrence?${params}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || '获取同出数据失败');
        }
        
        // 显示同出数据
        displayCoOccurrenceData(result.data);
        
    } catch (error) {
        console.error('同出数据请求失败:', error);
        alert('获取同出数据失败: ' + error.message);
        hideCoOccurrenceLoading();
    }
}

// 获取当前筛选条件参数
function getCurrentFilterParams() {
    const startIssue = document.getElementById('startIssue').value.trim();
    const endIssue = document.getElementById('endIssue').value.trim();
    
    if (customRangeMode && startIssue && endIssue) {
        return `startIssue=${startIssue}&endIssue=${endIssue}`;
    } else {
        return `periods=${currentPeriods}`;
    }
}

// 显示同出数据加载状态
function showCoOccurrenceLoading() {
    const btn = document.querySelector('.co-occurrence-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '生成中...';
    }
}

// 隐藏同出数据加载状态
function hideCoOccurrenceLoading() {
    const btn = document.querySelector('.co-occurrence-btn');
    if (btn) {
        btn.disabled = false;
        btn.textContent = '同出数据';
    }
}

// 显示同出数据弹窗
function displayCoOccurrenceData(data) {
    hideCoOccurrenceLoading();
    
    // 创建弹窗HTML
    const modal = document.createElement('div');
    modal.className = 'cooccurrence-modal';
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3>双色球同出数据分析</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="period-info">
                    <p><strong>分析期数:</strong> ${data.periodInfo.totalPeriods}期</p>
                    <p><strong>期号范围:</strong> ${data.periodInfo.startIssue} - ${data.periodInfo.endIssue}</p>
                </div>
                
                <div class="statistics-section">
                    <h4>📊 统计概要</h4>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">最热红球:</span>
                            <span class="stat-value">${data.statistics.redBallStats.hottest.num}号 (${data.statistics.redBallStats.hottest.freq}次)</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">最冷红球:</span>
                            <span class="stat-value">${data.statistics.redBallStats.coldest.num}号 (${data.statistics.redBallStats.coldest.freq}次)</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">最热蓝球:</span>
                            <span class="stat-value">${data.statistics.blueBallStats.hottest.num}号 (${data.statistics.blueBallStats.hottest.freq}次)</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">最冷蓝球:</span>
                            <span class="stat-value">${data.statistics.blueBallStats.coldest.num}号 (${data.statistics.blueBallStats.coldest.freq}次)</span>
                        </div>
                        ${data.statistics.topRedPairs.length > 0 ? `
                        <div class="stat-item">
                            <span class="stat-label">红球最高同出:</span>
                            <span class="stat-value">${data.statistics.topRedPairs[0].pair[0]}号和${data.statistics.topRedPairs[0].pair[1]}号 (${data.statistics.topRedPairs[0].count}次)</span>
                        </div>
                        ` : ''}
                        ${data.statistics.topRedBluePairs.length > 0 ? `
                        <div class="stat-item">
                            <span class="stat-label">红蓝最高同出:</span>
                            <span class="stat-value">红球${data.statistics.topRedBluePairs[0].pair[0]}号和蓝球${data.statistics.topRedBluePairs[0].pair[1]}号 (${data.statistics.topRedBluePairs[0].count}次)</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button class="btn-export-excel" onclick="exportCoOccurrenceExcel()">📊 导出Excel</button>
                    <button class="btn-view-detail" onclick="showCoOccurrenceTable()">📋 查看详细表格</button>
                </div>
            </div>
        </div>
    `;
    
    // 添加到页面
    document.body.appendChild(modal);
    
    // 绑定关闭事件
    const closeBtn = modal.querySelector('.modal-close');
    const overlay = modal.querySelector('.modal-overlay');
    
    const closeModal = () => {
        document.body.removeChild(modal);
    };
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    
    // 存储数据供其他函数使用
    window.currentCoOccurrenceData = data;
}

// 导出同出数据Excel
async function exportCoOccurrenceExcel() {
    try {
        // 显示导出进度
        const exportBtn = document.querySelector('.btn-export-excel');
        const originalText = exportBtn.textContent;
        exportBtn.textContent = '导出中...';
        exportBtn.disabled = true;
        
        // 获取当前筛选条件
        const params = getCurrentFilterParams();
        
        // 请求Excel数据
        const response = await fetch(`http://localhost:3003/api/ssq/cooccurrence/excel?${params}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Excel导出失败');
        }
        
        // 创建CSV格式数据并下载
        const csvContent = convertToCSV(result.data.excelData);
        downloadCSV(csvContent, result.data.filename.replace('.xlsx', '.csv'));
        
        alert('同出数据已成功导出为CSV文件！');
        
    } catch (error) {
        console.error('Excel导出失败:', error);
        alert('Excel导出失败: ' + error.message);
    } finally {
        // 恢复按钮状态
        const exportBtn = document.querySelector('.btn-export-excel');
        if (exportBtn) {
            exportBtn.textContent = '📊 导出Excel';
            exportBtn.disabled = false;
        }
    }
}

// 将数据转换为CSV格式
function convertToCSV(data) {
    return data.map(row => 
        row.map(cell => 
            typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
        ).join(',')
    ).join('\n');
}

// 下载CSV文件
function downloadCSV(csvContent, filename) {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 显示详细同出数据表格
function showCoOccurrenceTable() {
    if (!window.currentCoOccurrenceData) {
        alert('数据加载中，请稍候...');
        return;
    }
    
    // 创建表格弹窗
    const tableModal = document.createElement('div');
    tableModal.className = 'cooccurrence-table-modal';
    tableModal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content large">
            <div class="modal-header">
                <h3>双色球同出数据详细表格</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="table-container">
                    ${generateCoOccurrenceTable(window.currentCoOccurrenceData.matrix)}
                </div>
            </div>
        </div>
    `;
    
    // 添加到页面
    document.body.appendChild(tableModal);
    
    // 绑定关闭事件
    const closeBtn = tableModal.querySelector('.modal-close');
    const overlay = tableModal.querySelector('.modal-overlay');
    
    const closeModal = () => {
        document.body.removeChild(tableModal);
    };
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
}

// 生成同出数据表格HTML
function generateCoOccurrenceTable(matrix) {
    let html = `
        <table class="cooccurrence-table">
            <thead>
                <tr>
                    <th rowspan="2">红球号码</th>
                    <th colspan="33">红球同出次数</th>
                    <th colspan="16">蓝球同出次数</th>
                </tr>
                <tr>
    `;
    
    // 红球列头
    for (let i = 1; i <= 33; i++) {
        html += `<th>红${i}</th>`;
    }
    
    // 蓝球列头
    for (let i = 1; i <= 16; i++) {
        html += `<th>蓝${i}</th>`;
    }
    
    html += `</tr></thead><tbody>`;
    
    // 数据行
    for (let redBall = 1; redBall <= 33; redBall++) {
        html += `<tr><td class="ball-number red">${redBall}</td>`;
        
        // 红球同出数据
        for (let otherRed = 1; otherRed <= 33; otherRed++) {
            if (redBall === otherRed) {
                html += `<td class="diagonal">-</td>`;
            } else {
                const count = matrix[redBall].redCounts[otherRed];
                html += `<td class="count-cell ${count > 0 ? 'has-count' : ''}">${count}</td>`;
            }
        }
        
        // 蓝球同出数据
        for (let blue = 1; blue <= 16; blue++) {
            const count = matrix[redBall].blueCounts[blue];
            html += `<td class="count-cell blue-count ${count > 0 ? 'has-count' : ''}">${count}</td>`;
        }
        
        html += `</tr>`;
    }
    
    html += `</tbody></table>`;
    return html;
}

// 处理相克数据请求
async function handleConflictData() {
    try {
        // 显示加载状态
        showConflictLoading();
        
        // 获取当前筛选条件
        const params = getCurrentFilterParams();
        
        // 请求相克数据
        const response = await fetch(`http://localhost:3003/api/ssq/conflict?${params}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || '获取相克数据失败');
        }
        
        // 显示相克数据
        displayConflictData(result.data);
        
    } catch (error) {
        console.error('相克数据请求失败:', error);
        alert('获取相克数据失败: ' + error.message);
        hideConflictLoading();
    }
}

// 显示相克数据加载状态
function showConflictLoading() {
    const btn = document.querySelector('.conflict-data-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '生成中...';
    }
}

// 隐藏相克数据加载状态
function hideConflictLoading() {
    const btn = document.querySelector('.conflict-data-btn');
    if (btn) {
        btn.disabled = false;
        btn.textContent = '相克数据';
    }
}

// 显示相克数据弹窗
function displayConflictData(data) {
    hideConflictLoading();
    
    // 创建弹窗HTML
    const modal = document.createElement('div');
    modal.className = 'conflict-modal';
    modal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h3>双色球相克数据分析</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="period-info">
                    <p><strong>分析期数:</strong> ${data.periodInfo.totalPeriods}期</p>
                    <p><strong>期号范围:</strong> ${data.periodInfo.startIssue} - ${data.periodInfo.endIssue}</p>
                </div>
                
                <div class="conflict-explanation">
                    <h4>📊 相克关系说明</h4>
                    <p>相克关系指已开出号码与未开出号码之间的"回避"关系。数值越高表示这两个号码越少同时出现。</p>
                </div>
                
                <div class="statistics-section">
                    <h4>📈 统计概要</h4>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">最相克红球:</span>
                            <span class="stat-value">${data.statistics.redBallStats.mostConflicted.num}号 (${data.statistics.redBallStats.mostConflicted.total}次)</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">最少相克红球:</span>
                            <span class="stat-value">${data.statistics.redBallStats.leastConflicted.num}号 (${data.statistics.redBallStats.leastConflicted.total}次)</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">最相克蓝球:</span>
                            <span class="stat-value">${data.statistics.blueBallStats.mostConflicted.num}号 (${data.statistics.blueBallStats.mostConflicted.total}次)</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">最少相克蓝球:</span>
                            <span class="stat-value">${data.statistics.blueBallStats.leastConflicted.num}号 (${data.statistics.blueBallStats.leastConflicted.total}次)</span>
                        </div>
                        ${data.statistics.topConflictRedPairs.length > 0 ? `
                        <div class="stat-item">
                            <span class="stat-label">红球最高相克:</span>
                            <span class="stat-value">${data.statistics.topConflictRedPairs[0].pair[0]}号和${data.statistics.topConflictRedPairs[0].pair[1]}号 (${data.statistics.topConflictRedPairs[0].count}次)</span>
                        </div>
                        ` : ''}
                        ${data.statistics.topConflictRedBluePairs.length > 0 ? `
                        <div class="stat-item">
                            <span class="stat-label">红蓝最高相克:</span>
                            <span class="stat-value">红球${data.statistics.topConflictRedBluePairs[0].pair[0]}号和蓝球${data.statistics.topConflictRedBluePairs[0].pair[1]}号 (${data.statistics.topConflictRedBluePairs[0].count}次)</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button class="btn-export-conflict-excel" onclick="exportConflictExcel()">📊 导出Excel</button>
                    <button class="btn-view-conflict-detail" onclick="showConflictTable()">📋 查看详细表格</button>
                </div>
            </div>
        </div>
    `;
    
    // 添加到页面
    document.body.appendChild(modal);
    
    // 绑定关闭事件
    const closeBtn = modal.querySelector('.modal-close');
    const overlay = modal.querySelector('.modal-overlay');
    
    const closeModal = () => {
        document.body.removeChild(modal);
    };
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    
    // 存储数据供其他函数使用
    window.currentConflictData = data;
}

// 导出相克数据Excel
async function exportConflictExcel() {
    try {
        // 显示导出进度
        const exportBtn = document.querySelector('.btn-export-conflict-excel');
        const originalText = exportBtn.textContent;
        exportBtn.textContent = '导出中...';
        exportBtn.disabled = true;
        
        // 获取当前筛选条件
        const params = getCurrentFilterParams();
        
        // 请求Excel数据
        const response = await fetch(`http://localhost:3003/api/ssq/conflict/excel?${params}`);
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || '相克数据Excel导出失败');
        }
        
        // 创建CSV格式数据并下载
        const csvContent = convertToCSV(result.data.excelData);
        downloadCSV(csvContent, result.data.filename.replace('.xlsx', '.csv'));
        
        alert('相克数据已成功导出为CSV文件！');
        
    } catch (error) {
        console.error('相克数据Excel导出失败:', error);
        alert('相克数据Excel导出失败: ' + error.message);
    } finally {
        // 恢复按钮状态
        const exportBtn = document.querySelector('.btn-export-conflict-excel');
        if (exportBtn) {
            exportBtn.textContent = '📊 导出Excel';
            exportBtn.disabled = false;
        }
    }
}

// 显示详细相克数据表格
function showConflictTable() {
    if (!window.currentConflictData) {
        alert('数据加载中，请稍候...');
        return;
    }
    
    // 创建表格弹窗
    const tableModal = document.createElement('div');
    tableModal.className = 'conflict-table-modal';
    tableModal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-content large">
            <div class="modal-header">
                <h3>双色球相克数据详细表格</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="table-description">
                    <p><strong>说明：</strong>表格显示每个红球号码与其他号码的相克次数。数值表示该红球开出时，对应号码未开出的次数。</p>
                </div>
                <div class="table-container">
                    ${generateConflictTable(window.currentConflictData.matrix)}
                </div>
            </div>
        </div>
    `;
    
    // 添加到页面
    document.body.appendChild(tableModal);
    
    // 绑定关闭事件
    const closeBtn = tableModal.querySelector('.modal-close');
    const overlay = tableModal.querySelector('.modal-overlay');
    
    const closeModal = () => {
        document.body.removeChild(tableModal);
    };
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
}

// 生成相克数据表格HTML
function generateConflictTable(matrix) {
    let html = `
        <table class="conflict-table">
            <thead>
                <tr>
                    <th rowspan="2">红球号码</th>
                    <th colspan="33">红球相克次数</th>
                    <th colspan="16">蓝球相克次数</th>
                </tr>
                <tr>
    `;
    
    // 红球列头
    for (let i = 1; i <= 33; i++) {
        html += `<th>红${i}</th>`;
    }
    
    // 蓝球列头
    for (let i = 1; i <= 16; i++) {
        html += `<th>蓝${i}</th>`;
    }
    
    html += `</tr></thead><tbody>`;
    
    // 数据行
    for (let redBall = 1; redBall <= 33; redBall++) {
        html += `<tr><td class="ball-number red">${redBall}</td>`;
        
        // 红球相克数据
        for (let otherRed = 1; otherRed <= 33; otherRed++) {
            if (redBall === otherRed) {
                html += `<td class="diagonal">-</td>`;
            } else {
                const count = matrix[redBall].redCounts[otherRed];
                html += `<td class="count-cell conflict-count ${count > 0 ? 'has-count' : ''}">${count}</td>`;
            }
        }
        
        // 蓝球相克数据
        for (let blue = 1; blue <= 16; blue++) {
            const count = matrix[redBall].blueCounts[blue];
            html += `<td class="count-cell blue-conflict conflict-count ${count > 0 ? 'has-count' : ''}">${count}</td>`;
        }
        
        html += `</tr>`;
    }
    
    html += `</tbody></table>`;
    return html;
}

// 处理大乐透组合预测
async function handleDLTCombinationPredict() {
    const targetIssue = document.getElementById('dlt-target-issue').value.trim();
    
    if (!targetIssue) {
        alert('请输入目标期号！');
        return;
    }
    
    // 收集排除条件
    const filterConditions = collectDLTFilterConditions();
    
    // 构建请求参数
    const params = {
        targetIssue: targetIssue,
        ...filterConditions
    };
    
    // 显示加载状态
    const btn = document.getElementById('dlt-combination-predict-btn');
    const originalText = btn.textContent;
    btn.textContent = '生成中...';
    btn.disabled = true;
    
    const contentBody = document.getElementById('dlt-combination-content');
    contentBody.innerHTML = '<div class="loading">正在生成组合预测，请稍候...</div>';
    
    try {
        // 构建查询参数
        const queryParams = new URLSearchParams({
            targetIssue: params.targetIssue,
            sumRecentPeriods: params.sumRecentPeriods || '',
            sumBeforePeriods: params.sumBeforePeriods || '',
            htcRecentPeriods: params.htcRecentPeriods || '',
            htcAnalysisPeriods: 30, // 保持兼容性，虽然现在使用固定规则
            zoneRecentPeriods: params.zoneRecentPeriods || ''
        });
        
        // 添加排除参数（转换为后端期望的格式）
        if (params.sumRecentPeriods) {
            queryParams.set('excludeRecentPeriods', JSON.stringify({
                enabled: true,
                periods: parseInt(params.sumRecentPeriods)
            }));
        }
        if (params.htcRecentPeriods) {
            queryParams.set('excludeHwcRecentPeriods', JSON.stringify({
                enabled: true,
                periods: parseInt(params.htcRecentPeriods)
            }));
        }
        if (params.zoneRecentPeriods) {
            queryParams.set('excludeZoneRecentPeriods', JSON.stringify({
                enabled: true,
                periods: parseInt(params.zoneRecentPeriods)
            }));
        }
        
        // 添加自定义和值排除参数
        if (params.customSumExcludes && params.customSumExcludes.length > 0) {
            params.customSumExcludes.forEach((sum, index) => {
                if (index < 8) {
                    queryParams.append(`sumExclude${index + 1}`, sum);
                }
            });
        }
        
        // 使用缓存版本的API
        const response = await fetch(`/api/dlt/new-combination-prediction?${queryParams}`);
        
        const data = await response.json();
        
        if (data.success) {
            console.log('API请求成功，数据:', data.data);
            console.log('组合数量: ' + (data.data.combinations || []).length);
            displayDLTCombinationResults(data.data);
        } else if (data.status === 'generating') {
            // 如果正在生成，显示进度条界面并开始轮询
            contentBody.innerHTML = `
                <div class="progress-container">
                    <div class="progress-text">
                        <span class="loading-spinner"></span>
                        正在生成组合预测
                    </div>
                    <div class="progress-bar-wrapper">
                        <div class="progress-bar" id="combination-progress-bar" style="width: 0%"></div>
                    </div>
                    <div class="progress-details">
                        <div id="progress-message">初始化预测系统...</div>
                        <small>首次生成可能需要几分钟时间，请耐心等待</small>
                    </div>
                </div>
            `;
            
            if (data.cacheKey) {
                // 开始轮询状态
                await pollCombinationStatus(data.cacheKey, params);
                return; // 不执行下面的错误处理
            } else {
                throw new Error('服务器返回了无效的生成状态');
            }
        } else {
            throw new Error(data.message || '预测失败');
        }
    } catch (error) {
        console.error('组合预测请求失败:', error);
        console.error('错误堆栈:', error.stack);
        contentBody.innerHTML = `<div class="error">预测失败: ${error.message}</div>`;
    } finally {
        // 恢复按钮状态
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// 轮询组合生成状态
async function pollCombinationStatus(cacheKey, params) {
    const contentBody = document.getElementById('dlt-combination-content');
    const maxAttempts = 60; // 增加到60次，总共5分钟
    const pollInterval = 5000; // 每5秒查询一次
    let attempts = 0;
    
    const poll = async () => {
        try {
            attempts++;
            console.log(`轮询状态，第 ${attempts} 次尝试...`);
            
            // 更新进度条
            const progressBar = document.getElementById('combination-progress-bar');
            const progressMessage = document.getElementById('progress-message');
            
            if (progressBar && progressMessage) {
                const progress = Math.min((attempts / maxAttempts) * 85, 85); // 最多显示85%，留15%给最终处理
                progressBar.style.width = progress + '%';
                
                const messages = [
                    '初始化预测系统...',
                    '加载历史数据...',
                    '分析数据模式...',
                    '生成红球组合...',
                    '应用过滤条件...',
                    '计算热温冷比...',
                    '分析区间分布...',
                    '生成最终组合...',
                    '验证预测结果...',
                    '准备显示数据...'
                ];
                
                const messageIndex = Math.min(Math.floor(attempts / 3), messages.length - 1);
                progressMessage.textContent = messages[messageIndex];
            }
            
            const statusResponse = await fetch(`/api/dlt/combination-status/${cacheKey}`);
            const statusData = await statusResponse.json();
            
            if (!statusData.success) {
                throw new Error(statusData.message || '查询状态失败');
            }
            
            if (statusData.data && statusData.data.status === 'completed') {
                console.log('组合生成完成，获取结果...');
                
                // 显示100%进度
                if (progressBar && progressMessage) {
                    progressBar.style.width = '100%';
                    progressMessage.textContent = '生成完成，正在加载结果...';
                }
                
                // 短暂延迟让用户看到100%进度
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // 直接使用返回的结果
                if (statusData.data.result) {
                    displayDLTCombinationResults(statusData.data.result);
                    return;
                }
                
                // 如果没有结果数据，显示错误
                contentBody.innerHTML = '<div class="error">未找到预测结果数据</div>';
                return;
                
            } else if (statusData.data && statusData.data.status === 'failed') {
                throw new Error('组合生成失败，请重试');
            } else {
                if (attempts >= maxAttempts) {
                    throw new Error('组合生成超时。这可能是因为数据量较大，请稍后重试或减少筛选条件');
                }
                
                // 更新进度显示（使用服务器返回的进度信息）
                if (progressBar && progressMessage && statusData.data) {
                    if (statusData.data.progress) {
                        progressBar.style.width = statusData.data.progress + '%';
                    }
                    if (statusData.data.message) {
                        progressMessage.textContent = statusData.data.message;
                    }
                }
                
                // 继续轮询
                setTimeout(poll, pollInterval);
            }
            
        } catch (error) {
            console.error('轮询状态失败:', error);
            
            // 如果是超时错误，提供重试选项
            if (error.message.includes('超时')) {
                contentBody.innerHTML = `
                    <div class="error">
                        ${error.message}
                        <br><br>
                        <button class="btn btn-primary" onclick="retryGeneration('${cacheKey}')">
                            重新生成
                        </button>
                    </div>`;
            } else {
                contentBody.innerHTML = `<div class="error">获取生成状态失败: ${error.message}</div>`;
            }
            
            // 恢复按钮状态
            const btn = document.querySelector('.dlt-combination-generate-btn');
            if (btn) {
                btn.textContent = '生成组合预测';
                btn.disabled = false;
            }
        }
    };
    
    // 开始轮询
    setTimeout(poll, pollInterval);
}

// 重试生成函数
function retryGeneration(cacheKey) {
    // 清除旧的缓存
    fetch(`/api/dlt/combination-clear/${cacheKey}`, { method: 'DELETE' })
        .then(() => {
            // 重新开始生成
            generateDLTCombinationPrediction();
        })
        .catch(error => {
            console.error('清除缓存失败:', error);
            // 即使清除失败也尝试重新生成
            generateDLTCombinationPrediction();
        });
}

// 收集大乐透过滤条件
function collectDLTFilterConditions() {
    const conditions = {};
    
    // 收集自定义排除和值
    const customSumExcludes = [];
    for (let i = 1; i <= 8; i++) {
        const value = document.getElementById(`sum-exclude-${i}`).value.trim();
        if (value && !isNaN(value)) {
            customSumExcludes.push(parseInt(value));
        }
    }
    conditions.customSumExcludes = customSumExcludes;
    
    // 收集和值排除类型 - 使用单选按钮
    const selectedSumType = document.querySelector('input[name="sum-exclude-type"]:checked');
    if (selectedSumType) {
        switch (selectedSumType.value) {
            case 'recent-5':
                conditions.sumRecentPeriods = 5;
                break;
            case 'recent-10':
                conditions.sumRecentPeriods = 10;
                break;
            case 'recent-30':
                conditions.sumRecentPeriods = 30;
                break;
            case 'before-target':
                const sumBeforePeriods = document.getElementById('sum-before-custom').value.trim();
                conditions.sumBeforePeriods = sumBeforePeriods ? parseInt(sumBeforePeriods) : 10;
                break;
        }
    }
    
    // 收集和值范围排除条件
    for (let i = 1; i <= 3; i++) {
        const startValue = document.getElementById(`sum-range-${i}-start`).value.trim();
        const endValue = document.getElementById(`sum-range-${i}-end`).value.trim();
        
        if (startValue && !isNaN(startValue)) {
            conditions[`sumRangeStart${i}`] = parseInt(startValue);
        }
        if (endValue && !isNaN(endValue)) {
            conditions[`sumRangeEnd${i}`] = parseInt(endValue);
        }
    }
    
    // 收集热温冷比排除条件
    const htcExcludeType = document.querySelector('input[name="htc-exclude-type"]:checked').value;
    switch (htcExcludeType) {
        case 'recent-5':
            conditions.htcRecentPeriods = 5;
            break;
        case 'recent-10':
            conditions.htcRecentPeriods = 10;
            break;
        case 'recent-30':
            conditions.htcRecentPeriods = 30;
            break;
        case 'before-target':
            const htcBeforePeriods = document.getElementById('htc-before-custom').value.trim();
            conditions.htcBeforePeriods = htcBeforePeriods ? parseInt(htcBeforePeriods) : null;
            break;
    }
    
    // 热温冷按走势图固定规则，不需要分析周期参数
    // conditions.htcAnalysisPeriods = 固定规则：热号(≤4)、温号(5-9)、冷号(≥10)
    
    // 收集区间比排除条件
    const zoneExcludeType = document.querySelector('input[name="zone-exclude-type"]:checked').value;
    switch (zoneExcludeType) {
        case 'recent-5':
            conditions.zoneRecentPeriods = 5;
            break;
        case 'recent-10':
            conditions.zoneRecentPeriods = 10;
            break;
        case 'recent-30':
            conditions.zoneRecentPeriods = 30;
            break;
        case 'before-target':
            const zoneBeforePeriods = document.getElementById('zone-before-custom').value.trim();
            conditions.zoneBeforePeriods = zoneBeforePeriods ? parseInt(zoneBeforePeriods) : null;
            break;
    }
    
    return conditions;
}

/**
 * 打开规律分析窗口
 */
async function openPatternAnalysis() {
    try {
        console.log('🎯 正在打开规律分析窗口...');
        const result = await window.electronAPI.openPatternAnalysis();
        if (result.success) {
            console.log('✅ 规律分析窗口已打开');
        }
    } catch (error) {
        console.error('❌ 打开规律分析窗口失败:', error);
        alert('打开规律分析窗口失败: ' + error.message);
    }
}

// 旧版大乐透显示函数已删除，请使用新版界面 (dlt-module.js 中的 displayDLTCombinationResultsV3)