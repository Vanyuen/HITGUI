/**
 * 替换 dlt-expert 面板为新的和值预测批量验证UI
 */

const fs = require('fs');

// 新的和值预测批量验证面板HTML
const newPanelHTML = `                    <div id="dlt-expert" class="panel-content">
                        <div class="content-header">
                            <h2>🎯 和值预测批量验证</h2>
                            <p style="color: #666; font-size: 13px; margin: 5px 0 0 0;">通过历史数据批量验证和值预测策略的准确率</p>
                        </div>
                        <div class="content-body" id="dlt-sum-prediction-body">
                            <!-- 配置区域 -->
                            <div class="sum-pred-config-panel" style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px;">

                                <!-- 期号范围配置 -->
                                <div class="config-section" style="margin-bottom: 20px;">
                                    <h4 style="margin: 0 0 10px 0; color: #495057;">📅 验证期号范围</h4>
                                    <div style="display: flex; gap: 15px; flex-wrap: wrap; align-items: center;">
                                        <label style="display: flex; align-items: center; cursor: pointer;">
                                            <input type="radio" name="sum-pred-range-type" value="recent" checked style="margin-right: 5px;">
                                            <span>最近</span>
                                            <input type="number" id="sum-pred-recent-count" value="100" min="10" max="2000" style="width: 80px; margin: 0 5px; padding: 5px; border: 1px solid #ced4da; border-radius: 4px;">
                                            <span>期</span>
                                        </label>
                                        <label style="display: flex; align-items: center; cursor: pointer;">
                                            <input type="radio" name="sum-pred-range-type" value="all" style="margin-right: 5px;">
                                            <span>全部历史期号</span>
                                        </label>
                                        <label style="display: flex; align-items: center; cursor: pointer;">
                                            <input type="radio" name="sum-pred-range-type" value="custom" style="margin-right: 5px;">
                                            <span>自定义</span>
                                            <input type="text" id="sum-pred-start-issue" placeholder="起始期号" style="width: 80px; margin: 0 5px; padding: 5px; border: 1px solid #ced4da; border-radius: 4px;">
                                            <span>-</span>
                                            <input type="text" id="sum-pred-end-issue" placeholder="结束期号" style="width: 80px; margin: 0 5px; padding: 5px; border: 1px solid #ced4da; border-radius: 4px;">
                                        </label>
                                    </div>
                                </div>

                                <!-- 训练窗口配置 -->
                                <div class="config-section" style="margin-bottom: 20px;">
                                    <h4 style="margin: 0 0 10px 0; color: #495057;">⚙️ 训练窗口</h4>
                                    <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                                        <button class="sum-pred-window-btn" data-window="20" style="padding: 8px 15px; border: 1px solid #ced4da; background: #fff; border-radius: 4px; cursor: pointer;">20期</button>
                                        <button class="sum-pred-window-btn active" data-window="30" style="padding: 8px 15px; border: 2px solid #007bff; background: #e7f1ff; border-radius: 4px; cursor: pointer;">30期</button>
                                        <button class="sum-pred-window-btn" data-window="50" style="padding: 8px 15px; border: 1px solid #ced4da; background: #fff; border-radius: 4px; cursor: pointer;">50期</button>
                                        <button class="sum-pred-window-btn" data-window="100" style="padding: 8px 15px; border: 1px solid #ced4da; background: #fff; border-radius: 4px; cursor: pointer;">100期</button>
                                        <span style="margin-left: 10px;">自定义:</span>
                                        <input type="number" id="sum-pred-custom-window" placeholder="期数" min="10" max="200" style="width: 80px; padding: 5px; border: 1px solid #ced4da; border-radius: 4px;">
                                        <span style="color: #6c757d; font-size: 12px;">💡 每期预测基于目标期号前N期历史数据计算</span>
                                    </div>
                                </div>

                                <!-- 前区和值预测策略 -->
                                <div class="config-section" style="margin-bottom: 20px; padding: 15px; background: #fff3cd; border-radius: 8px;">
                                    <h4 style="margin: 0 0 10px 0; color: #856404;">🔴 前区和值预测策略</h4>
                                    <div style="margin-bottom: 15px;">
                                        <label style="font-weight: 500;">预测方法:</label>
                                        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px;">
                                            <label style="display: flex; align-items: center; cursor: pointer;">
                                                <input type="radio" name="sum-pred-front-method" value="ma" checked style="margin-right: 5px;">
                                                <span>MA均线</span>
                                            </label>
                                            <label style="display: flex; align-items: center; cursor: pointer;">
                                                <input type="radio" name="sum-pred-front-method" value="weighted_ma" style="margin-right: 5px;">
                                                <span>加权MA</span>
                                            </label>
                                            <label style="display: flex; align-items: center; cursor: pointer;">
                                                <input type="radio" name="sum-pred-front-method" value="regression" style="margin-right: 5px;">
                                                <span>线性回归</span>
                                            </label>
                                            <label style="display: flex; align-items: center; cursor: pointer;">
                                                <input type="radio" name="sum-pred-front-method" value="fixed_range" style="margin-right: 5px;">
                                                <span>固定范围</span>
                                            </label>
                                            <label style="display: flex; align-items: center; cursor: pointer;">
                                                <input type="radio" name="sum-pred-front-method" value="history_set" style="margin-right: 5px;">
                                                <span>历史和值集</span>
                                            </label>
                                        </div>
                                    </div>
                                    <div id="sum-pred-front-ma-params" style="display: flex; gap: 20px; flex-wrap: wrap;">
                                        <div>
                                            <label>MA周期:</label>
                                            <select id="sum-pred-front-ma-period" style="padding: 5px; border: 1px solid #ced4da; border-radius: 4px; margin-left: 5px;">
                                                <option value="5">5期</option>
                                                <option value="10">10期</option>
                                                <option value="15">15期</option>
                                                <option value="20" selected>20期</option>
                                                <option value="30">30期</option>
                                                <option value="50">50期</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label>范围扩展:</label>
                                            <select id="sum-pred-front-range-expand" style="padding: 5px; border: 1px solid #ced4da; border-radius: 4px; margin-left: 5px;">
                                                <option value="5">±5</option>
                                                <option value="8">±8</option>
                                                <option value="10" selected>±10</option>
                                                <option value="12">±12</option>
                                                <option value="15">±15</option>
                                                <option value="20">±20</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div id="sum-pred-front-fixed-params" style="display: none; gap: 20px; flex-wrap: wrap;">
                                        <div>
                                            <label>固定范围:</label>
                                            <input type="number" id="sum-pred-front-fixed-min" placeholder="最小值" min="15" max="175" style="width: 80px; padding: 5px; border: 1px solid #ced4da; border-radius: 4px; margin-left: 5px;">
                                            <span>-</span>
                                            <input type="number" id="sum-pred-front-fixed-max" placeholder="最大值" min="15" max="175" style="width: 80px; padding: 5px; border: 1px solid #ced4da; border-radius: 4px;">
                                        </div>
                                    </div>
                                    <div id="sum-pred-front-history-params" style="display: none; gap: 20px; flex-wrap: wrap;">
                                        <div>
                                            <label>匹配模式:</label>
                                            <select id="sum-pred-front-history-mode" style="padding: 5px; border: 1px solid #ced4da; border-radius: 4px; margin-left: 5px;">
                                                <option value="range" selected>范围模式</option>
                                                <option value="exact">精确匹配</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label>范围扩展:</label>
                                            <select id="sum-pred-front-history-expand" style="padding: 5px; border: 1px solid #ced4da; border-radius: 4px; margin-left: 5px;">
                                                <option value="0" selected>±0</option>
                                                <option value="3">±3</option>
                                                <option value="5">±5</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <!-- 后区和值预测策略 -->
                                <div class="config-section" style="margin-bottom: 20px; padding: 15px; background: #cce5ff; border-radius: 8px;">
                                    <h4 style="margin: 0 0 10px 0; color: #004085;">🔵 后区和值预测策略</h4>
                                    <div style="margin-bottom: 15px;">
                                        <label style="font-weight: 500;">预测方法:</label>
                                        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 8px;">
                                            <label style="display: flex; align-items: center; cursor: pointer;">
                                                <input type="radio" name="sum-pred-back-method" value="ma" checked style="margin-right: 5px;">
                                                <span>MA均线</span>
                                            </label>
                                            <label style="display: flex; align-items: center; cursor: pointer;">
                                                <input type="radio" name="sum-pred-back-method" value="weighted_ma" style="margin-right: 5px;">
                                                <span>加权MA</span>
                                            </label>
                                            <label style="display: flex; align-items: center; cursor: pointer;">
                                                <input type="radio" name="sum-pred-back-method" value="regression" style="margin-right: 5px;">
                                                <span>线性回归</span>
                                            </label>
                                            <label style="display: flex; align-items: center; cursor: pointer;">
                                                <input type="radio" name="sum-pred-back-method" value="fixed_range" style="margin-right: 5px;">
                                                <span>固定范围</span>
                                            </label>
                                            <label style="display: flex; align-items: center; cursor: pointer;">
                                                <input type="radio" name="sum-pred-back-method" value="history_set" style="margin-right: 5px;">
                                                <span>历史和值集</span>
                                            </label>
                                        </div>
                                    </div>
                                    <div id="sum-pred-back-ma-params" style="display: flex; gap: 20px; flex-wrap: wrap;">
                                        <div>
                                            <label>MA周期:</label>
                                            <select id="sum-pred-back-ma-period" style="padding: 5px; border: 1px solid #ced4da; border-radius: 4px; margin-left: 5px;">
                                                <option value="5">5期</option>
                                                <option value="10" selected>10期</option>
                                                <option value="15">15期</option>
                                                <option value="20">20期</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label>范围扩展:</label>
                                            <select id="sum-pred-back-range-expand" style="padding: 5px; border: 1px solid #ced4da; border-radius: 4px; margin-left: 5px;">
                                                <option value="2">±2</option>
                                                <option value="3" selected>±3</option>
                                                <option value="5">±5</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div id="sum-pred-back-fixed-params" style="display: none; gap: 20px; flex-wrap: wrap;">
                                        <div>
                                            <label>固定范围:</label>
                                            <input type="number" id="sum-pred-back-fixed-min" placeholder="最小值" min="3" max="24" style="width: 80px; padding: 5px; border: 1px solid #ced4da; border-radius: 4px; margin-left: 5px;">
                                            <span>-</span>
                                            <input type="number" id="sum-pred-back-fixed-max" placeholder="最大值" min="3" max="24" style="width: 80px; padding: 5px; border: 1px solid #ced4da; border-radius: 4px;">
                                        </div>
                                    </div>
                                    <div id="sum-pred-back-history-params" style="display: none; gap: 20px; flex-wrap: wrap;">
                                        <div>
                                            <label>匹配模式:</label>
                                            <select id="sum-pred-back-history-mode" style="padding: 5px; border: 1px solid #ced4da; border-radius: 4px; margin-left: 5px;">
                                                <option value="range" selected>范围模式</option>
                                                <option value="exact">精确匹配</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label>范围扩展:</label>
                                            <select id="sum-pred-back-history-expand" style="padding: 5px; border: 1px solid #ced4da; border-radius: 4px; margin-left: 5px;">
                                                <option value="0" selected>±0</option>
                                                <option value="2">±2</option>
                                                <option value="3">±3</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <!-- 技术分析增强（可选） -->
                                <div class="config-section" style="margin-bottom: 20px;">
                                    <div style="display: flex; align-items: center; justify-content: space-between;">
                                        <h4 style="margin: 0; color: #495057;">🔬 技术分析增强 (可选)</h4>
                                        <label style="display: flex; align-items: center; cursor: pointer;">
                                            <input type="checkbox" id="sum-pred-tech-enabled" style="margin-right: 5px;">
                                            <span>启用</span>
                                        </label>
                                    </div>
                                    <div id="sum-pred-tech-params" style="display: none; margin-top: 15px; padding: 15px; background: #e9ecef; border-radius: 8px;">
                                        <div style="display: flex; gap: 30px; flex-wrap: wrap;">
                                            <label style="display: flex; align-items: center; cursor: pointer;">
                                                <input type="checkbox" id="sum-pred-rsi-enabled" style="margin-right: 5px;">
                                                <span>RSI (周期: 14)</span>
                                            </label>
                                            <label style="display: flex; align-items: center; cursor: pointer;">
                                                <input type="checkbox" id="sum-pred-macd-enabled" style="margin-right: 5px;">
                                                <span>MACD (12/26/9)</span>
                                            </label>
                                            <label style="display: flex; align-items: center; cursor: pointer;">
                                                <input type="checkbox" id="sum-pred-bollinger-enabled" style="margin-right: 5px;">
                                                <span>布林带 (20期, 2σ)</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <!-- 操作按钮 -->
                                <div class="config-section" style="display: flex; gap: 15px; flex-wrap: wrap;">
                                    <button id="sum-pred-create-task-btn" style="padding: 12px 25px; background: linear-gradient(135deg, #007bff, #0056b3); color: white; border: none; border-radius: 8px; font-size: 15px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                                        🚀 创建验证任务
                                    </button>
                                    <button id="sum-pred-auto-optimize-btn" style="padding: 12px 25px; background: linear-gradient(135deg, #28a745, #1e7e34); color: white; border: none; border-radius: 8px; font-size: 15px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                                        🔍 自动寻优
                                    </button>
                                    <button id="sum-pred-refresh-tasks-btn" style="padding: 12px 25px; background: #6c757d; color: white; border: none; border-radius: 8px; font-size: 15px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                                        🔄 刷新任务列表
                                    </button>
                                </div>
                            </div>

                            <!-- 任务列表区域 -->
                            <div class="sum-pred-task-list-panel" style="background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px;">
                                <h4 style="margin: 0 0 15px 0; color: #495057;">📋 任务列表</h4>
                                <div id="sum-pred-task-list" style="min-height: 100px;">
                                    <div style="text-align: center; color: #6c757d; padding: 30px;">
                                        <p>🎯 暂无任务</p>
                                        <p style="font-size: 13px;">配置参数后点击"创建验证任务"开始</p>
                                    </div>
                                </div>
                            </div>

                            <!-- 任务详情/结果区域（弹窗） -->
                            <div id="sum-pred-task-detail-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; overflow-y: auto;">
                                <div style="background: #fff; margin: 50px auto; max-width: 1200px; border-radius: 12px; max-height: 90vh; overflow-y: auto;">
                                    <div style="padding: 20px; border-bottom: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: #fff; z-index: 10;">
                                        <h3 style="margin: 0;" id="sum-pred-detail-title">任务详情</h3>
                                        <button id="sum-pred-close-detail-btn" style="background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
                                    </div>
                                    <div id="sum-pred-detail-content" style="padding: 20px;">
                                        <!-- 动态填充 -->
                                    </div>
                                </div>
                            </div>

                            <!-- 自动寻优结果弹窗 -->
                            <div id="sum-pred-optimize-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; overflow-y: auto;">
                                <div style="background: #fff; margin: 50px auto; max-width: 900px; border-radius: 12px; max-height: 90vh; overflow-y: auto;">
                                    <div style="padding: 20px; border-bottom: 1px solid #dee2e6; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: #fff; z-index: 10;">
                                        <h3 style="margin: 0;">🏆 自动寻优结果</h3>
                                        <button id="sum-pred-close-optimize-btn" style="background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
                                    </div>
                                    <div id="sum-pred-optimize-content" style="padding: 20px;">
                                        <!-- 动态填充 -->
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>`;

// 读取HTML文件
let content = fs.readFileSync('E:/HITGUI/src/renderer/index.html', 'utf8');

// 查找第一个dlt-expert面板的开始位置
const panelStartMarker = '<div id="dlt-expert" class="panel-content">';
const firstPanelStart = content.indexOf(panelStartMarker);

if (firstPanelStart === -1) {
    console.log('❌ 未找到dlt-expert面板');
    process.exit(1);
}

// 查找面板结束位置 - 从开始位置向后找到配对的</div>和下一个面板注释
// 简化方法：找到"<!-- 组合预测面板 -->"之前的</div>
const nextPanelComment = '<!-- 组合预测面板 -->';
const nextPanelPos = content.indexOf(nextPanelComment, firstPanelStart);

if (nextPanelPos === -1) {
    console.log('❌ 未找到下一个面板标记');
    process.exit(1);
}

// 从nextPanelPos向前找最近的</div>
let searchPos = nextPanelPos - 1;
while (searchPos > firstPanelStart && content.substring(searchPos, searchPos + 6) !== '</div>') {
    searchPos--;
}

if (searchPos <= firstPanelStart) {
    console.log('❌ 未找到面板结束标签');
    process.exit(1);
}

// 构建新内容
const beforePanel = content.substring(0, firstPanelStart);
const afterPanel = content.substring(searchPos + 6); // +6 跳过 '</div>'

const newContent = beforePanel + newPanelHTML + afterPanel;

// 写入文件
fs.writeFileSync('E:/HITGUI/src/renderer/index.html', newContent);
console.log('✅ dlt-expert面板已成功替换为新的和值预测批量验证UI');
console.log(`   - 开始位置: ${firstPanelStart}`);
console.log(`   - 结束位置: ${searchPos + 6}`);
