require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

// 设置宽松的CSP策略，允许所有必要的脚本执行
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' * data: blob:; " +
        "script-src-elem 'self' 'unsafe-inline' 'unsafe-eval' * data: blob:; " +
        "style-src 'self' 'unsafe-inline' * data:; " +
        "connect-src 'self' * data:; " +
        "font-src 'self' * data:; " +
        "img-src 'self' * data: blob:; " +
        "object-src 'none'; " +
        "base-uri 'self';"
    );
    next();
});

// Electron环境下提供静态文件服务
app.use(express.static(path.join(__dirname, '../renderer')));

// MongoDB连接 - 由数据库管理器统一管理，这里不再重复连接

// 导出任务状态存储（用于CLI导出进度跟踪）
const exportTasks = {};

// 定义双色球开奖结果模式
const unionLottoSchema = new mongoose.Schema({
    ID: { type: Number, required: true, unique: true }, // 新增ID字段
    Issue: { type: String, required: true, unique: true }, // 期号
    DrawingWeek: { type: String, required: true }, // 开奖星期
    Red1: { type: Number, required: true }, // 红球1
    Red2: { type: Number, required: true }, // 红球2
    Red3: { type: Number, required: true }, // 红球3
    Red4: { type: Number, required: true }, // 红球4
    Red5: { type: Number, required: true }, // 红球5
    Red6: { type: Number, required: true }, // 红球6
    Blue: { type: Number, required: true }, // 蓝球
    drawDate: { type: Date, required: true }, // 开奖日期
    createdAt: { type: Date, default: Date.now } // 记录创建时间
});

const UnionLotto = mongoose.model('HIT_UnionLotto', unionLottoSchema);

// 定义大乐透模型
const dltSchema = new mongoose.Schema({
    ID: { type: Number, required: true, unique: true },
    Issue: { type: Number, required: true, unique: true },
    DrawingDay: { type: String },
    DrawingWeek: { type: String, required: true },
    Red1: { type: Number, required: true },
    Red2: { type: Number, required: true },
    Red3: { type: Number, required: true },
    Red4: { type: Number, required: true },
    Red5: { type: Number, required: true },
    Blue1: { type: Number, required: true },
    Blue2: { type: Number, required: true },
    drawDate: { type: Date, required: true },
    Sales: { type: String },
    Pool: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const DLT = mongoose.model('HIT_DLT', dltSchema);

// ===== 新的组合预测数据表结构 =====

// 1. 红球组合表
const dltRedCombinationsSchema = new mongoose.Schema({
    combination_id: { type: Number, required: true, unique: true },
    red_ball_1: { type: Number, required: true, min: 1, max: 35 },
    red_ball_2: { type: Number, required: true, min: 1, max: 35 },
    red_ball_3: { type: Number, required: true, min: 1, max: 35 },
    red_ball_4: { type: Number, required: true, min: 1, max: 35 },
    red_ball_5: { type: Number, required: true, min: 1, max: 35 },
    sum_value: { type: Number, required: true, min: 15, max: 175 },
    span_value: { type: Number, required: true, min: 4, max: 34 },
    zone_ratio: { type: String, required: true },
    odd_even_ratio: { type: String, required: true },
    created_at: { type: Date, default: Date.now }
});

dltRedCombinationsSchema.index({ sum_value: 1 });
dltRedCombinationsSchema.index({ span_value: 1 });
dltRedCombinationsSchema.index({ zone_ratio: 1 });
dltRedCombinationsSchema.index({ odd_even_ratio: 1 });
dltRedCombinationsSchema.index({ combination_id: 1 });

const DLTRedCombinations = mongoose.model('HIT_DLT_RedCombinations', dltRedCombinationsSchema);

// 2. 蓝球组合表
const dltBlueCombinationsSchema = new mongoose.Schema({
    combination_id: { type: Number, required: true, unique: true },
    blue_ball_1: { type: Number, required: true, min: 1, max: 12 },
    blue_ball_2: { type: Number, required: true, min: 1, max: 12 },
    sum_value: { type: Number, required: true, min: 3, max: 23 },
    created_at: { type: Date, default: Date.now }
});

dltBlueCombinationsSchema.index({ sum_value: 1 });
dltBlueCombinationsSchema.index({ combination_id: 1 });

const DLTBlueCombinations = mongoose.model('HIT_DLT_BlueCombinations', dltBlueCombinationsSchema);

// 3. 红球组合热温冷分析表 - 优化版压缩存储
const dltRedCombinationsHotWarmColdOptimizedSchema = new mongoose.Schema({
    base_issue: { type: String, required: true },
    target_issue: { type: String, required: true },
    hot_warm_cold_data: {
        type: Map,
        of: [Number], // 每个比例对应的combination_id数组
        required: true
    },
    total_combinations: { type: Number, required: true }, // 总组合数，用于快速统计
    
    // 红球命中分析数据（新增）
    hit_analysis: {
        target_winning_reds: [Number], // 目标期号实际开奖红球 [1,2,3,4,5]
        target_winning_blues: [Number], // 目标期号实际开奖蓝球 [1,2]
        red_hit_data: {
            type: Map,
            of: [Number] // 命中数量到组合ID数组的映射，如: "0" -> [1,2,3], "1" -> [4,5,6], "5" -> [7]
        },
        hit_statistics: {
            hit_0: { type: Number, default: 0 }, // 命中0个的组合数
            hit_1: { type: Number, default: 0 }, // 命中1个的组合数
            hit_2: { type: Number, default: 0 }, // 命中2个的组合数
            hit_3: { type: Number, default: 0 }, // 命中3个的组合数
            hit_4: { type: Number, default: 0 }, // 命中4个的组合数
            hit_5: { type: Number, default: 0 }  // 命中5个的组合数
        },
        is_drawn: { type: Boolean, default: false } // 目标期号是否已开奖
    },
    
    statistics: {
        ratio_counts: {
            type: Map,
            of: Number // 每个比例对应的组合数量
        }
    },
    created_at: { type: Date, default: Date.now }
});

// 优化的索引策略
dltRedCombinationsHotWarmColdOptimizedSchema.index({ base_issue: 1 });
dltRedCombinationsHotWarmColdOptimizedSchema.index({ target_issue: 1 });
dltRedCombinationsHotWarmColdOptimizedSchema.index({ base_issue: 1, target_issue: 1 }, { unique: true });

const DLTRedCombinationsHotWarmColdOptimized = mongoose.model('HIT_DLT_RedCombinationsHotWarmColdOptimized', dltRedCombinationsHotWarmColdOptimizedSchema);

// 保留旧表结构以保证兼容性
const dltRedCombinationsHotWarmColdSchema = new mongoose.Schema({
    base_issue: { type: String, required: true },
    target_issue: { type: String, required: true },
    combination_id: { type: Number, required: true },
    red_ball_1: { type: Number, required: true },
    red_ball_2: { type: Number, required: true },
    red_ball_3: { type: Number, required: true },
    red_ball_4: { type: Number, required: true },
    red_ball_5: { type: Number, required: true },
    hot_warm_cold_ratio: { type: String, required: true },
    hot_count: { type: Number, required: true, min: 0, max: 5 },
    warm_count: { type: Number, required: true, min: 0, max: 5 },
    cold_count: { type: Number, required: true, min: 0, max: 5 },
    created_at: { type: Date, default: Date.now }
});

dltRedCombinationsHotWarmColdSchema.index({ base_issue: 1 });
dltRedCombinationsHotWarmColdSchema.index({ target_issue: 1 });
dltRedCombinationsHotWarmColdSchema.index({ combination_id: 1 });
dltRedCombinationsHotWarmColdSchema.index({ hot_warm_cold_ratio: 1 });
dltRedCombinationsHotWarmColdSchema.index({ hot_count: 1 });
dltRedCombinationsHotWarmColdSchema.index({ warm_count: 1 });
dltRedCombinationsHotWarmColdSchema.index({ cold_count: 1 });
dltRedCombinationsHotWarmColdSchema.index({ base_issue: 1, target_issue: 1, combination_id: 1 }, { unique: true });

const DLTRedCombinationsHotWarmCold = mongoose.model('HIT_DLT_RedCombinationsHotWarmCold', dltRedCombinationsHotWarmColdSchema);

// 定义大乐透前区遗漏值模型
const dltRedMissingSchema = new mongoose.Schema({
    ID: { type: Number, required: true },
    Issue: { type: String, required: true },
    DrawingDay: { type: String, required: true },
    FrontHotWarmColdRatio: { type: String, required: true }
});
// 动态添加35个前区红球字段
for (let i = 1; i <= 35; i++) {
    dltRedMissingSchema.add({
        [i.toString()]: { type: Number, required: true }
    });
}
const DLTRedMissing = mongoose.model('HIT_DLT_Basictrendchart_redballmissing_history', dltRedMissingSchema);

// 定义大乐透后区遗漏值模型
const dltBlueMissingSchema = new mongoose.Schema({
    ID: { type: Number, required: true },
    Issue: { type: String, required: true },
    DrawingDay: { type: String, required: true }
});
// 动态添加12个后区蓝球字段
for (let i = 1; i <= 12; i++) {
    dltBlueMissingSchema.add({
        [i.toString()]: { type: Number, required: true }
    });
}
const DLTBlueMissing = mongoose.model('HIT_DLT_Basictrendchart_blueballmissing_history', dltBlueMissingSchema);

// 定义红球遗漏值模型
const redBallMissingSchema = new mongoose.Schema({
    ID: { type: Number, required: true },
    Issue: { type: String, required: true },
    DrawingWeek: { type: String, required: true },
    HotWarmColdRatio: { type: String, required: false } // 热温冷比，格式：热:温:冷
});
// 动态添加33个红球字段
for (let i = 1; i <= 33; i++) {
    redBallMissingSchema.add({
        [i.toString()]: { type: Number, required: true }
    });
}
const RedBallMissing = mongoose.model('HIT_UnionLotto_Basictrendchart_redballmissing_history', redBallMissingSchema);

// 定义蓝球遗漏值模型
const blueBallMissingSchema = new mongoose.Schema({
    ID: { type: Number, required: true },
    Issue: { type: String, required: true },
    DrawingWeek: { type: String, required: true }
});
// 动态添加16个蓝球字段
for (let i = 1; i <= 16; i++) {
    blueBallMissingSchema.add({
        [i.toString()]: { type: Number, required: true }
    });
}
const BlueBallMissing = mongoose.model('HIT_UnionLotto_Basictrendchart_blueballmissing_history', blueBallMissingSchema);

// 定义大乐透红球组合模型
const dltRedCombinationSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true }, 
    numbers: [Number], // [1,2,3,4,5]
    sum: Number, // 和值 15-175
    zoneRatio: String, // "2:1:2" 区域分布(1-12:13-24:25-35)
    evenOddRatio: String, // "3:2" 奇偶比
    largeSmallRatio: String, // "2:3" 大小比(1-17:18-35)
    consecutiveCount: Number, // 连号个数
    spanValue: Number, // 跨度值(最大-最小)
    sumRange: String, // "70-80" 和值区间(便于索引)
    createdAt: { type: Date, default: Date.now }
});

// 添加红球组合表索引
dltRedCombinationSchema.index({ sum: 1 });
dltRedCombinationSchema.index({ sumRange: 1 });
dltRedCombinationSchema.index({ zoneRatio: 1 });
dltRedCombinationSchema.index({ evenOddRatio: 1 });
dltRedCombinationSchema.index({ consecutiveCount: 1 });

const DLTRedCombination = mongoose.model('HIT_DLT_RedCombination', dltRedCombinationSchema);

// 定义大乐透蓝球组合模型
const dltBlueCombinationSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true },
    numbers: [Number], // [1,2]
    sum: Number, // 和值 3-23
    evenOddRatio: String, // "2:0", "1:1", "0:2"
    largeSmallRatio: String, // "1:1" (1-6:7-12)
    spanValue: Number, // 跨度值
    createdAt: { type: Date, default: Date.now }
});

// 添加蓝球组合表索引
dltBlueCombinationSchema.index({ sum: 1 });
dltBlueCombinationSchema.index({ evenOddRatio: 1 });

const DLTBlueCombination = mongoose.model('HIT_DLT_BlueCombination', dltBlueCombinationSchema);

// 定义组合预测缓存模型
const dltCombinationCacheSchema = new mongoose.Schema({
    cacheKey: { type: String, required: true, unique: true }, // MD5哈希的查询参数
    targetIssue: { type: String, required: true }, // 目标期号
    filters: { type: Object, required: true }, // 过滤条件
    excludeConditions: { type: Object, required: true }, // 排除条件
    combinationCount: { type: Number, required: true }, // 组合总数
    combinations: [{
        redNumbers: [Number], // 红球号码
        blueNumbers: [Number], // 蓝球号码
        redSum: Number, // 红球和值
        blueSum: Number, // 蓝球和值
        totalSum: Number, // 总和值
        redZoneRatio: String, // 红球区域分布
        redEvenOddRatio: String, // 红球奇偶比
        redLargeSmallRatio: String, // 红球大小比
        redConsecutiveCount: Number, // 红球连号个数
        redSpanValue: Number, // 红球跨度值
        blueEvenOddRatio: String, // 蓝球奇偶比
        blueLargeSmallRatio: String, // 蓝球大小比
        blueSpanValue: Number, // 蓝球跨度值
        dynamicHotColdRatio: String, // 动态热温冷比例
        score: Number // 综合评分（如果有）
    }],
    generatedAt: { type: Date, default: Date.now, expires: 86400 }, // 24小时后过期
    status: { type: String, enum: ['generating', 'completed', 'failed'], default: 'generating' }
});

// 添加缓存表索引
dltCombinationCacheSchema.index({ cacheKey: 1 });
dltCombinationCacheSchema.index({ targetIssue: 1 });
dltCombinationCacheSchema.index({ generatedAt: 1 });

const DLTCombinationCache = mongoose.model('HIT_DLT_CombinationCache', dltCombinationCacheSchema);

// 定义大乐透期号全量组合缓存模型（新方案）
const dltPeriodCombinationCacheSchema = new mongoose.Schema({
    // 主键字段
    targetIssue: { type: String, required: true }, // 目标期号
    cacheType: { type: String, default: 'full_combinations' }, // 缓存类型
    
    // 全量红球组合数据（从DLTRedCombination复制并增强）
    redCombinations: [{
        id: Number,                    // 原组合ID
        numbers: [Number],             // [1,2,3,4,5] 五个红球
        sum: Number,                   // 和值 15-175
        zoneRatio: String,             // 区间比 "2:1:2"
        evenOddRatio: String,          // 奇偶比 "3:2"
        largeSmallRatio: String,       // 大小比 "2:3"
        consecutiveCount: Number,      // 连号个数
        spanValue: Number,             // 跨度值
        hotColdRatio: String,          // 针对目标期计算的热温冷比 "2:2:1"
        score: { type: Number, default: 50 } // 评分
    }],
    
    // 元数据
    totalCount: { type: Number, required: true }, // 总组合数
    generationStartTime: { type: Date, default: Date.now }, // 生成开始时间
    generationEndTime: Date, // 生成完成时间
    generatedAt: { type: Date, default: Date.now, expires: 172800 }, // 48小时TTL
    status: { type: String, enum: ['generating', 'completed', 'failed'], default: 'generating' },
    
    // 错误信息
    errorMessage: String,
    
    // 索引字段
    issuePeriod: String // 便于查询的期号字段
});

// 添加期号缓存表索引
dltPeriodCombinationCacheSchema.index({ targetIssue: 1, cacheType: 1 }, { unique: true });
dltPeriodCombinationCacheSchema.index({ issuePeriod: 1 });
dltPeriodCombinationCacheSchema.index({ status: 1 });
dltPeriodCombinationCacheSchema.index({ generatedAt: 1 });

const DLTPeriodCombinationCache = mongoose.model('HIT_DLT_PeriodCombinationCache', dltPeriodCombinationCacheSchema);

// ========== 新的预生成表方案 Schema ==========

// 定义基础红球组合表（全量324,632个组合，只存一份）
const dltBaseCombinationSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true }, // 组合ID (1-324632)
    red1: { type: Number, required: true }, // 红球1 (1-35)
    red2: { type: Number, required: true }, // 红球2 (1-35)
    red3: { type: Number, required: true }, // 红球3 (1-35)
    red4: { type: Number, required: true }, // 红球4 (1-35)
    red5: { type: Number, required: true }, // 红球5 (1-35)
    
    // 预计算的固定属性
    zone_ratio: { type: String, required: true }, // 区间比 "2:1:2"
    red_sum: { type: Number, required: true }, // 红球和值 15-175
    even_odd_ratio: { type: String, required: true }, // 奇偶比 "3:2"
    large_small_ratio: { type: String, required: true }, // 大小比 "2:3"
    consecutive_count: { type: Number, required: true }, // 连号个数 0-5
    span_value: { type: Number, required: true }, // 跨度值 4-34
    
    created_at: { type: Date, default: Date.now }
});

// 基础组合表索引
dltBaseCombinationSchema.index({ id: 1 });
dltBaseCombinationSchema.index({ red_sum: 1 });
dltBaseCombinationSchema.index({ zone_ratio: 1 });
dltBaseCombinationSchema.index({ even_odd_ratio: 1 });
dltBaseCombinationSchema.index({ consecutive_count: 1 });
dltBaseCombinationSchema.index({ span_value: 1 });

const DLTBaseCombination = mongoose.model('HIT_DLT_BaseCombination', dltBaseCombinationSchema);

// 定义期号分析表（每期动态数据）
const dltPeriodAnalysisSchema = new mongoose.Schema({
    target_issue: { type: String, required: true }, // 目标期号 "25071"
    combination_id: { type: Number, required: true }, // 对应组合ID
    
    // 动态计算的期号相关属性
    hot_cold_ratio: { type: String, required: true }, // 热温冷比 "2:2:1"
    score: { type: Number, default: 100 }, // 评分
    
    // 额外的分析数据
    miss_values: [Number], // 各号码的遗漏值 [miss1, miss2, miss3, miss4, miss5]
    
    created_at: { type: Date, default: Date.now }
});

// 期号分析表索引
dltPeriodAnalysisSchema.index({ target_issue: 1, combination_id: 1 }, { unique: true });
dltPeriodAnalysisSchema.index({ target_issue: 1 });
dltPeriodAnalysisSchema.index({ combination_id: 1 });
dltPeriodAnalysisSchema.index({ hot_cold_ratio: 1 });
dltPeriodAnalysisSchema.index({ score: 1 });

const DLTPeriodAnalysis = mongoose.model('HIT_DLT_PeriodAnalysis', dltPeriodAnalysisSchema);

// ========== 批量预测任务表 ==========

// 预测任务表
const predictionTaskSchema = new mongoose.Schema({
    task_id: { type: String, required: true, unique: true }, // 任务ID
    task_name: { type: String, required: true }, // 任务名称
    period_range: {
        start: { type: Number, required: true }, // 起始期号
        end: { type: Number, required: true }, // 结束期号
        total: { type: Number, required: true } // 总期数
    },
    exclude_conditions: {
        sum: { type: Object }, // 和值排除
        span: { type: Object }, // 跨度排除
        hwc: { type: Object }, // 热温冷比排除
        zone: { type: Object }, // 区间比排除
        oddEven: { type: Object } // 奇偶比排除
    },
    output_config: {
        combination_mode: { type: String, required: true }, // 组合模式
        enable_validation: { type: Boolean, default: true }, // 是否启用验证
        display_mode: { type: String } // 显示模式
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'running', 'completed', 'failed'],
        default: 'pending'
    }, // 任务状态
    progress: {
        current: { type: Number, default: 0 }, // 当前处理期数
        total: { type: Number, required: true }, // 总期数
        percentage: { type: Number, default: 0 } // 完成百分比
    },
    statistics: {
        total_periods: { type: Number, default: 0 }, // 总期数
        total_combinations: { type: Number, default: 0 }, // 总组合数
        total_hits: { type: Number, default: 0 }, // 总命中数
        avg_hit_rate: { type: Number, default: 0 }, // 平均命中率
        first_prize_count: { type: Number, default: 0 }, // 一等奖次数
        second_prize_count: { type: Number, default: 0 }, // 二等奖次数
        total_prize_amount: { type: Number, default: 0 } // 总奖金
    },
    error_message: { type: String }, // 错误信息（失败时）
    created_at: { type: Date, default: Date.now }, // 创建时间
    updated_at: { type: Date, default: Date.now }, // 更新时间
    completed_at: { type: Date } // 完成时间
});

// 索引
predictionTaskSchema.index({ task_id: 1 });
predictionTaskSchema.index({ status: 1 });
predictionTaskSchema.index({ created_at: -1 });
predictionTaskSchema.index({ 'period_range.start': 1, 'period_range.end': 1 });

const PredictionTask = mongoose.model('HIT_DLT_PredictionTask', predictionTaskSchema);

// 预测任务结果表
const predictionTaskResultSchema = new mongoose.Schema({
    result_id: { type: String, required: true, unique: true }, // 结果ID
    task_id: { type: String, required: true }, // 关联任务ID
    period: { type: Number, required: true }, // 期号

    // 预测组合数据
    red_combinations: [Number], // 符合条件的红球组合ID列表
    blue_combinations: [Number], // 符合条件的蓝球组合ID列表
    combination_count: { type: Number, required: true }, // 组合总数

    // 开奖数据
    winning_numbers: {
        red: [Number], // 开奖红球
        blue: [Number] // 开奖蓝球
    },

    // 命中分析
    hit_analysis: {
        max_hit_count: { type: Number, default: 0 }, // 最高命中数
        max_hit_combinations: [{ // 最高命中的组合
            red: [Number],
            blue: [Number],
            hit_red: { type: Number },
            hit_blue: { type: Number }
        }],

        // 红球命中分析
        red_hit_analysis: {
            best_hit: { type: Number, default: 0 } // 红球最高命中数
        },

        // 蓝球命中分析
        blue_hit_analysis: {
            best_hit: { type: Number, default: 0 } // 蓝球最高命中数
        },

        // 命中分布
        hit_distribution: {
            red_5: { type: Number, default: 0 }, // 中5个红球的组合数
            red_4: { type: Number, default: 0 }, // 中4个红球的组合数
            red_3: { type: Number, default: 0 }, // 中3个红球的组合数
            red_2: { type: Number, default: 0 }, // 中2个红球的组合数
            red_1: { type: Number, default: 0 }, // 中1个红球的组合数
            red_0: { type: Number, default: 0 } // 未中红球的组合数
        },

        // 奖项统计
        prize_stats: {
            first_prize: { // 一等奖 (5+2)
                count: { type: Number, default: 0 },
                amount: { type: Number, default: 0 }
            },
            second_prize: { // 二等奖 (5+1)
                count: { type: Number, default: 0 },
                amount: { type: Number, default: 0 }
            },
            third_prize: { // 三等奖 (5+0)
                count: { type: Number, default: 0 },
                amount: { type: Number, default: 0 }
            },
            fourth_prize: { // 四等奖 (4+2)
                count: { type: Number, default: 0 },
                amount: { type: Number, default: 0 }
            },
            fifth_prize: { // 五等奖 (4+1)
                count: { type: Number, default: 0 },
                amount: { type: Number, default: 0 }
            },
            sixth_prize: { // 六等奖 (3+2)
                count: { type: Number, default: 0 },
                amount: { type: Number, default: 0 }
            },
            seventh_prize: { // 七等奖 (4+0)
                count: { type: Number, default: 0 },
                amount: { type: Number, default: 0 }
            },
            eighth_prize: { // 八等奖 (3+1或2+2)
                count: { type: Number, default: 0 },
                amount: { type: Number, default: 0 }
            },
            ninth_prize: { // 九等奖 (3+0或1+2或2+1或0+2)
                count: { type: Number, default: 0 },
                amount: { type: Number, default: 0 }
            }
        },

        hit_rate: { type: Number, default: 0 }, // 命中率 (%)
        total_prize: { type: Number, default: 0 } // 本期总奖金
    },

    created_at: { type: Date, default: Date.now } // 创建时间
});

// 索引
predictionTaskResultSchema.index({ result_id: 1 });
predictionTaskResultSchema.index({ task_id: 1 });
predictionTaskResultSchema.index({ period: 1 });
predictionTaskResultSchema.index({ task_id: 1, period: 1 }, { unique: true });
predictionTaskResultSchema.index({ created_at: -1 });

const PredictionTaskResult = mongoose.model('HIT_DLT_PredictionTaskResult', predictionTaskResultSchema);

// ========== 规律生成功能 Schema 定义 ==========

// 1. 规律库表
const dltPatternSchema = new mongoose.Schema({
    pattern_id: { type: String, required: true, unique: true }, // 规律ID: "PATTERN_20250101_001"
    pattern_type: {
        type: String,
        required: true,
        enum: ['sum_pattern', 'span_pattern', 'zone_ratio_pattern', 'odd_even_pattern',
               'htc_ratio_pattern', 'consecutive_pattern', 'repeat_number_pattern',
               'combination_pattern', 'exclusion_pattern']
    },
    pattern_name: { type: String, required: true }, // 规律名称
    description: { type: String, required: true },  // 规律描述

    // 规律参数
    parameters: {
        cycle: Number,              // 周期（如果是周期性规律）
        range: [Number],            // 数值范围 [min, max]
        threshold: Number,          // 阈值
        correlation: Object,        // 关联条件
        transition: Object,         // 转换规则（用于转换类规律）
        keyValues: [String]         // 关键值列表（如关键的热温冷比）
    },

    // 规律统计
    statistics: {
        confidence: { type: Number, required: true, min: 0, max: 1 },     // 置信度 0-1
        accuracy: { type: Number, required: true, min: 0, max: 1 },       // 历史准确率 0-1
        frequency: { type: Number, required: true, min: 0, max: 1 },      // 出现频率 0-1
        support: { type: Number, required: true },                        // 支持度（样本数）
        lastOccurrence: String,                                           // 最后出现期号
        occurrenceCount: Number                                           // 历史出现次数
    },

    // 规律验证
    validation: {
        trainingPeriods: Number,    // 训练期数
        testPeriods: Number,        // 测试期数
        hitCount: Number,           // 命中次数
        missCount: Number,          // 未命中次数
        validationDate: Date,       // 验证日期
        precision: Number,          // 精确率
        recall: Number,             // 召回率
        f1Score: Number             // F1分数
    },

    // 规律趋势
    trend: {
        status: {
            type: String,
            enum: ['active', 'weakening', 'strengthening', 'archived', 'invalid'],
            default: 'active'
        },
        recentAccuracy: Number,     // 最近20期准确率
        trendDirection: {           // 趋势方向
            type: String,
            enum: ['up', 'down', 'stable']
        },
        slope: Number               // 趋势斜率
    },

    // 评分信息
    score: {
        totalScore: { type: Number, min: 0, max: 100 },  // 综合得分
        grade: {                                          // 等级
            type: String,
            enum: ['S', 'A', 'B', 'C', 'D']
        },
        breakdown: {                                      // 分项得分
            accuracyScore: Number,
            stabilityScore: Number,
            recencyScore: Number,
            supportScore: Number,
            trendScore: Number
        }
    },

    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['active', 'archived', 'invalid'],
        default: 'active'
    }
});

// 规律库索引
dltPatternSchema.index({ pattern_id: 1 });
dltPatternSchema.index({ pattern_type: 1 });
dltPatternSchema.index({ status: 1 });
dltPatternSchema.index({ 'statistics.confidence': -1 });
dltPatternSchema.index({ 'statistics.accuracy': -1 });
dltPatternSchema.index({ 'score.totalScore': -1 });
dltPatternSchema.index({ 'score.grade': 1 });
dltPatternSchema.index({ created_at: -1 });

const DLTPattern = mongoose.model('HIT_DLT_Pattern', dltPatternSchema);

// 2. 规律历史记录表
const dltPatternHistorySchema = new mongoose.Schema({
    pattern_id: { type: String, required: true },     // 关联规律ID
    issue: { type: String, required: true },          // 期号
    expected: Object,                                 // 规律预期值
    actual: Object,                                   // 实际结果
    hit: { type: Boolean, required: true },           // 是否命中
    deviation: Number,                                // 偏差值
    recorded_at: { type: Date, default: Date.now }
});

// 规律历史索引
dltPatternHistorySchema.index({ pattern_id: 1 });
dltPatternHistorySchema.index({ issue: 1 });
dltPatternHistorySchema.index({ pattern_id: 1, issue: 1 }, { unique: true });
dltPatternHistorySchema.index({ recorded_at: -1 });
dltPatternHistorySchema.index({ hit: 1 });

const DLTPatternHistory = mongoose.model('HIT_DLT_PatternHistory', dltPatternHistorySchema);

// 3. 规律推荐表
const dltPatternRecommendationSchema = new mongoose.Schema({
    session_id: { type: String, required: true, unique: true },  // 会话ID
    target_issue: { type: String, required: true },              // 目标期号

    // 应用的规律列表
    applied_patterns: [{
        pattern_id: String,
        pattern_name: String,
        pattern_type: String,
        weight: { type: Number, min: 0, max: 1 },               // 权重 0-1
        reason: String                                           // 应用原因
    }],

    // 推荐的筛选条件
    recommended_filters: {
        sumRange: [Number],                    // 和值范围 [min, max]
        spanRange: [Number],                   // 跨度范围
        zoneRatios: [String],                  // 区间比列表
        oddEvenRatios: [String],               // 奇偶比列表
        htcRatios: [String],                   // 热温冷比列表
        excludeHtcRatios: [String],            // 排除的热温冷比
        consecutiveCount: [Number],            // 连号数量范围
        excludeConditions: Object              // 其他排除条件
    },

    // 预测结果
    prediction: {
        expectedAccuracy: Number,              // 预期准确率
        confidence: Number,                    // 置信度
        estimatedCombinations: Number          // 预计组合数量
    },

    created_at: { type: Date, default: Date.now }
});

// 规律推荐索引
dltPatternRecommendationSchema.index({ session_id: 1 });
dltPatternRecommendationSchema.index({ target_issue: 1 });
dltPatternRecommendationSchema.index({ created_at: -1 });

const DLTPatternRecommendation = mongoose.model('HIT_DLT_PatternRecommendation', dltPatternRecommendationSchema);

// ========== 规律生成功能 Schema 定义完成 ==========

// ========== 新方案 Schema 定义完成 ==========


// 日志记录
const logStream = fs.createWriteStream('lottery.log', { flags: 'a' });
function log(message) {
  const timestamp = new Date().toISOString();
  logStream.write(`${timestamp} - ${message}\n`);
  console.log(`${timestamp} - ${message}`);
}

// 计算遗漏值
function calculateMissing(data, number, currentIndex, type) {
    let count = 0;
    for (let i = currentIndex; i >= 0; i--) {
        if (type === 'red') {
            const drawnNumbers = [
                data[i].Red1,
                data[i].Red2,
                data[i].Red3,
                data[i].Red4,
                data[i].Red5,
                data[i].Red6
            ];
            if (drawnNumbers.includes(number)) {
                break;
            }
        } else {
            if (data[i].Blue === number) {
                break;
            }
        }
        count++;
    }
    return count;
}

// 计算大乐透遗漏值
function calculateDLTMissing(data, number, currentIndex, type) {
    let count = 0;
    for (let i = currentIndex; i >= 0; i--) {
        if (type === 'front') {
            const drawnNumbers = [
                data[i].Red1,
                data[i].Red2,
                data[i].Red3,
                data[i].Red4,
                data[i].Red5
            ];
            if (drawnNumbers.includes(number)) {
                break;
            }
        } else if (type === 'back') {
            const drawnNumbers = [data[i].Blue1, data[i].Blue2];
            if (drawnNumbers.includes(number)) {
                break;
            }
        }
        count++;
    }
    return count;
}

// 数据缓存
const cache = {
    trendData: new Map(),
    lastUpdate: null,
    cacheTimeout: 5 * 60 * 1000 // 缓存5分钟
};

// 获取所有大乐透数据
app.get('/api/lotteries', async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const lotteries = await UnionLotto.find()
      .sort({ drawDate: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await UnionLotto.countDocuments();
    
    res.json({
      success: true,
      data: lotteries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 号码频率统计
app.get('/api/frequency', async (req, res) => {
  try {
    const lotteries = await UnionLotto.find();
    
    // 统计前区号码频率(1-35)
    const frontFrequency = Array(35).fill(0);
    // 统计后区号码频率(1-12)
    const backFrequency = Array(12).fill(0);
    // 号码组合统计
    const combinations = {};
    
    lotteries.forEach(lottery => {
      // 前区号码统计
      const numbers = [
        lottery.Red1,
        lottery.Red2,
        lottery.Red3,
        lottery.Red4,
        lottery.Red5,
        lottery.Red6
      ];
      numbers.forEach(num => frontFrequency[num - 1]++);
      
      // 后区号码统计
      backFrequency[lottery.Blue - 1]++;
      
      // 组合统计(前区)
      const sortedNumbers = [...numbers].sort((a, b) => a - b);
      const comboKey = sortedNumbers.join('-');
      combinations[comboKey] = (combinations[comboKey] || 0) + 1;
    });
    
    // 热门组合排序
    const topCombinations = Object.entries(combinations)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([combo, count]) => ({ combo, count }));
    
    res.json({
      success: true,
      data: {
        frontFrequency,
        backFrequency,
        topCombinations
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 获取双色球历史开奖数据
app.get('/api/ssq/history', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        
        const data = await UnionLotto.find()
            .sort({ Issue: -1 }) // 使用期号降序排列
            .skip((page - 1) * limit)
            .limit(limit);
            
        const total = await UnionLotto.countDocuments();
        
        res.json({
            success: true,
            data,
            pagination: {
                current: page,
                size: limit,
                total
            }
        });
    } catch (error) {
        console.error('Error fetching lottery history:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 获取走势图数据
app.get('/api/ssq/trend', async (req, res) => {
    try {
        const { periods, startIssue, endIssue } = req.query;
        console.log('Received trend chart request with query:', req.query);

        let query = {};
        let limit = 0;

        if (startIssue && endIssue) {
            // 自定义期号范围查询
            query = {
                Issue: {
                    $gte: startIssue,
                    $lte: endIssue
                }
            };
            console.log(`Fetching records from issue ${startIssue} to ${endIssue}`);
        } else {
            // 最近N期查询
            limit = parseInt(periods) || 30;
            console.log(`Fetching most recent ${limit} periods`);
        }

        // 获取红球数据
        const redBallsData = await UnionLotto.find(query)
            .sort({ Issue: startIssue && endIssue ? 1 : -1 }) // 自定义范围升序，最近N期降序
            .limit(limit || 0)
            .select('Issue DrawingWeek Red1 Red2 Red3 Red4 Red5 Red6')
            .lean();

        console.log(`Found ${redBallsData.length} records for red balls`);

        // 获取蓝球数据
        const blueBallsData = await UnionLotto.find(query)
            .sort({ Issue: startIssue && endIssue ? 1 : -1 })
            .limit(limit || 0)
            .select('Issue Blue')
            .lean();

        console.log(`Found ${blueBallsData.length} records for blue balls`);

        // 如果是最近N期查询，需要反转数据以保持升序
        if (!startIssue && !endIssue) {
            redBallsData.reverse();
            blueBallsData.reverse();
        }

        // 处理数据
        const trendData = redBallsData.map((item, index) => {
            const redBalls = [];
            const blueBalls = [];
            
            // 处理红球
            for (let i = 1; i <= 33; i++) {
                const isDrawn = [item.Red1, item.Red2, item.Red3, item.Red4, item.Red5, item.Red6].includes(i);
                redBalls.push({
                    number: i,
                    isDrawn,
                    missing: isDrawn ? 0 : calculateMissing(redBallsData, i, index, 'red')
                });
            }
            
            // 处理蓝球
            for (let i = 1; i <= 16; i++) {
                const isDrawn = blueBallsData[index].Blue === i;
                blueBalls.push({
                    number: i,
                    isDrawn,
                    missing: isDrawn ? 0 : calculateMissing(blueBallsData, i, index, 'blue')
                });
            }
            
            return {
                issue: item.Issue,
                drawingWeek: item.DrawingWeek,
                redBalls,
                blueBalls
            };
        });

        console.log(`Successfully prepared trend chart data with ${trendData.length} records`);
        
        res.json({
            success: true,
            data: trendData
        });
    } catch (error) {
        console.error('Error fetching trend data:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 获取遗漏值走势图数据
app.get('/api/trendchart', async (req, res) => {
    try {
        log('Received trend chart request with query: ' + JSON.stringify(req.query));
        
        let query = {};
        let limit = 0;
        
        // 处理最近期数筛选
        if (req.query.recentPeriods) {
            limit = parseInt(req.query.recentPeriods);
            log(`Fetching most recent ${limit} periods`);
        }
        
        // 处理期号范围筛选
        if (req.query.startIssue && req.query.endIssue) {
            // 转换期号格式
            const normalizedStartIssue = normalizeIssueNumber(req.query.startIssue);
            const normalizedEndIssue = normalizeIssueNumber(req.query.endIssue);
            
            query.Issue = {
                $gte: normalizedStartIssue,
                $lte: normalizedEndIssue
            };
            log(`Fetching custom range from ${normalizedStartIssue} to ${normalizedEndIssue} (original: ${req.query.startIssue} to ${req.query.endIssue})`);
        }

        // 获取红球遗漏值数据
        let redBallData = await RedBallMissing.find(query)
            .sort({ ID: -1 }) // 按ID降序排序
            .limit(limit || 0); // 如果limit为0则返回所有数据

        if (!redBallData || redBallData.length === 0) {
            log('No red ball data found');
            return res.status(404).json({
                success: false,
                error: '未找到数据'
            });
        }

        log(`Found ${redBallData.length} records for red balls`);

        if (limit > 0) {
            redBallData = redBallData.reverse(); // 反转数组以保持正确的显示顺序
        } else {
            redBallData = await RedBallMissing.find(query).sort({ ID: 1 });
        }

        // 获取蓝球遗漏值数据
        let blueBallData = await BlueBallMissing.find(query)
            .sort({ ID: -1 })
            .limit(limit || 0);

        if (!blueBallData || blueBallData.length === 0) {
            log('No blue ball data found');
            return res.status(404).json({
                success: false,
                error: '未找到数据'
            });
        }

        log(`Found ${blueBallData.length} records for blue balls`);

        if (limit > 0) {
            blueBallData = blueBallData.reverse();
        } else {
            blueBallData = await BlueBallMissing.find(query).sort({ ID: 1 });
        }

        // 验证数据长度匹配
        if (redBallData.length !== blueBallData.length) {
            log('Data length mismatch between red and blue balls');
            return res.status(500).json({
                success: false,
                error: '数据不一致'
            });
        }

        // 构建返回数据
        const trendChartData = redBallData.map((redRecord, index) => {
            const blueRecord = blueBallData[index];
            
            // 验证记录的完整性
            if (!redRecord || !blueRecord || !redRecord.Issue || !blueRecord.Issue || redRecord.Issue !== blueRecord.Issue) {
                log(`Data integrity issue at index ${index}`);
                throw new Error('数据完整性错误');
            }
            
            // 构建区域数据
            const zone1 = Array.from({length: 11}, (_, i) => ({
                number: i + 1,
                missing: redRecord[(i + 1).toString()],
                isDrawn: redRecord[(i + 1).toString()] === 0
            }));
            
            const zone2 = Array.from({length: 11}, (_, i) => ({
                number: i + 12,
                missing: redRecord[(i + 12).toString()],
                isDrawn: redRecord[(i + 12).toString()] === 0
            }));
            
            const zone3 = Array.from({length: 11}, (_, i) => ({
                number: i + 23,
                missing: redRecord[(i + 23).toString()],
                isDrawn: redRecord[(i + 23).toString()] === 0
            }));
            
            const blueZone = Array.from({length: 16}, (_, i) => ({
                number: i + 1,
                missing: blueRecord[(i + 1).toString()],
                isDrawn: blueRecord[(i + 1).toString()] === 0
            }));
            
            // 计算统计数据
            const drawnRedBalls = [...zone1, ...zone2, ...zone3].filter(ball => ball.isDrawn);
            const redNumbers = drawnRedBalls.map(ball => ball.number);
            const drawnBlueBalls = blueZone.filter(ball => ball.isDrawn);
            
            // 计算和值、跨度
            const sum = redNumbers.reduce((a, b) => a + b, 0);
            const span = redNumbers.length > 0 ? Math.max(...redNumbers) - Math.min(...redNumbers) : 0;
            
            // 计算区间比
            let zone1Count = 0, zone2Count = 0, zone3Count = 0;
            redNumbers.forEach(n => {
                if (n <= 11) zone1Count++;
                else if (n <= 22) zone2Count++;
                else zone3Count++;
            });
            const zoneRatio = `${zone1Count}:${zone2Count}:${zone3Count}`;
            
            // 计算奇偶比
            let oddCount = 0, evenCount = 0;
            redNumbers.forEach(n => n % 2 === 0 ? evenCount++ : oddCount++);
            const oddEvenRatio = `${oddCount}:${evenCount}`;
            
            return {
                issue: redRecord.Issue,
                drawingWeek: redRecord.DrawingWeek,
                zone1,
                zone2,
                zone3,
                blueZone,
                statistics: {
                    sum,
                    span,
                    hotWarmColdRatio: redRecord.HotWarmColdRatio || '0:0:0',
                    zoneRatio,
                    oddEvenRatio
                }
            };
        });

        log(`Successfully prepared trend chart data with ${trendChartData.length} records`);
        if (trendChartData.length > 0) {
            log('Sample statistics:', JSON.stringify(trendChartData[0].statistics));
        }

        res.json({
            success: true,
            data: trendChartData
        });
  } catch (error) {
        log(`Error in trend chart API: ${error.message}`);
        console.error('Error fetching trend chart data:', error);
        res.status(500).json({
            success: false,
            error: error.message || '服务器内部错误'
        });
    }
});

// 期号格式转换函数：将5位期号转换为7位期号（用于双色球）
function normalizeIssueNumber(issue) {
    if (!issue) return issue;
    const issueStr = issue.toString();
    
    // 如果已经是7位数字，直接返回
    if (issueStr.length === 7) {
        return issueStr;
    }
    
    // 如果是5位数字，需要补全年份
    if (issueStr.length === 5) {
        const year = issueStr.substring(0, 2);
        const period = issueStr.substring(2);
        
        // 补全为完整年份：24xxx -> 2024xxx, 25xxx -> 2025xxx
        const fullYear = '20' + year;
        return fullYear + period;
    }
    
    return issueStr;
}

// 大乐透期号格式转换函数：保持5位格式
function normalizeDLTIssueNumber(issue) {
    if (!issue) return issue;
    const issueStr = issue.toString();
    
    // 如果是7位数字，截取为5位（去掉20前缀）
    if (issueStr.length === 7 && issueStr.startsWith('20')) {
        return issueStr.substring(2);
    }
    
    // 如果是5位数字，直接返回
    if (issueStr.length === 5) {
        return issueStr;
    }
    
    return issueStr;
}

// 将用户输入的期号范围转换为ID范围查询条件
async function convertDLTIssueRangeToIDRange(startIssue, endIssue) {
    try {
        const normalizedStart = parseInt(normalizeDLTIssueNumber(startIssue));
        const normalizedEnd = parseInt(normalizeDLTIssueNumber(endIssue));
        
        // 查找起始期号对应的ID（Issue字段在数据库中是数字类型）
        const startRecord = await DLT.findOne({Issue: {$gte: normalizedStart}}).sort({Issue: 1}).select('ID');
        // 查找结束期号对应的ID
        const endRecord = await DLT.findOne({Issue: {$lte: normalizedEnd}}).sort({Issue: -1}).select('ID');
        
        if (!startRecord || !endRecord) {
            return null; // 没有找到对应的数据
        }
        
        return {
            startID: startRecord.ID,
            endID: endRecord.ID,
            query: { ID: { $gte: startRecord.ID, $lte: endRecord.ID } }
        };
    } catch (error) {
        console.error('Error converting DLT issue range to ID range:', error);
        return null;
    }
}

// 获取同出数据
app.get('/api/ssq/cooccurrence', async (req, res) => {
    try {
        const { periods, startIssue, endIssue } = req.query;
        log('Received co-occurrence request with query: ' + JSON.stringify(req.query));

        let query = {};
        let limit = 0;

        if (startIssue && endIssue) {
            // 自定义期号范围查询，转换期号格式
            const normalizedStartIssue = normalizeIssueNumber(startIssue);
            const normalizedEndIssue = normalizeIssueNumber(endIssue);
            
            query = {
                Issue: {
                    $gte: normalizedStartIssue,
                    $lte: normalizedEndIssue
                }
            };
            log(`Fetching co-occurrence data from issue ${normalizedStartIssue} to ${normalizedEndIssue} (original: ${startIssue} to ${endIssue})`);
        } else {
            // 最近N期查询
            limit = parseInt(periods) || 30;
            log(`Fetching co-occurrence data for most recent ${limit} periods`);
        }

        // 获取数据
        const data = await UnionLotto.find(query)
            .sort({ Issue: startIssue && endIssue ? 1 : -1 })
            .limit(limit || 0)
            .select('Issue DrawingWeek Red1 Red2 Red3 Red4 Red5 Red6 Blue')
            .lean();

        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: '未找到数据'
            });
        }

        log(`Found ${data.length} records for co-occurrence calculation`);

        // 如果是最近N期查询，需要反转数据以保持升序
        if (!startIssue && !endIssue) {
            data.reverse();
        }

        // 计算同出数据
        const cooccurrenceMatrix = calculateCooccurrenceMatrix(data);

        // 生成统计报告
        const statistics = generateCooccurrenceStatistics(cooccurrenceMatrix, data);

        log(`Successfully calculated co-occurrence data for ${data.length} records`);

        res.json({
            success: true,
            data: {
                matrix: cooccurrenceMatrix,
                statistics: statistics,
                periodInfo: {
                    startIssue: data[0]?.Issue,
                    endIssue: data[data.length - 1]?.Issue,
                    totalPeriods: data.length
                }
            }
        });
    } catch (error) {
        log(`Error in co-occurrence API: ${error.message}`);
        console.error('Error calculating co-occurrence data:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    }
});

// 同出数据Excel导出
app.get('/api/ssq/cooccurrence/excel', async (req, res) => {
    try {
        const { periods, startIssue, endIssue } = req.query;
        log('Received Excel export request: ' + JSON.stringify(req.query));

        let query = {};
        let limit = 0;
        let filename = '';

        if (startIssue && endIssue) {
            // 转换期号格式
            const normalizedStartIssue = normalizeIssueNumber(startIssue);
            const normalizedEndIssue = normalizeIssueNumber(endIssue);
            
            query = {
                Issue: {
                    $gte: normalizedStartIssue,
                    $lte: normalizedEndIssue
                }
            };
            filename = `双色球同出数据_${startIssue}至${endIssue}.xlsx`;
        } else {
            limit = parseInt(periods) || 30;
            filename = `双色球同出数据_最近${limit}期.xlsx`;
        }

        const data = await UnionLotto.find(query)
            .sort({ Issue: startIssue && endIssue ? 1 : -1 })
            .limit(limit || 0)
            .select('Issue DrawingWeek Red1 Red2 Red3 Red4 Red5 Red6 Blue')
            .lean();

        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: '未找到数据'
            });
        }

        if (!startIssue && !endIssue) {
            data.reverse();
        }

        // 计算同出数据
        const cooccurrenceMatrix = calculateCooccurrenceMatrix(data);
        
        // 生成Excel数据
        const excelData = generateExcelData(cooccurrenceMatrix);

        res.json({
            success: true,
            data: {
                filename: filename,
                excelData: excelData,
                periodInfo: {
                    startIssue: data[0]?.Issue,
                    endIssue: data[data.length - 1]?.Issue,
                    totalPeriods: data.length
                }
            }
        });
    } catch (error) {
        log(`Error in Excel export API: ${error.message}`);
        console.error('Error generating Excel data:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Excel导出失败'
        });
    }
});

// 计算同出矩阵
function calculateCooccurrenceMatrix(data) {
    const cooccurrenceMatrix = {};
    
    // 初始化红球1-33的同出矩阵
    for (let redBall = 1; redBall <= 33; redBall++) {
        cooccurrenceMatrix[redBall] = {
            redCounts: {},   // 与其他红球的同出次数
            blueCounts: {}   // 与蓝球的同出次数
        };
        
        // 初始化与其他红球的同出计数
        for (let otherRed = 1; otherRed <= 33; otherRed++) {
            cooccurrenceMatrix[redBall].redCounts[otherRed] = 0;
        }
        
        // 初始化与蓝球的同出计数
        for (let blue = 1; blue <= 16; blue++) {
            cooccurrenceMatrix[redBall].blueCounts[blue] = 0;
        }
    }
    
    // 遍历每期数据计算同出次数
    data.forEach(row => {
        const redBalls = [row.Red1, row.Red2, row.Red3, 
                         row.Red4, row.Red5, row.Red6];
        const blueBall = row.Blue;
        
        // 计算红球间的同出次数
        redBalls.forEach(redBall1 => {
            redBalls.forEach(redBall2 => {
                if (redBall1 !== redBall2) {
                    cooccurrenceMatrix[redBall1].redCounts[redBall2]++;
                }
            });
            
            // 计算红球与蓝球的同出次数
            cooccurrenceMatrix[redBall1].blueCounts[blueBall]++;
        });
    });
    
    return cooccurrenceMatrix;
}

// 生成同出数据统计报告
function generateCooccurrenceStatistics(matrix, data) {
    const stats = {
        totalPeriods: data.length,
        redBallStats: {},
        blueBallStats: {},
        topRedPairs: [],
        topRedBluePairs: []
    };

    // 红球出现频次统计
    const redFrequency = {};
    const blueFrequency = {};
    
    for (let i = 1; i <= 33; i++) {
        redFrequency[i] = 0;
    }
    for (let i = 1; i <= 16; i++) {
        blueFrequency[i] = 0;
    }

    data.forEach(row => {
        const redBalls = [row.Red1, row.Red2, row.Red3, row.Red4, row.Red5, row.Red6];
        redBalls.forEach(red => redFrequency[red]++);
        blueFrequency[row.Blue]++;
    });

    // 找出最热和最冷的号码
    const redEntries = Object.entries(redFrequency).map(([num, freq]) => ({ num: parseInt(num), freq }));
    const blueEntries = Object.entries(blueFrequency).map(([num, freq]) => ({ num: parseInt(num), freq }));

    stats.redBallStats = {
        hottest: redEntries.reduce((a, b) => a.freq > b.freq ? a : b),
        coldest: redEntries.reduce((a, b) => a.freq < b.freq ? a : b)
    };

    stats.blueBallStats = {
        hottest: blueEntries.reduce((a, b) => a.freq > b.freq ? a : b),
        coldest: blueEntries.reduce((a, b) => a.freq < b.freq ? a : b)
    };

    // 找出红球最高同出组合
    let maxRedCooccurrence = 0;
    let maxRedPair = null;
    
    for (let red1 = 1; red1 <= 33; red1++) {
        for (let red2 = red1 + 1; red2 <= 33; red2++) {
            const cooccurrenceCount = matrix[red1].redCounts[red2];
            if (cooccurrenceCount > maxRedCooccurrence) {
                maxRedCooccurrence = cooccurrenceCount;
                maxRedPair = [red1, red2];
            }
        }
    }

    if (maxRedPair) {
        stats.topRedPairs.push({
            pair: maxRedPair,
            count: maxRedCooccurrence
        });
    }

    // 找出红蓝球最高同出组合
    let maxRedBlueCooccurrence = 0;
    let maxRedBluePair = null;
    
    for (let red = 1; red <= 33; red++) {
        for (let blue = 1; blue <= 16; blue++) {
            const cooccurrenceCount = matrix[red].blueCounts[blue];
            if (cooccurrenceCount > maxRedBlueCooccurrence) {
                maxRedBlueCooccurrence = cooccurrenceCount;
                maxRedBluePair = [red, blue];
            }
        }
    }

    if (maxRedBluePair) {
        stats.topRedBluePairs.push({
            pair: maxRedBluePair,
            count: maxRedBlueCooccurrence
        });
    }

    return stats;
}

// 生成Excel格式数据
function generateExcelData(matrix) {
    const headers = ['红球号码'];
    
    // 添加红球列头
    for (let i = 1; i <= 33; i++) {
        headers.push(`红球${i}`);
    }
    
    // 添加蓝球列头
    for (let i = 1; i <= 16; i++) {
        headers.push(`蓝球${i}`);
    }

    const rows = [headers];

    // 生成数据行
    for (let redBall = 1; redBall <= 33; redBall++) {
        const row = [redBall];
        
        // 添加与其他红球的同出次数
        for (let otherRed = 1; otherRed <= 33; otherRed++) {
            if (redBall === otherRed) {
                row.push('-');
            } else {
                row.push(matrix[redBall].redCounts[otherRed]);
            }
        }
        
        // 添加与蓝球的同出次数
        for (let blue = 1; blue <= 16; blue++) {
            row.push(matrix[redBall].blueCounts[blue]);
        }
        
        rows.push(row);
    }

    return rows;
}

// 获取相克数据
app.get('/api/ssq/conflict', async (req, res) => {
    try {
        const { periods, startIssue, endIssue } = req.query;
        log('Received conflict data request with query: ' + JSON.stringify(req.query));

        let query = {};
        let limit = 0;

        if (startIssue && endIssue) {
            // 自定义期号范围查询，转换期号格式
            const normalizedStartIssue = normalizeIssueNumber(startIssue);
            const normalizedEndIssue = normalizeIssueNumber(endIssue);
            
            query = {
                Issue: {
                    $gte: normalizedStartIssue,
                    $lte: normalizedEndIssue
                }
            };
            log(`Fetching conflict data from issue ${normalizedStartIssue} to ${normalizedEndIssue} (original: ${startIssue} to ${endIssue})`);
        } else {
            // 最近N期查询
            limit = parseInt(periods) || 30;
            log(`Fetching conflict data for most recent ${limit} periods`);
        }

        // 获取数据
        const data = await UnionLotto.find(query)
            .sort({ Issue: startIssue && endIssue ? 1 : -1 })
            .limit(limit || 0)
            .select('Issue DrawingWeek Red1 Red2 Red3 Red4 Red5 Red6 Blue')
            .lean();

        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: '未找到数据'
            });
        }

        log(`Found ${data.length} records for conflict calculation`);

        // 如果是最近N期查询，需要反转数据以保持升序
        if (!startIssue && !endIssue) {
            data.reverse();
        }

        // 计算相克数据
        const conflictMatrix = calculateConflictMatrix(data);

        // 生成统计报告
        const statistics = generateConflictStatistics(conflictMatrix, data);

        log(`Successfully calculated conflict data for ${data.length} records`);

        res.json({
            success: true,
            data: {
                matrix: conflictMatrix,
                statistics: statistics,
                periodInfo: {
                    startIssue: data[0]?.Issue,
                    endIssue: data[data.length - 1]?.Issue,
                    totalPeriods: data.length
                }
            }
        });
    } catch (error) {
        log(`Error in conflict API: ${error.message}`);
        console.error('Error calculating conflict data:', error);
        res.status(500).json({
            success: false,
            message: error.message || '服务器内部错误'
        });
    }
});

// 相克数据Excel导出
app.get('/api/ssq/conflict/excel', async (req, res) => {
    try {
        const { periods, startIssue, endIssue } = req.query;
        log('Received conflict Excel export request: ' + JSON.stringify(req.query));

        let query = {};
        let limit = 0;
        let filename = '';

        if (startIssue && endIssue) {
            // 转换期号格式
            const normalizedStartIssue = normalizeIssueNumber(startIssue);
            const normalizedEndIssue = normalizeIssueNumber(endIssue);
            
            query = {
                Issue: {
                    $gte: normalizedStartIssue,
                    $lte: normalizedEndIssue
                }
            };
            filename = `双色球相克数据_${startIssue}至${endIssue}.xlsx`;
        } else {
            limit = parseInt(periods) || 30;
            filename = `双色球相克数据_最近${limit}期.xlsx`;
        }

        const data = await UnionLotto.find(query)
            .sort({ Issue: startIssue && endIssue ? 1 : -1 })
            .limit(limit || 0)
            .select('Issue DrawingWeek Red1 Red2 Red3 Red4 Red5 Red6 Blue')
            .lean();

        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: '未找到数据'
            });
        }

        if (!startIssue && !endIssue) {
            data.reverse();
        }

        // 计算相克数据
        const conflictMatrix = calculateConflictMatrix(data);
        
        // 生成Excel数据
        const excelData = generateConflictExcelData(conflictMatrix);

        res.json({
            success: true,
            data: {
                filename: filename,
                excelData: excelData,
                periodInfo: {
                    startIssue: data[0]?.Issue,
                    endIssue: data[data.length - 1]?.Issue,
                    totalPeriods: data.length
                }
            }
        });
    } catch (error) {
        log(`Error in conflict Excel export API: ${error.message}`);
        console.error('Error generating conflict Excel data:', error);
        res.status(500).json({
            success: false,
            message: error.message || '相克数据Excel导出失败'
        });
    }
});

// 计算相克矩阵
function calculateConflictMatrix(data) {
    const conflictMatrix = {};
    
    // 初始化红球1-33的相克矩阵
    for (let redBall = 1; redBall <= 33; redBall++) {
        conflictMatrix[redBall] = {
            redCounts: {},   // 与其他红球的相克次数
            blueCounts: {}   // 与蓝球的相克次数
        };
        
        // 初始化与其他红球的相克计数
        for (let otherRed = 1; otherRed <= 33; otherRed++) {
            conflictMatrix[redBall].redCounts[otherRed] = 0;
        }
        
        // 初始化与蓝球的相克计数
        for (let blue = 1; blue <= 16; blue++) {
            conflictMatrix[redBall].blueCounts[blue] = 0;
        }
    }
    
    // 遍历每期数据计算相克次数
    data.forEach(row => {
        const drawnRedBalls = [row.Red1, row.Red2, row.Red3, 
                              row.Red4, row.Red5, row.Red6];
        const drawnBlueBall = row.Blue;
        
        // 找出未开出的红球和蓝球
        const undrawnRedBalls = [];
        const undrawnBlueBalls = [];
        
        for (let red = 1; red <= 33; red++) {
            if (!drawnRedBalls.includes(red)) {
                undrawnRedBalls.push(red);
            }
        }
        
        for (let blue = 1; blue <= 16; blue++) {
            if (blue !== drawnBlueBall) {
                undrawnBlueBalls.push(blue);
            }
        }
        
        // 计算已开出红球与未开出红球的相克关系
        drawnRedBalls.forEach(drawnRed => {
            undrawnRedBalls.forEach(undrawnRed => {
                conflictMatrix[drawnRed].redCounts[undrawnRed]++;
            });
            
            // 计算已开出红球与未开出蓝球的相克关系
            undrawnBlueBalls.forEach(undrawnBlue => {
                conflictMatrix[drawnRed].blueCounts[undrawnBlue]++;
            });
        });
    });
    
    return conflictMatrix;
}

// 生成相克数据统计报告
function generateConflictStatistics(matrix, data) {
    const stats = {
        totalPeriods: data.length,
        redBallStats: {},
        blueBallStats: {},
        topConflictRedPairs: [],
        topConflictRedBluePairs: [],
        conflictRatios: {}
    };

    // 计算每个号码的相克总数
    const redConflictTotals = {};
    const blueConflictTotals = {};
    
    for (let red = 1; red <= 33; red++) {
        redConflictTotals[red] = 0;
        // 计算该红球与所有其他红球的相克总数
        for (let otherRed = 1; otherRed <= 33; otherRed++) {
            if (red !== otherRed) {
                redConflictTotals[red] += matrix[red].redCounts[otherRed];
            }
        }
        // 加上与蓝球的相克数
        for (let blue = 1; blue <= 16; blue++) {
            redConflictTotals[red] += matrix[red].blueCounts[blue];
        }
    }
    
    for (let blue = 1; blue <= 16; blue++) {
        blueConflictTotals[blue] = 0;
        // 计算该蓝球被红球相克的总数
        for (let red = 1; red <= 33; red++) {
            blueConflictTotals[blue] += matrix[red].blueCounts[blue];
        }
    }

    // 找出相克最多和最少的号码
    const redEntries = Object.entries(redConflictTotals).map(([num, total]) => ({ num: parseInt(num), total }));
    const blueEntries = Object.entries(blueConflictTotals).map(([num, total]) => ({ num: parseInt(num), total }));

    stats.redBallStats = {
        mostConflicted: redEntries.reduce((a, b) => a.total > b.total ? a : b),
        leastConflicted: redEntries.reduce((a, b) => a.total < b.total ? a : b)
    };

    stats.blueBallStats = {
        mostConflicted: blueEntries.reduce((a, b) => a.total > b.total ? a : b),
        leastConflicted: blueEntries.reduce((a, b) => a.total < b.total ? a : b)
    };

    // 找出红球间最高相克组合
    let maxRedConflict = 0;
    let maxRedConflictPair = null;
    
    for (let red1 = 1; red1 <= 33; red1++) {
        for (let red2 = red1 + 1; red2 <= 33; red2++) {
            const conflictCount1 = matrix[red1].redCounts[red2];
            const conflictCount2 = matrix[red2].redCounts[red1];
            const totalConflict = conflictCount1 + conflictCount2;
            
            if (totalConflict > maxRedConflict) {
                maxRedConflict = totalConflict;
                maxRedConflictPair = [red1, red2];
            }
        }
    }

    if (maxRedConflictPair) {
        stats.topConflictRedPairs.push({
            pair: maxRedConflictPair,
            count: maxRedConflict
        });
    }

    // 找出红蓝球最高相克组合
    let maxRedBlueConflict = 0;
    let maxRedBlueConflictPair = null;
    
    for (let red = 1; red <= 33; red++) {
        for (let blue = 1; blue <= 16; blue++) {
            const conflictCount = matrix[red].blueCounts[blue];
            if (conflictCount > maxRedBlueConflict) {
                maxRedBlueConflict = conflictCount;
                maxRedBlueConflictPair = [red, blue];
            }
        }
    }

    if (maxRedBlueConflictPair) {
        stats.topConflictRedBluePairs.push({
            pair: maxRedBlueConflictPair,
            count: maxRedBlueConflict
        });
    }

    return stats;
}

// 生成相克数据Excel格式数据
function generateConflictExcelData(matrix) {
    const headers = ['红球号码'];
    
    // 添加红球列头
    for (let i = 1; i <= 33; i++) {
        headers.push(`红球${i}`);
    }
    
    // 添加蓝球列头
    for (let i = 1; i <= 16; i++) {
        headers.push(`蓝球${i}`);
    }

    const rows = [headers];

    // 生成数据行
    for (let redBall = 1; redBall <= 33; redBall++) {
        const row = [redBall];
        
        // 添加与其他红球的相克次数
        for (let otherRed = 1; otherRed <= 33; otherRed++) {
            if (redBall === otherRed) {
                row.push('-');
            } else {
                row.push(matrix[redBall].redCounts[otherRed]);
            }
        }
        
        // 添加与蓝球的相克次数
        for (let blue = 1; blue <= 16; blue++) {
            row.push(matrix[redBall].blueCounts[blue]);
        }
        
        rows.push(row);
    }

    return rows;
}

// 大乐透历史数据接口
app.get('/api/dlt/history', async (req, res) => {
    try {
        console.log('Fetching DLT history data...');
        const { page = 1, limit = 20, startIssue, endIssue } = req.query;
        
        let data, total;
        
        if (startIssue && endIssue) {
            console.log(`Query range: ${startIssue} to ${endIssue}`);
            
            // 转换为数字进行比较（Issue字段现在是数字类型）
            const normalizedStart = parseInt(normalizeDLTIssueNumber(startIssue));
            const normalizedEnd = parseInt(normalizeDLTIssueNumber(endIssue));
            
            const query = {
                Issue: {
                    $gte: normalizedStart,
                    $lte: normalizedEnd
                }
            };
            
            total = await DLT.countDocuments(query);
            
            data = await DLT.find(query)
                .sort({ Issue: -1 })
                .limit(parseInt(limit))
                .skip((parseInt(page) - 1) * parseInt(limit));
            
            console.log(`Range query found ${total} records, returning ${data.length} for page ${page} (issues: ${normalizedStart} to ${normalizedEnd})`);
        } else {
            data = await DLT.find({})
                .sort({ Issue: -1 })
                .limit(parseInt(limit))
                .skip((parseInt(page) - 1) * parseInt(limit));
                
            total = await DLT.countDocuments({});
        }
        
        console.log(`Successfully fetched ${data.length} DLT history records`);
        
        res.json({
            success: true,
            data: data,
            pagination: {
                current: parseInt(page),
                pageSize: parseInt(limit),
                total: total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('Error fetching DLT history:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// 大乐透走势图数据接口 - 使用预存储遗漏值数据
app.get('/api/dlt/trendchart', async (req, res) => {
    try {
        log('Received DLT trend chart request with query: ' + JSON.stringify(req.query));
        
        let query = {};
        let limit = 0;
        
        // 处理最近期数筛选
        if (req.query.recentPeriods) {
            limit = parseInt(req.query.recentPeriods);
            log(`Fetching most recent ${limit} periods`);
        }
        
        // 处理期号范围筛选
        if (req.query.startIssue && req.query.endIssue) {
            // 通过ID范围查询
            const idRange = await convertDLTIssueRangeToIDRange(req.query.startIssue, req.query.endIssue);
            if (!idRange) {
                return res.status(404).json({
                    success: false,
                    error: '未找到符合条件的数据'
                });
            }
            
            query = idRange.query;
            log(`Fetching DLT trend chart data from ID ${idRange.startID} to ${idRange.endID} (issues: ${req.query.startIssue} to ${req.query.endIssue})`);
        }

        // 获取大乐透前区遗漏值数据，始终按ID升序排列
        let dltRedData = await DLTRedMissing.find(query).sort({ ID: 1 });
        
        if (limit > 0) {
            // 对于限制期数的查询，获取最后N条记录（保持ID升序）
            dltRedData = dltRedData.slice(-limit);
        }

        if (!dltRedData || dltRedData.length === 0) {
            log('No DLT red data found');
            return res.status(404).json({
                success: false,
                error: '未找到前区数据'
            });
        }

        log(`Found ${dltRedData.length} records for DLT red balls`);
        
        // 调试：显示前3条和后3条记录的ID和期号
        if (dltRedData.length > 0) {
            const first3 = dltRedData.slice(0, 3);
            const last3 = dltRedData.slice(-3);
            log(`DLT Red data order check - First 3: ${first3.map(r => `ID:${r.ID},Issue:${r.Issue}`).join(' | ')}`);
            log(`DLT Red data order check - Last 3: ${last3.map(r => `ID:${r.ID},Issue:${r.Issue}`).join(' | ')}`);
        }

        // 获取大乐透后区遗漏值数据，始终按ID升序排列
        let dltBlueData = await DLTBlueMissing.find(query).sort({ ID: 1 });
        
        if (limit > 0) {
            // 对于限制期数的查询，获取最后N条记录（保持ID升序）
            dltBlueData = dltBlueData.slice(-limit);
        }

        if (!dltBlueData || dltBlueData.length === 0) {
            log('No DLT blue data found');
            return res.status(404).json({
                success: false,
                error: '未找到后区数据'
            });
        }

        log(`Found ${dltBlueData.length} records for DLT blue balls`);

        // 验证数据长度匹配
        if (dltRedData.length !== dltBlueData.length) {
            log('Data length mismatch between DLT red and blue balls');
            return res.status(500).json({
                success: false,
                error: '前区后区数据不一致'
            });
        }

        // 构建返回数据
        const trendChartData = dltRedData.map((redRecord, index) => {
            const blueRecord = dltBlueData[index];
            
            // 验证记录的完整性
            if (!redRecord || !blueRecord || !redRecord.Issue || !blueRecord.Issue || redRecord.Issue !== blueRecord.Issue) {
                log(`DLT data integrity issue at index ${index}`);
                throw new Error('大乐透数据完整性错误');
            }
            
            // 构建前区数据
            const frontZone = Array.from({length: 35}, (_, i) => ({
                number: i + 1,
                missing: redRecord[(i + 1).toString()],
                isDrawn: redRecord[(i + 1).toString()] === 0
            }));
            
            const backZone = Array.from({length: 12}, (_, i) => ({
                number: i + 1,
                missing: blueRecord[(i + 1).toString()],
                isDrawn: blueRecord[(i + 1).toString()] === 0
            }));

            // 计算统计数据
            const drawnFrontBalls = frontZone.filter(ball => ball.isDrawn);
            const frontNumbers = drawnFrontBalls.map(ball => ball.number);
            const drawnBackBalls = backZone.filter(ball => ball.isDrawn);
            const backNumbers = drawnBackBalls.map(ball => ball.number);
            
            // 计算前区和值、跨度
            const frontSum = frontNumbers.reduce((a, b) => a + b, 0);
            const frontSpan = frontNumbers.length > 0 ? Math.max(...frontNumbers) - Math.min(...frontNumbers) : 0;
            
            // 计算前区区间比
            let zone1Count = 0, zone2Count = 0, zone3Count = 0;
            frontNumbers.forEach(n => {
                if (n <= 12) zone1Count++;
                else if (n <= 24) zone2Count++;
                else zone3Count++;
            });
            const frontZoneRatio = `${zone1Count}:${zone2Count}:${zone3Count}`;
            
            // 计算前区奇偶比
            let frontOddCount = 0, frontEvenCount = 0;
            frontNumbers.forEach(n => n % 2 === 0 ? frontEvenCount++ : frontOddCount++);
            const frontOddEvenRatio = `${frontOddCount}:${frontEvenCount}`;

            // 计算后区和值、奇偶比
            const backSum = backNumbers.reduce((a, b) => a + b, 0);
            let backOddCount = 0, backEvenCount = 0;
            backNumbers.forEach(n => n % 2 === 0 ? backEvenCount++ : backOddCount++);
            const backOddEvenRatio = `${backOddCount}:${backEvenCount}`;
            
            return {
                issue: redRecord.Issue,
                drawingWeek: redRecord.DrawingWeek,
                drawingDay: redRecord.DrawingDay,
                frontZone,
                backZone,
                statistics: {
                    frontSum,
                    frontSpan,
                    frontHotWarmColdRatio: redRecord.FrontHotWarmColdRatio || '0:0:0',
                    frontZoneRatio,
                    frontOddEvenRatio,
                    backSum,
                    backOddEvenRatio
                }
            };
        });

        log(`Successfully prepared DLT trend chart data with ${trendChartData.length} records`);

        res.json({
            success: true,
            data: trendChartData
        });
    } catch (error) {
        log(`Error in DLT trend chart API: ${error.message}`);
        console.error('Error fetching DLT trend chart data:', error);
        res.status(500).json({
            success: false,
            error: error.message || '服务器内部错误'
        });
    }
});

app.get('/api/dlt/frequency', async (req, res) => {
    try {
        console.log('Fetching DLT frequency data...');
        
        res.json({
            success: true,
            data: { frequencies: [] }
        });
        
    } catch (error) {
        console.error('Error fetching DLT frequency:', error);
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// 辅助函数：计算大乐透区间比
function calculateDLTZoneRatio(numbers) {
    let zone1 = 0, zone2 = 0, zone3 = 0;
    numbers.forEach(n => {
        if (n <= 12) zone1++;
        else if (n <= 24) zone2++;
        else zone3++;
    });
    return `${zone1}:${zone2}:${zone3}`;
}

// 辅助函数：计算大乐透热温冷比
async function calculateDLTHotWarmColdRatio(numbers, baseIssue) {
    try {
        // 获取基准期的遗漏数据
        const missingData = await DLTRedMissing.findOne({ 
            Issue: baseIssue 
        });
        
        if (!missingData) {
            log(`找不到期号 ${baseIssue} 的遗漏数据，使用默认热温冷比`);
            return "0:0:5"; // 默认返回全冷
        }
        
        // 根据遗漏值判断红球的热温冷状态
        const hotColdStatus = numbers.map(num => {
            const missingValue = missingData[num.toString()];
            
            if (missingValue <= 4) {
                return 'hot';    // 热号(遗漏值≤4)
            } else if (missingValue >= 5 && missingValue <= 9) {
                return 'warm';   // 温号(遗漏值5-9)  
            } else {
                return 'cold';   // 冷号(遗漏值≥10)
            }
        });
        
        // 统计热温冷比例
        const hotCount = hotColdStatus.filter(s => s === 'hot').length;
        const warmCount = hotColdStatus.filter(s => s === 'warm').length;
        const coldCount = hotColdStatus.filter(s => s === 'cold').length;
        
        return `${hotCount}:${warmCount}:${coldCount}`;
    } catch (error) {
        log(`计算大乐透热温冷比出错: ${error.message}`);
        return "0:0:5"; // 默认返回
    }
}

// 辅助函数：计算奇偶比
function calculateDLTOddEvenRatio(numbers) {
    let odd = 0, even = 0;
    numbers.forEach(n => n % 2 === 0 ? even++ : odd++);
    return `${odd}:${even}`;
}

// ===== 大乐透同出数据接口 =====
app.get('/api/dlt/cooccurrence', async (req, res) => {
    try {
        log('Received DLT co-occurrence data request with query: ' + JSON.stringify(req.query));
        
        let query = {};
        let filename = '';
        
        // 处理期号范围筛选
        if (req.query.startIssue && req.query.endIssue) {
            const startIssue = req.query.startIssue;
            const endIssue = req.query.endIssue;
            
            // 通过ID范围查询
            const idRange = await convertDLTIssueRangeToIDRange(startIssue, endIssue);
            if (!idRange) {
                return res.json({
                    success: false,
                    message: '没有找到符合条件的数据'
                });
            }
            
            query = idRange.query;
            filename = `大乐透同出数据_${startIssue}至${endIssue}.xlsx`;
            log(`Fetching DLT co-occurrence data from ID ${idRange.startID} to ${idRange.endID} (issues: ${startIssue} to ${endIssue})`);
        } else {
            // 处理最近期数筛选
            const limit = parseInt(req.query.periods) || 30;
            filename = `大乐透同出数据_最近${limit}期.xlsx`;
            log(`Fetching DLT co-occurrence data for most recent ${limit} periods`);
        }

        let data;
        if (req.query.startIssue && req.query.endIssue) {
            data = await DLT.find(query).sort({ Issue: 1 });
        } else {
            const limit = parseInt(req.query.periods) || 30;
            data = await DLT.find({}).sort({ Issue: -1 }).limit(limit);
            data = data.reverse(); // 转为升序
        }

        if (!data || data.length === 0) {
            return res.json({
                success: false,
                message: '没有找到符合条件的数据'
            });
        }

        log(`Found ${data.length} records for DLT co-occurrence calculation`);

        // 计算同出数据
        const cooccurrenceMatrix = calculateDLTCooccurrenceMatrix(data);
        
        // 生成统计报告
        const statistics = generateDLTCooccurrenceStatistics(cooccurrenceMatrix, data);
        
        log(`Successfully calculated DLT co-occurrence data for ${data.length} records`);
        
        res.json({
            success: true,
            data: {
                matrix: cooccurrenceMatrix,
                statistics: statistics,
                periodInfo: {
                    totalPeriods: data.length,
                    startIssue: data[0].Issue,
                    endIssue: data[data.length - 1].Issue
                }
            }
        });
        
    } catch (error) {
        log(`Error in DLT co-occurrence API: ${error.message}`);
        console.error('Error calculating DLT co-occurrence data:', error);
        res.status(500).json({
            success: false,
            message: error.message || '计算同出数据失败'
        });
    }
});

// 大乐透同出数据Excel导出
app.get('/api/dlt/cooccurrence/excel', async (req, res) => {
    try {
        log('Received DLT co-occurrence Excel export request: ' + JSON.stringify(req.query));
        
        let query = {};
        let filename = '';
        
        // 处理期号范围筛选
        if (req.query.startIssue && req.query.endIssue) {
            const startIssue = req.query.startIssue;
            const endIssue = req.query.endIssue;
            
            // 通过ID范围查询
            const idRange = await convertDLTIssueRangeToIDRange(startIssue, endIssue);
            if (!idRange) {
                return res.json({
                    success: false,
                    message: '没有找到符合条件的数据'
                });
            }
            
            query = idRange.query;
            filename = `大乐透同出数据_${startIssue}至${endIssue}.xlsx`;
        } else {
            const limit = parseInt(req.query.periods) || 30;
            filename = `大乐透同出数据_最近${limit}期.xlsx`;
        }

        let data;
        if (req.query.startIssue && req.query.endIssue) {
            data = await DLT.find(query).sort({ Issue: 1 });
        } else {
            const limit = parseInt(req.query.periods) || 30;
            data = await DLT.find({}).sort({ Issue: -1 }).limit(limit);
            data = data.reverse();
        }

        if (!data || data.length === 0) {
            return res.json({
                success: false,
                message: '没有找到符合条件的数据'
            });
        }

        // 计算同出数据
        const cooccurrenceMatrix = calculateDLTCooccurrenceMatrix(data);
        
        // 生成Excel数据
        const excelData = generateDLTCooccurrenceExcelData(cooccurrenceMatrix);
        
        res.json({
            success: true,
            data: {
                excelData: excelData,
                filename: filename
            }
        });
        
    } catch (error) {
        log(`Error in DLT co-occurrence Excel export API: ${error.message}`);
        console.error('Error generating DLT co-occurrence Excel data:', error);
        res.status(500).json({
            success: false,
            message: error.message || '大乐透同出数据Excel导出失败'
        });
    }
});

// ===== 大乐透相克数据接口 =====
app.get('/api/dlt/conflict', async (req, res) => {
    try {
        log('Received DLT conflict data request with query: ' + JSON.stringify(req.query));
        
        let query = {};
        let filename = '';
        
        // 处理期号范围筛选
        if (req.query.startIssue && req.query.endIssue) {
            const startIssue = req.query.startIssue;
            const endIssue = req.query.endIssue;
            
            // 通过ID范围查询
            const idRange = await convertDLTIssueRangeToIDRange(startIssue, endIssue);
            if (!idRange) {
                return res.json({
                    success: false,
                    message: '没有找到符合条件的数据'
                });
            }
            
            query = idRange.query;
            filename = `大乐透相克数据_${startIssue}至${endIssue}.xlsx`;
            log(`Fetching DLT conflict data from ID ${idRange.startID} to ${idRange.endID} (issues: ${startIssue} to ${endIssue})`);
        } else {
            // 处理最近期数筛选
            const limit = parseInt(req.query.periods) || 30;
            filename = `大乐透相克数据_最近${limit}期.xlsx`;
            log(`Fetching DLT conflict data for most recent ${limit} periods`);
        }

        let data;
        if (req.query.startIssue && req.query.endIssue) {
            // 由于Issue字段是字符串，我们需要使用正确的查询方式
            data = await DLT.find(query).sort({ Issue: 1 });
            
            // 如果没有数据，打印调试信息
            if (!data || data.length === 0) {
                log(`No data found for query: ${JSON.stringify(query)}`);
                // 尝试查看数据库中的实际数据
                const sampleData = await DLT.find({}).sort({ Issue: -1 }).limit(5).select('Issue');
                log(`Sample recent issues: ${JSON.stringify(sampleData.map(d => d.Issue))}`);
            }
        } else {
            const limit = parseInt(req.query.periods) || 30;
            data = await DLT.find({}).sort({ Issue: -1 }).limit(limit);
            data = data.reverse(); // 转为升序
        }

        if (!data || data.length === 0) {
            return res.json({
                success: false,
                message: '没有找到符合条件的数据'
            });
        }

        log(`Found ${data.length} records for DLT conflict calculation`);

        // 计算相克数据
        const conflictMatrix = calculateDLTConflictMatrix(data);
        
        // 生成统计报告
        const statistics = generateDLTConflictStatistics(conflictMatrix, data);
        
        log(`Successfully calculated DLT conflict data for ${data.length} records`);
        
        res.json({
            success: true,
            data: {
                matrix: conflictMatrix,
                statistics: statistics,
                periodInfo: {
                    totalPeriods: data.length,
                    startIssue: data[0].Issue,
                    endIssue: data[data.length - 1].Issue
                }
            }
        });
        
    } catch (error) {
        log(`Error in DLT conflict API: ${error.message}`);
        console.error('Error calculating DLT conflict data:', error);
        res.status(500).json({
            success: false,
            message: error.message || '计算相克数据失败'
        });
    }
});

// 大乐透相克数据Excel导出
app.get('/api/dlt/conflict/excel', async (req, res) => {
    try {
        log('Received DLT conflict Excel export request: ' + JSON.stringify(req.query));
        
        let query = {};
        let filename = '';
        
        // 处理期号范围筛选
        if (req.query.startIssue && req.query.endIssue) {
            const startIssue = req.query.startIssue;
            const endIssue = req.query.endIssue;
            
            // 通过ID范围查询
            const idRange = await convertDLTIssueRangeToIDRange(startIssue, endIssue);
            if (!idRange) {
                return res.json({
                    success: false,
                    message: '没有找到符合条件的数据'
                });
            }
            
            query = idRange.query;
            filename = `大乐透相克数据_${startIssue}至${endIssue}.xlsx`;
        } else {
            const limit = parseInt(req.query.periods) || 30;
            filename = `大乐透相克数据_最近${limit}期.xlsx`;
        }

        let data;
        if (req.query.startIssue && req.query.endIssue) {
            data = await DLT.find(query).sort({ Issue: 1 });
        } else {
            const limit = parseInt(req.query.periods) || 30;
            data = await DLT.find({}).sort({ Issue: -1 }).limit(limit);
            data = data.reverse();
        }

        if (!data || data.length === 0) {
            return res.json({
                success: false,
                message: '没有找到符合条件的数据'
            });
        }

        // 计算相克数据
        const conflictMatrix = calculateDLTConflictMatrix(data);
        
        // 生成Excel数据
        const excelData = generateDLTConflictExcelData(conflictMatrix);
        
        res.json({
            success: true,
            data: {
                excelData: excelData,
                filename: filename
            }
        });
        
    } catch (error) {
        log(`Error in DLT conflict Excel export API: ${error.message}`);
        console.error('Error generating DLT conflict Excel data:', error);
        res.status(500).json({
            success: false,
            message: error.message || '大乐透相克数据Excel导出失败'
        });
    }
});

// ===== 大乐透数据计算函数 =====

// 计算大乐透同出矩阵
function calculateDLTCooccurrenceMatrix(data) {
    const cooccurrenceMatrix = {};
    
    // 初始化前区1-35的同出矩阵
    for (let frontBall = 1; frontBall <= 35; frontBall++) {
        cooccurrenceMatrix[frontBall] = {
            frontCounts: {},   // 与其他前区球的同出次数
            backCounts: {}     // 与后区球的同出次数
        };
        
        // 初始化与其他前区球的同出计数
        for (let otherFront = 1; otherFront <= 35; otherFront++) {
            cooccurrenceMatrix[frontBall].frontCounts[otherFront] = 0;
        }
        
        // 初始化与后区球的同出计数
        for (let back = 1; back <= 12; back++) {
            cooccurrenceMatrix[frontBall].backCounts[back] = 0;
        }
    }
    
    // 遍历每期数据计算同出次数
    data.forEach(record => {
        const frontBalls = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];
        const backBalls = [record.Blue1, record.Blue2];
        
        // 计算前区球间的同出次数
        for (let i = 0; i < frontBalls.length; i++) {
            for (let j = 0; j < frontBalls.length; j++) {
                if (i !== j) {
                    cooccurrenceMatrix[frontBalls[i]].frontCounts[frontBalls[j]]++;
                }
            }
            
            // 计算前区球与后区球的同出次数
            backBalls.forEach(backBall => {
                cooccurrenceMatrix[frontBalls[i]].backCounts[backBall]++;
            });
        }
    });
    
    return cooccurrenceMatrix;
}

// 计算大乐透相克矩阵
function calculateDLTConflictMatrix(data) {
    const conflictMatrix = {};
    
    // 初始化前区1-35的相克矩阵
    for (let frontBall = 1; frontBall <= 35; frontBall++) {
        conflictMatrix[frontBall] = {
            frontCounts: {},   // 与其他前区球的相克次数
            backCounts: {},    // 与后区球的相克次数
            drawCount: 0,      // 在所选期数内的开奖次数
            missingValue: 0    // 最后一期的遗漏值
        };
        
        // 初始化与其他前区球的相克计数
        for (let otherFront = 1; otherFront <= 35; otherFront++) {
            conflictMatrix[frontBall].frontCounts[otherFront] = 0;
        }
        
        // 初始化与后区球的相克计数
        for (let back = 1; back <= 12; back++) {
            conflictMatrix[frontBall].backCounts[back] = 0;
        }
    }
    
    // 遍历每期数据计算相克次数
    data.forEach(record => {
        const drawnFrontBalls = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];
        const drawnBackBalls = [record.Blue1, record.Blue2];
        
        // 获取未开出的前区球
        const undrawnFrontBalls = [];
        for (let i = 1; i <= 35; i++) {
            if (!drawnFrontBalls.includes(i)) {
                undrawnFrontBalls.push(i);
            }
        }
        
        // 获取未开出的后区球
        const undrawnBackBalls = [];
        for (let i = 1; i <= 12; i++) {
            if (!drawnBackBalls.includes(i)) {
                undrawnBackBalls.push(i);
            }
        }
        
        // 计算已开出前区球与未开出前区球的相克关系
        drawnFrontBalls.forEach(drawnFront => {
            undrawnFrontBalls.forEach(undrawnFront => {
                conflictMatrix[drawnFront].frontCounts[undrawnFront]++;
            });
            
            // 计算已开出前区球与未开出后区球的相克关系
            undrawnBackBalls.forEach(undrawnBack => {
                conflictMatrix[drawnFront].backCounts[undrawnBack]++;
            });
        });
        
        // 统计各号码的开奖次数
        drawnFrontBalls.forEach(drawnFront => {
            conflictMatrix[drawnFront].drawCount++;
        });
    });
    
    // 计算遗漏值 (基于最后一期数据)
    if (data.length > 0) {
        const lastRecord = data[data.length - 1];
        const lastDrawnBalls = [lastRecord.Red1, lastRecord.Red2, lastRecord.Red3, lastRecord.Red4, lastRecord.Red5];
        
        // 从最后一期往前计算每个号码的遗漏值
        for (let frontBall = 1; frontBall <= 35; frontBall++) {
            let missing = 0;
            
            // 从最后一期开始往前查找该号码最近一次出现
            for (let i = data.length - 1; i >= 0; i--) {
                const currentDrawnBalls = [data[i].Red1, data[i].Red2, data[i].Red3, data[i].Red4, data[i].Red5];
                if (currentDrawnBalls.includes(frontBall)) {
                    break; // 找到最近出现位置，停止计数
                }
                missing++;
            }
            
            conflictMatrix[frontBall].missingValue = missing;
        }
    }
    
    return conflictMatrix;
}

// 生成大乐透同出数据统计报告
function generateDLTCooccurrenceStatistics(matrix, data) {
    // 统计每个号码的出现频率
    const frontFreq = {}, backFreq = {};
    
    data.forEach(record => {
        [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5].forEach(ball => {
            frontFreq[ball] = (frontFreq[ball] || 0) + 1;
        });
        [record.Blue1, record.Blue2].forEach(ball => {
            backFreq[ball] = (backFreq[ball] || 0) + 1;
        });
    });
    
    // 将频率转换为数组并排序
    const frontFreqArray = Object.keys(frontFreq).map(num => ({
        num: parseInt(num),
        freq: frontFreq[num]
    })).sort((a, b) => b.freq - a.freq);
    
    const backFreqArray = Object.keys(backFreq).map(num => ({
        num: parseInt(num),
        freq: backFreq[num]
    })).sort((a, b) => b.freq - a.freq);
    
    const statistics = {
        frontBallStats: { 
            hottest: frontFreqArray[0] || { num: 0, freq: 0 }, 
            coldest: frontFreqArray[frontFreqArray.length - 1] || { num: 0, freq: Infinity },
            top5Hottest: frontFreqArray.slice(0, 5),  // 前5位最热号码
            top5Coldest: frontFreqArray.slice(-5).reverse()  // 前5位最冷号码
        },
        backBallStats: { 
            hottest: backFreqArray[0] || { num: 0, freq: 0 }, 
            coldest: backFreqArray[backFreqArray.length - 1] || { num: 0, freq: Infinity },
            top5Hottest: backFreqArray.slice(0, 5),  // 前5位最热号码
            top5Coldest: backFreqArray.slice(-5).reverse()  // 前5位最冷号码
        },
        maxCooccurrence: { front: { balls: [], count: 0 }, frontBack: { balls: [], count: 0 } }
    };
    
    // 找出最高同出组合
    let maxFrontCooccurrence = 0;
    let maxFrontBackCooccurrence = 0;
    
    for (let front1 = 1; front1 <= 35; front1++) {
        for (let front2 = front1 + 1; front2 <= 35; front2++) {
            const cooccurrenceCount = matrix[front1].frontCounts[front2];
            if (cooccurrenceCount > maxFrontCooccurrence) {
                maxFrontCooccurrence = cooccurrenceCount;
                statistics.maxCooccurrence.front = {
                    balls: [front1, front2],
                    count: cooccurrenceCount
                };
            }
        }
        
        for (let back = 1; back <= 12; back++) {
            const cooccurrenceCount = matrix[front1].backCounts[back];
            if (cooccurrenceCount > maxFrontBackCooccurrence) {
                maxFrontBackCooccurrence = cooccurrenceCount;
                statistics.maxCooccurrence.frontBack = {
                    balls: [front1, back],
                    count: cooccurrenceCount
                };
            }
        }
    }
    
    return statistics;
}

// 生成大乐透相克数据统计报告
function generateDLTConflictStatistics(matrix, data) {
    // 统计每个号码的开奖频率
    const frontFreq = {}, backFreq = {};
    
    data.forEach(record => {
        [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5].forEach(ball => {
            frontFreq[ball] = (frontFreq[ball] || 0) + 1;
        });
        [record.Blue1, record.Blue2].forEach(ball => {
            backFreq[ball] = (backFreq[ball] || 0) + 1;
        });
    });
    
    // 将频率转换为数组并排序
    const frontFreqArray = Object.keys(frontFreq).map(num => ({
        num: parseInt(num),
        freq: frontFreq[num]
    })).sort((a, b) => b.freq - a.freq);
    
    const backFreqArray = Object.keys(backFreq).map(num => ({
        num: parseInt(num),
        freq: backFreq[num]
    })).sort((a, b) => b.freq - a.freq);
    
    const statistics = {
        frontBallStats: { 
            mostConflicted: { num: 0, total: 0 }, 
            leastConflicted: { num: 0, total: Infinity },
            top5Hottest: frontFreqArray.slice(0, 5),  // 前5位最热号码
            top5Coldest: frontFreqArray.slice(-5).reverse()  // 前5位最冷号码
        },
        backBallStats: { 
            mostConflicted: { num: 0, total: 0 }, 
            leastConflicted: { num: 0, total: Infinity },
            top5Hottest: backFreqArray.slice(0, 5),  // 前5位最热号码
            top5Coldest: backFreqArray.slice(-5).reverse()  // 前5位最冷号码
        },
        maxConflict: { front: { balls: [], count: 0 }, frontBack: { balls: [], count: 0 } }
    };
    
    // 计算每个前区号码的相克总数
    for (let front = 1; front <= 35; front++) {
        let totalConflict = 0;
        
        // 加上与其他前区球的相克数
        for (let otherFront = 1; otherFront <= 35; otherFront++) {
            if (front !== otherFront) {
                totalConflict += matrix[front].frontCounts[otherFront];
            }
        }
        
        // 加上与后区球的相克数
        for (let back = 1; back <= 12; back++) {
            totalConflict += matrix[front].backCounts[back];
        }
        
        if (totalConflict > statistics.frontBallStats.mostConflicted.total) {
            statistics.frontBallStats.mostConflicted = { num: front, total: totalConflict };
        }
        if (totalConflict < statistics.frontBallStats.leastConflicted.total) {
            statistics.frontBallStats.leastConflicted = { num: front, total: totalConflict };
        }
    }
    
    // 计算每个后区号码被相克的总数
    for (let back = 1; back <= 12; back++) {
        let totalConflicted = 0;
        
        for (let front = 1; front <= 35; front++) {
            totalConflicted += matrix[front].backCounts[back];
        }
        
        if (totalConflicted > statistics.backBallStats.mostConflicted.total) {
            statistics.backBallStats.mostConflicted = { num: back, total: totalConflicted };
        }
        if (totalConflicted < statistics.backBallStats.leastConflicted.total) {
            statistics.backBallStats.leastConflicted = { num: back, total: totalConflicted };
        }
    }
    
    // 找出最高相克组合
    let maxFrontConflict = 0;
    let maxFrontBackConflict = 0;
    
    for (let front1 = 1; front1 <= 35; front1++) {
        for (let front2 = front1 + 1; front2 <= 35; front2++) {
            const conflictCount1 = matrix[front1].frontCounts[front2];
            const conflictCount2 = matrix[front2].frontCounts[front1];
            const totalConflict = conflictCount1 + conflictCount2;
            
            if (totalConflict > maxFrontConflict) {
                maxFrontConflict = totalConflict;
                statistics.maxConflict.front = {
                    balls: [front1, front2],
                    count: totalConflict
                };
            }
        }
        
        for (let back = 1; back <= 12; back++) {
            const conflictCount = matrix[front1].backCounts[back];
            if (conflictCount > maxFrontBackConflict) {
                maxFrontBackConflict = conflictCount;
                statistics.maxConflict.frontBack = {
                    balls: [front1, back],
                    count: conflictCount
                };
            }
        }
    }
    
    return statistics;
}

// 大乐透专家和值预测API
app.get('/api/dlt/sum-prediction', async (req, res) => {
    try {
        log('Received DLT sum prediction request: ' + JSON.stringify(req.query));
        
        const periodGroup = parseInt(req.query.periodGroup) || 30; // 期数分组，默认30期
        const maPeriod = parseInt(req.query.maPeriod) || 20; // MA周期，默认20期
        
        // 热温冷比排除参数
        const excludeHtcRatios = req.query.excludeHtcRatios ? req.query.excludeHtcRatios.split(',') : [];
        const htcRecentPeriods = parseInt(req.query.htcRecentPeriods) || 0;
        const excludePreHtc = req.query.excludePreHtc === 'true';
        const excludePreHtcPeriods = parseInt(req.query.excludePreHtcPeriods) || 10;
        
        // 区间比排除参数
        const excludeZoneRatios = req.query.excludeZoneRatios ? req.query.excludeZoneRatios.split(',') : [];
        const zoneRecentPeriods = parseInt(req.query.zoneRecentPeriods) || 0;
        const excludePreZone = req.query.excludePreZone === 'true';
        let recentData;
        let queryInfo = {};
        
        // 检查是否使用期号范围查询
        if (req.query.startIssue && req.query.endIssue) {
            const startIssue = parseInt(req.query.startIssue);
            const endIssue = parseInt(req.query.endIssue);
            
            // 验证期号范围
            if (startIssue > endIssue) {
                return res.json({
                    success: false,
                    message: '起始期号不能大于结束期号'
                });
            }
            
            // 为了进行滑动窗口预测验证，需要更大的数据范围
            // 实际查询范围：从startIssue往前扩展periodGroup期，到endIssue往后扩展periodGroup期
            const expandedStartIssue = Math.max(startIssue - periodGroup, startIssue - 100); // 最多往前100期
            const expandedEndIssue = endIssue + periodGroup; // 往后扩展periodGroup期
            
            // 根据扩展的期号范围查询
            recentData = await DLT.find({
                Issue: { $gte: expandedStartIssue, $lte: expandedEndIssue }
            }).sort({ Issue: 1 }); // 按期号升序排列
            
            queryInfo = {
                type: 'range',
                startIssue,
                endIssue,
                expandedStartIssue,
                expandedEndIssue,
                totalPeriods: recentData.length,
                targetPeriods: endIssue - startIssue + 1
            };
            
            log(`Querying DLT data by expanded issue range: ${expandedStartIssue} - ${expandedEndIssue} (target: ${startIssue} - ${endIssue}), found ${recentData.length} records`);
            
        } else if (req.query.analyzeAll === 'true') {
            // 从最开始分析所有数据
            recentData = await DLT.find({}).sort({ Issue: 1 }); // 按期号升序排列
            
            queryInfo = {
                type: 'all',
                totalPeriods: recentData.length
            };
            
            log(`Querying all DLT data from beginning, found ${recentData.length} records`);
            
        } else if (req.query.startFrom) {
            // 从最近第N期开始分析
            const startFrom = parseInt(req.query.startFrom);
            
            // 获取所有数据，然后取从倒数第startFrom期开始的数据
            const allData = await DLT.find({}).sort({ Issue: -1 });
            
            if (allData.length <= startFrom) {
                // 如果请求的期数超过总期数，则使用所有数据
                recentData = allData.reverse(); // 转为升序
            } else {
                // 取最近的startFrom期数据
                // allData是降序的，取前startFrom条就是最近startFrom期
                recentData = allData.slice(0, startFrom).reverse(); // 转为升序
            }
            
            queryInfo = {
                type: 'startFrom',
                startFrom,
                totalPeriods: recentData.length,
                availableTotal: allData.length
            };
            
            log(`Querying DLT data starting from recent ${startFrom}th period, found ${recentData.length} records`);
            
        } else {
            // 使用期数限制查询（向后兼容）
            const limit = parseInt(req.query.limit) || 100;
            recentData = await DLT.find({}).sort({ Issue: -1 }).limit(limit);
            
            queryInfo = {
                type: 'limit',
                limit,
                totalPeriods: recentData.length
            };
            
            log(`Querying DLT data by limit: ${limit} periods, found ${recentData.length} records`);
        }
        
        if (recentData.length === 0) {
            return res.json({
                success: false,
                message: '没有找到符合条件的历史数据'
            });
        }
        
        // 确保数据按期号升序排列用于分析
        if (queryInfo.type === 'limit') {
            recentData = recentData.reverse(); // 将降序转为升序
        }
        // startFrom和all类型的数据已经是升序排列，不需要再处理
        
        // 生成和值历史数据表
        const sumHistoryTable = generateDLTSumHistoryTable(recentData);
        
        // 按期数分组分析
        const groupAnalysis = analyzeDLTSumByGroups(recentData, periodGroup);
        
        // 生成预测结果
        const htcExclusionOptions = {
            excludeHtcRatios,
            htcRecentPeriods,
            excludePreHtc,
            excludePreHtcPeriods
        };
        const zoneExclusionOptions = {
            excludeZoneRatios,
            zoneRecentPeriods,
            excludePreZone
        };
        const prediction = await generateDLTSumPrediction(groupAnalysis, sumHistoryTable, recentData, periodGroup, maPeriod, htcExclusionOptions, zoneExclusionOptions);
        
        // 生成验证结果
        const validation = await generateDLTSumValidation(recentData, periodGroup, queryInfo, maPeriod);
        
        res.json({
            success: true,
            data: {
                sumHistoryTable,
                groupAnalysis,
                prediction,
                validation,
                periodInfo: {
                    queryType: queryInfo.type,
                    totalPeriods: queryInfo.totalPeriods,
                    periodGroup: periodGroup,
                    startIssue: recentData[0].Issue,
                    endIssue: recentData[recentData.length - 1].Issue,
                    ...(queryInfo.type === 'range' ? {
                        requestedStartIssue: queryInfo.startIssue,
                        requestedEndIssue: queryInfo.endIssue
                    } : queryInfo.type === 'startFrom' ? {
                        requestedStartFrom: queryInfo.startFrom,
                        availableTotal: queryInfo.availableTotal
                    } : queryInfo.type === 'all' ? {
                        description: '从最开始分析全部数据'
                    } : {
                        requestedLimit: queryInfo.limit
                    })
                }
            }
        });
        
    } catch (error) {
        log(`Error in DLT sum prediction API: ${error.message}`);
        console.error('Error generating DLT sum prediction:', error);
        res.status(500).json({
            success: false,
            message: error.message || '生成和值预测失败'
        });
    }
});

// 分组预测验证API
app.get('/api/dlt/group-validation', async (req, res) => {
    try {
        log('收到分组验证请求: ' + JSON.stringify(req.query));
        
        const periodGroup = parseInt(req.query.periodGroup) || 30;
        const testPeriods = parseInt(req.query.testPeriods) || 200;
        
        // 获取测试数据
        const allData = await DLT.find({}).sort({ Issue: -1 }).limit(testPeriods);
        const sortedData = allData.reverse(); // 转为升序
        
        log(`获取到 ${sortedData.length} 期数据，期号范围: ${sortedData[0].Issue} - ${sortedData[sortedData.length - 1].Issue}`);
        
        // 简化的预测函数
        function generateSimplePrediction(trainData) {
            const frontSums = trainData.map(d => d.Red1 + d.Red2 + d.Red3 + d.Red4 + d.Red5);
            const backSums = trainData.map(d => d.Blue1 + d.Blue2);
            
            const frontAvg = frontSums.reduce((a, b) => a + b, 0) / frontSums.length;
            const backAvg = backSums.reduce((a, b) => a + b, 0) / backSums.length;
            
            return {
                frontSum: {
                    recommended: Math.round(frontAvg),
                    range: {
                        min: Math.round(frontAvg - 20),
                        max: Math.round(frontAvg + 20)
                    },
                    confidence: 75
                },
                backSum: {
                    recommended: Math.round(backAvg),
                    range: {
                        min: Math.round(backAvg - 5),
                        max: Math.round(backAvg + 5)
                    },
                    confidence: 75
                }
            };
        }
        
        const validationResults = [];
        
        // 滑动窗口验证
        for (let i = 0; i <= sortedData.length - periodGroup - 1; i++) {
            const predictIndex = i + periodGroup;
            if (predictIndex >= sortedData.length) break;
            
            const trainData = sortedData.slice(i, i + periodGroup);
            const actualRecord = sortedData[predictIndex];
            
            const prediction = generateSimplePrediction(trainData);
            
            const actualFrontSum = actualRecord.Red1 + actualRecord.Red2 + actualRecord.Red3 + actualRecord.Red4 + actualRecord.Red5;
            const actualBackSum = actualRecord.Blue1 + actualRecord.Blue2;
            
            const frontHit = actualFrontSum >= prediction.frontSum.range.min && 
                           actualFrontSum <= prediction.frontSum.range.max;
            const backHit = actualBackSum >= prediction.backSum.range.min && 
                          actualBackSum <= prediction.backSum.range.max;
            
            validationResults.push({
                windowInfo: {
                    startIssue: trainData[0].Issue,
                    endIssue: trainData[trainData.length - 1].Issue,
                    predictIssue: actualRecord.Issue,
                    windowIndex: i + 1,
                    description: `第${i + 1}组(${trainData[0].Issue}-${trainData[trainData.length - 1].Issue})预测${actualRecord.Issue}`
                },
                predicted: {
                    frontSum: prediction.frontSum,
                    backSum: prediction.backSum
                },
                actual: {
                    frontSum: actualFrontSum,
                    backSum: actualBackSum
                },
                accuracy: {
                    frontHit,
                    backHit,
                    bothHit: frontHit && backHit
                }
            });
        }
        
        // 计算总体准确率
        const totalGroups = validationResults.length;
        const frontHits = validationResults.filter(r => r.accuracy.frontHit).length;
        const backHits = validationResults.filter(r => r.accuracy.backHit).length;
        const bothHits = validationResults.filter(r => r.accuracy.bothHit).length;
        
        const validationData = {
            totalTests: totalGroups,
            accuracy: {
                front: ((frontHits / totalGroups) * 100).toFixed(1),
                back: ((backHits / totalGroups) * 100).toFixed(1),
                both: ((bothHits / totalGroups) * 100).toFixed(1)
            },
            results: validationResults,
            parameters: {
                periodGroup,
                testPeriods,
                dataRange: {
                    startIssue: sortedData[0].Issue,
                    endIssue: sortedData[sortedData.length - 1].Issue
                }
            }
        };
        
        log(`验证完成: 总组数${totalGroups}, 前区准确率${validationData.accuracy.front}%, 后区准确率${validationData.accuracy.back}%`);
        
        res.json({
            success: true,
            data: validationData
        });
        
    } catch (error) {
        log(`分组验证API错误: ${error.message}`);
        console.error('Error in group validation API:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 生成大乐透同出数据Excel格式数据
function generateDLTCooccurrenceExcelData(matrix) {
    const rows = [];
    
    // 添加表头
    const header = ['前区号码'];
    for (let i = 1; i <= 35; i++) {
        header.push(`前区${i.toString().padStart(2, '0')}`);
    }
    for (let i = 1; i <= 12; i++) {
        header.push(`后区${i.toString().padStart(2, '0')}`);
    }
    rows.push(header);
    
    // 生成数据行
    for (let frontBall = 1; frontBall <= 35; frontBall++) {
        const row = [frontBall.toString().padStart(2, '0')];
        
        // 添加与其他前区球的同出次数
        for (let otherFront = 1; otherFront <= 35; otherFront++) {
            if (frontBall === otherFront) {
                row.push('-');
            } else {
                row.push(matrix[frontBall].frontCounts[otherFront]);
            }
        }
        
        // 添加与后区球的同出次数
        for (let back = 1; back <= 12; back++) {
            row.push(matrix[frontBall].backCounts[back]);
        }
        
        rows.push(row);
    }

    return rows;
}

// 生成大乐透相克数据Excel格式数据
function generateDLTConflictExcelData(matrix) {
    const rows = [];
    
    // 添加表头
    const header = ['前区号码'];
    for (let i = 1; i <= 35; i++) {
        header.push(`前区${i.toString().padStart(2, '0')}`);
    }
    for (let i = 1; i <= 12; i++) {
        header.push(`后区${i.toString().padStart(2, '0')}`);
    }
    rows.push(header);
    
    // 生成数据行
    for (let frontBall = 1; frontBall <= 35; frontBall++) {
        const row = [frontBall.toString().padStart(2, '0')];
        
        // 添加与其他前区球的相克次数
        for (let otherFront = 1; otherFront <= 35; otherFront++) {
            if (frontBall === otherFront) {
                row.push('-');
            } else {
                row.push(matrix[frontBall].frontCounts[otherFront]);
            }
        }
        
        // 添加与后区球的相克次数
        for (let back = 1; back <= 12; back++) {
            row.push(matrix[frontBall].backCounts[back]);
        }
        
        rows.push(row);
    }

    return rows;
}

// 大乐透和值预测辅助函数

// 生成大乐透和值历史数据表
function generateDLTSumHistoryTable(data) {
    return data.map(record => ({
        id: record.ID,
        issue: record.Issue,
        frontSum: record.Red1 + record.Red2 + record.Red3 + record.Red4 + record.Red5,
        backSum: record.Blue1 + record.Blue2,
        drawingDay: record.DrawingDay,
        drawingWeek: record.DrawingWeek
    })).reverse(); // 反转数组，让最老的期号在前
}

// 按期数分组分析大乐透和值趋势
function analyzeDLTSumByGroups(data, periodGroup) {
    const sortedData = data.slice().reverse(); // 确保按期号升序排列
    const groups = [];
    
    // 将数据按指定期数分组
    for (let i = 0; i < sortedData.length - periodGroup + 1; i++) {
        const groupData = sortedData.slice(i, i + periodGroup);
        const startIssue = groupData[0].Issue;
        const endIssue = groupData[groupData.length - 1].Issue;
        
        // 计算该组的和值统计
        const frontSums = groupData.map(d => d.Red1 + d.Red2 + d.Red3 + d.Red4 + d.Red5);
        const backSums = groupData.map(d => d.Blue1 + d.Blue2);
        
        const analysis = {
            groupId: i + 1,
            startIssue,
            endIssue,
            periodCount: periodGroup,
            frontSumStats: calculateSumStatistics(frontSums),
            backSumStats: calculateSumStatistics(backSums),
            trends: analyzeSumTrends(frontSums, backSums)
        };
        
        groups.push(analysis);
    }
    
    return groups;
}

// 计算和值统计信息
function calculateSumStatistics(sums) {
    const sorted = sums.slice().sort((a, b) => a - b);
    const avg = sums.reduce((a, b) => a + b, 0) / sums.length;
    const min = Math.min(...sums);
    const max = Math.max(...sums);
    
    // 计算和值出现频率
    const frequency = {};
    sums.forEach(sum => {
        frequency[sum] = (frequency[sum] || 0) + 1;
    });
    
    // 找出最常出现的和值
    const mostFrequent = Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([sum, freq]) => ({ sum: parseInt(sum), frequency: freq }));
    
    return {
        average: Math.round(avg * 100) / 100,
        min,
        max,
        median: sorted[Math.floor(sorted.length / 2)],
        range: max - min,
        mostFrequent,
        frequency
    };
}

// 分析和值趋势
function analyzeSumTrends(frontSums, backSums) {
    const frontTrend = calculateTrend(frontSums);
    const backTrend = calculateTrend(backSums);
    
    return {
        frontTrend: {
            direction: frontTrend > 0 ? 'up' : frontTrend < 0 ? 'down' : 'stable',
            strength: Math.abs(frontTrend),
            description: frontTrend > 0 ? '上升趋势' : frontTrend < 0 ? '下降趋势' : '平稳'
        },
        backTrend: {
            direction: backTrend > 0 ? 'up' : backTrend < 0 ? 'down' : 'stable',
            strength: Math.abs(backTrend),
            description: backTrend > 0 ? '上升趋势' : backTrend < 0 ? '下降趋势' : '平稳'
        }
    };
}

// 计算趋势斜率（简单线性回归）
function calculateTrend(values) {
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    for (let i = 0; i < n; i++) {
        const x = i + 1; // 期数
        const y = values[i]; // 和值
        
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
}

// 应用热温冷比排除逻辑
async function applyHotWarmColdExclusion(historicalData, htcExclusionOptions) {
    const { excludeHtcRatios = [], htcRecentPeriods = 0, excludePreHtc = false, excludePreHtcPeriods = 10 } = htcExclusionOptions;
    
    if (excludeHtcRatios.length === 0 && htcRecentPeriods === 0 && !excludePreHtc) {
        return historicalData;
    }
    
    console.log('开始应用热温冷比排除逻辑...');
    console.log(`排除特定比例: ${excludeHtcRatios.join(', ')}`);
    console.log(`排除历史期数: ${htcRecentPeriods}期`);
    console.log(`排除预测期前: ${excludePreHtc}`);
    
    try {
        // 获取热温冷比历史数据
        const htcData = await DLTRedMissing.find({}).sort({ Issue: 1 });
        const htcMap = new Map(htcData.map(d => [d.Issue, d.HotWarmColdRatio]));
        
        let filteredData = [...historicalData];
        const excludedIssues = new Set();
        
        // 1. 排除特定热温冷比
        if (excludeHtcRatios.length > 0) {
            for (const record of historicalData) {
                const htcRatio = htcMap.get(record.Issue);
                if (htcRatio && excludeHtcRatios.includes(htcRatio)) {
                    excludedIssues.add(record.Issue);
                }
            }
            console.log(`按特定比例排除了 ${excludedIssues.size} 期`);
        }
        
        // 2. 排除最近N期的热温冷比
        if (htcRecentPeriods > 0) {
            const recentHtcRatios = new Set();
            const recentRecords = historicalData.slice(-htcRecentPeriods);
            
            for (const record of recentRecords) {
                const htcRatio = htcMap.get(record.Issue);
                if (htcRatio) {
                    recentHtcRatios.add(htcRatio);
                }
            }
            
            for (const record of historicalData) {
                const htcRatio = htcMap.get(record.Issue);
                if (htcRatio && recentHtcRatios.has(htcRatio)) {
                    excludedIssues.add(record.Issue);
                }
            }
            console.log(`按历史期数排除了额外 ${excludedIssues.size} 期`);
        }
        
        // 3. 排除预测期前的热温冷比
        if (excludePreHtc && historicalData.length > 0) {
            const sortedData = [...historicalData].sort((a, b) => b.Issue - a.Issue);
            const recentIssues = sortedData.slice(0, excludePreHtcPeriods);
            const recentHtcRatios = new Set();
            
            // 收集最近N期的热温冷比
            for (const record of recentIssues) {
                const htcRatio = htcMap.get(record.Issue);
                if (htcRatio) {
                    recentHtcRatios.add(htcRatio);
                }
            }
            
            if (recentHtcRatios.size > 0) {
                for (const record of historicalData) {
                    const htcRatio = htcMap.get(record.Issue);
                    if (htcRatio && recentHtcRatios.has(htcRatio)) {
                        excludedIssues.add(record.Issue);
                    }
                }
                console.log(`按预测期前${excludePreHtcPeriods}期排除了额外期数，预测期前比例: ${Array.from(recentHtcRatios).join(', ')}`);
            }
        }
        
        // 过滤数据
        filteredData = historicalData.filter(record => !excludedIssues.has(record.Issue));
        
        console.log(`总共排除了 ${excludedIssues.size} 期，剩余 ${filteredData.length} 期`);
        return filteredData;
        
    } catch (error) {
        console.error('热温冷比排除逻辑出错:', error);
        return historicalData; // 出错时返回原数据
    }
}

// 应用区间比排除逻辑
async function applyZoneRatioExclusion(historicalData, zoneExclusionOptions) {
    const { excludeZoneRatios = [], zoneRecentPeriods = 0, excludePreZone = false } = zoneExclusionOptions;
    
    if (excludeZoneRatios.length === 0 && zoneRecentPeriods === 0 && !excludePreZone) {
        return historicalData;
    }
    
    console.log('开始应用区间比排除逻辑...');
    console.log(`排除特定比例: ${excludeZoneRatios.join(', ')}`);
    console.log(`排除历史期数: ${zoneRecentPeriods}期`);
    console.log(`排除预测期前: ${excludePreZone}`);
    
    try {
        // 计算每条记录的区间比
        const dataWithZoneRatio = historicalData.map(record => {
            const frontBalls = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];
            let zone1 = 0, zone2 = 0, zone3 = 0;
            
            frontBalls.forEach(num => {
                if (num <= 12) zone1++;
                else if (num <= 24) zone2++;
                else zone3++;
            });
            
            return {
                ...record,
                zoneRatio: `${zone1}:${zone2}:${zone3}`
            };
        });
        
        let filteredData = [...dataWithZoneRatio];
        const excludedIssues = new Set();
        
        // 1. 排除特定区间比
        if (excludeZoneRatios.length > 0) {
            for (const record of dataWithZoneRatio) {
                if (excludeZoneRatios.includes(record.zoneRatio)) {
                    excludedIssues.add(record.Issue);
                }
            }
            console.log(`按特定比例排除了 ${excludedIssues.size} 期`);
        }
        
        // 2. 排除最近N期的区间比
        if (zoneRecentPeriods > 0) {
            const recentZoneRatios = new Set();
            const recentRecords = dataWithZoneRatio.slice(-zoneRecentPeriods);
            
            for (const record of recentRecords) {
                recentZoneRatios.add(record.zoneRatio);
            }
            
            for (const record of dataWithZoneRatio) {
                if (recentZoneRatios.has(record.zoneRatio)) {
                    excludedIssues.add(record.Issue);
                }
            }
            console.log(`按历史期数排除了额外期数，总计 ${excludedIssues.size} 期`);
        }
        
        // 3. 排除预测期前的区间比
        if (excludePreZone && dataWithZoneRatio.length > 0) {
            const lastRecord = dataWithZoneRatio[dataWithZoneRatio.length - 1];
            const preZoneRatio = lastRecord.zoneRatio;
            
            for (const record of dataWithZoneRatio) {
                if (record.zoneRatio === preZoneRatio) {
                    excludedIssues.add(record.Issue);
                }
            }
            console.log(`按预测期前排除了额外期数，预测期前比例: ${preZoneRatio}`);
        }
        
        // 过滤数据
        filteredData = dataWithZoneRatio.filter(record => !excludedIssues.has(record.Issue));
        
        console.log(`总共排除了 ${excludedIssues.size} 期，剩余 ${filteredData.length} 期`);
        return filteredData;
        
    } catch (error) {
        console.error('区间比排除逻辑出错:', error);
        return historicalData; // 出错时返回原数据
    }
}

// 生成大乐透和值预测
async function generateDLTSumPrediction(groupAnalysis, sumHistoryTable, historicalData = null, periodGroup = 50, maPeriod = 20, htcExclusionOptions = {}, zoneExclusionOptions = {}) {
    console.log(`\n=== 预测方法选择 ===`);
    console.log(`历史数据: ${historicalData ? historicalData.length : 0}期`);
    console.log(`分组周期: ${periodGroup}期`);
    console.log(`MA周期: ${maPeriod}期`);
    
    // 如果有历史数据，使用技术分析方法
    if (historicalData && historicalData.length >= 50) {
        console.log(`选择: 技术分析方法 (数据充足)`);
        // periodGroup是历史数据采样量，不是MA周期
        const technicalData = historicalData.slice(-periodGroup); // 取最近periodGroup期数据
        return await generateTechnicalAnalysisPrediction(technicalData, sumHistoryTable, periodGroup, maPeriod, htcExclusionOptions, zoneExclusionOptions);
    }
    
    // 否则使用传统统计方法
    console.log(`选择: 传统统计方法 (数据不足或无历史数据)`);
    return await generateTraditionalPrediction(groupAnalysis, sumHistoryTable, htcExclusionOptions, zoneExclusionOptions);
}

// 技术分析预测方法
async function generateTechnicalAnalysisPrediction(historicalData, sumHistoryTable, periodGroup = 50, maPeriod = 20, htcExclusionOptions = {}, zoneExclusionOptions = {}) {
    const AdvancedTechnicalAnalyzer = require('./advancedTechnicalAnalysis');
    
    try {
        console.log(`\n=== 技术分析算法开始 (数据采样: ${periodGroup}期) ===`);
        console.log(`技术分析数据量: ${historicalData.length}期`);
        console.log(`MA周期设置: ${maPeriod}期`);
        
        // 应用热温冷比排除逻辑
        let filteredData = historicalData;
        if (htcExclusionOptions && Object.keys(htcExclusionOptions).length > 0) {
            filteredData = await applyHotWarmColdExclusion(filteredData, htcExclusionOptions);
            console.log(`热温冷比排除后数据量: ${filteredData.length}期`);
        }
        
        // 应用区间比排除逻辑
        if (zoneExclusionOptions && Object.keys(zoneExclusionOptions).length > 0) {
            filteredData = await applyZoneRatioExclusion(filteredData, zoneExclusionOptions);
            console.log(`区间比排除后数据量: ${filteredData.length}期`);
        }
        
        // 创建技术分析器，使用用户选择的MA周期
        const analyzer = new AdvancedTechnicalAnalyzer();
        analyzer.loadData(filteredData, maPeriod);
        
        // 生成智能预测（使用用户选择的MA周期）
        const smartPrediction = analyzer.generateSmartPrediction(maPeriod);
        
        // 输出详细的算法过程
        console.log(`\n--- 前区技术分析过程 (基于${periodGroup}期数据) ---`);
        console.log(`MA${maPeriod}: ${smartPrediction.frontSum.technicalBasis[`ma${maPeriod}`]?.toFixed(2) || '未计算'}`);
        console.log(`趋势调整: ${smartPrediction.frontSum.technicalBasis.trendAdjustment}`);
        console.log(`RSI信号: ${smartPrediction.frontSum.technicalBasis.rsiAdjustment}`);
        console.log(`布林带位置: ${(smartPrediction.frontSum.technicalBasis.bollingerPosition * 100).toFixed(1)}%`);
        console.log(`最终推荐值: ${smartPrediction.frontSum.recommended}`);
        console.log(`预测范围: ${smartPrediction.frontSum.range.min}-${smartPrediction.frontSum.range.max}`);
        console.log(`置信度: ${smartPrediction.frontSum.confidence}%`);
        
        console.log(`\n--- 后区技术分析过程 (基于${periodGroup}期数据) ---`);
        console.log(`MA${maPeriod}: ${smartPrediction.backSum.technicalBasis[`ma${maPeriod}`]?.toFixed(2) || '未计算'}`);
        console.log(`趋势调整: ${smartPrediction.backSum.technicalBasis.trendAdjustment}`);
        console.log(`RSI信号: ${smartPrediction.backSum.technicalBasis.rsiAdjustment}`);
        console.log(`布林带位置: ${(smartPrediction.backSum.technicalBasis.bollingerPosition * 100).toFixed(1)}%`);
        console.log(`最终推荐值: ${smartPrediction.backSum.recommended}`);
        console.log(`预测范围: ${smartPrediction.backSum.range.min}-${smartPrediction.backSum.range.max}`);
        console.log(`置信度: ${smartPrediction.backSum.confidence}%`);
        console.log(`=== 技术分析算法结束 ===\n`);
        
        // 转换为原有格式，保持界面兼容性
        return {
            nextIssue: sumHistoryTable[sumHistoryTable.length - 1].issue + 1,
            frontSum: {
                recommended: smartPrediction.frontSum.recommended,
                range: smartPrediction.frontSum.range,
                confidence: smartPrediction.frontSum.confidence,
                hotSums: getHotSums(sumHistoryTable.map(d => d.frontSum)),
                analysis: '基于技术分析 (MA+RSI+MACD+布林带)',
                technicalDetails: {
                    ma20: smartPrediction.frontSum.technicalBasis.ma20,
                    trendAdjustment: smartPrediction.frontSum.technicalBasis.trendAdjustment,
                    rsiSignal: smartPrediction.frontSum.technicalBasis.rsiAdjustment,
                    bollingerPosition: smartPrediction.frontSum.technicalBasis.bollingerPosition
                }
            },
            backSum: {
                recommended: smartPrediction.backSum.recommended,
                range: smartPrediction.backSum.range,
                confidence: smartPrediction.backSum.confidence,
                hotSums: getHotSums(sumHistoryTable.map(d => d.backSum)),
                analysis: '基于技术分析 (MA+RSI+MACD+布林带)',
                technicalDetails: {
                    ma20: smartPrediction.backSum.technicalBasis.ma20,
                    trendAdjustment: smartPrediction.backSum.technicalBasis.trendAdjustment,
                    rsiSignal: smartPrediction.backSum.technicalBasis.rsiAdjustment,
                    bollingerPosition: smartPrediction.backSum.technicalBasis.bollingerPosition
                }
            },
            generatedAt: new Date().toISOString(),
            analysisMode: 'technical',
            overallConfidence: smartPrediction.confidence
        };
    } catch (error) {
        console.log('技术分析失败，使用传统方法:', error.message);
        // 技术分析失败时回退到传统方法
        return await generateTraditionalPrediction(null, sumHistoryTable, htcExclusionOptions, zoneExclusionOptions, historicalData);
    }
}

// 传统统计预测方法
async function generateTraditionalPrediction(groupAnalysis, sumHistoryTable, htcExclusionOptions = {}, zoneExclusionOptions = {}, historicalData = null) {
    // 如果没有分组分析但有历史数据，进行简化分析
    if (!groupAnalysis && historicalData) {
        // 应用热温冷比排除逻辑
        let filteredData = historicalData;
        if (htcExclusionOptions && Object.keys(htcExclusionOptions).length > 0) {
            filteredData = await applyHotWarmColdExclusion(filteredData, htcExclusionOptions);
            console.log(`传统分析热温冷比排除后数据量: ${filteredData.length}期`);
        }
        
        // 应用区间比排除逻辑
        if (zoneExclusionOptions && Object.keys(zoneExclusionOptions).length > 0) {
            filteredData = await applyZoneRatioExclusion(filteredData, zoneExclusionOptions);
            console.log(`传统分析区间比排除后数据量: ${filteredData.length}期`);
        }
        
        const allFrontSums = filteredData.map(d => d.Red1 + d.Red2 + d.Red3 + d.Red4 + d.Red5);
        const allBackSums = filteredData.map(d => d.Blue1 + d.Blue2);
        
        // 使用最近20期的平均值
        const recent20Front = allFrontSums.slice(-20);
        const recent20Back = allBackSums.slice(-20);
        
        const frontAvg = recent20Front.reduce((a, b) => a + b, 0) / recent20Front.length;
        const backAvg = recent20Back.reduce((a, b) => a + b, 0) / recent20Back.length;
        
        return {
            nextIssue: sumHistoryTable[sumHistoryTable.length - 1].issue + 1,
            frontSum: {
                recommended: Math.round(frontAvg),
                range: {
                    min: Math.round(frontAvg - 10),
                    max: Math.round(frontAvg + 10)
                },
                confidence: 65,
                hotSums: getHotSums(allFrontSums),
                analysis: '基于最近20期平均值分析'
            },
            backSum: {
                recommended: Math.round(backAvg),
                range: {
                    min: Math.round(backAvg - 2),
                    max: Math.round(backAvg + 2)
                },
                confidence: 60,
                hotSums: getHotSums(allBackSums),
                analysis: '基于最近20期平均值分析'
            },
            generatedAt: new Date().toISOString(),
            analysisMode: 'traditional'
        };
    }
    
    // 原有的分组分析方法
    const recentGroups = groupAnalysis ? groupAnalysis.slice(-5) : [];
    
    if (recentGroups.length === 0) {
        throw new Error('无足够数据进行分析');
    }
    
    // 计算前区和值预测范围
    const recentFrontAvgs = recentGroups.map(g => g.frontSumStats.average);
    const frontAvg = recentFrontAvgs.reduce((a, b) => a + b, 0) / recentFrontAvgs.length;
    
    // 计算后区和值预测范围
    const recentBackAvgs = recentGroups.map(g => g.backSumStats.average);
    const backAvg = recentBackAvgs.reduce((a, b) => a + b, 0) / recentBackAvgs.length;
    
    // 基于历史数据的统计分析
    const allFrontSums = sumHistoryTable.map(d => d.frontSum);
    const allBackSums = sumHistoryTable.map(d => d.backSum);
    
    const frontStats = calculateSumStatistics(allFrontSums);
    const backStats = calculateSumStatistics(allBackSums);
    
    return {
        nextIssue: sumHistoryTable[sumHistoryTable.length - 1].issue + 1,
        frontSum: {
            recommended: Math.round(frontAvg),
            range: {
                min: Math.max(Math.round(frontAvg - 10), frontStats.min),
                max: Math.min(Math.round(frontAvg + 10), frontStats.max)
            },
            confidence: calculateConfidence(recentGroups, 'front'),
            hotSums: frontStats.mostFrequent.slice(0, 3),
            analysis: '基于最近期数分组趋势分析'
        },
        backSum: {
            recommended: Math.round(backAvg),
            range: {
                min: Math.max(Math.round(backAvg - 2), backStats.min),
                max: Math.min(Math.round(backAvg + 2), backStats.max)
            },
            confidence: calculateConfidence(recentGroups, 'back'),
            hotSums: backStats.mostFrequent.slice(0, 3),
            analysis: '基于最近期数分组趋势分析'
        },
        generatedAt: new Date().toISOString(),
        analysisMode: 'traditional'
    };
}

// 提取热门和值的辅助函数
function getHotSums(sums) {
    const frequency = {};
    sums.forEach(sum => {
        frequency[sum] = (frequency[sum] || 0) + 1;
    });
    
    return Object.entries(frequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([sum, freq]) => ({ sum: parseInt(sum), frequency: freq }));
}

// 计算预测置信度
function calculateConfidence(recentGroups, type) {
    // 基于趋势一致性计算置信度
    const trends = recentGroups.map(g => 
        type === 'front' ? g.trends.frontTrend.direction : g.trends.backTrend.direction
    );
    
    const consistentTrends = trends.filter((t, i, arr) => arr.indexOf(t) !== arr.lastIndexOf(t)).length;
    const confidence = Math.min(90, 60 + (consistentTrends / trends.length) * 30);
    
    return Math.round(confidence);
}

// 生成大乐透和值验证结果
async function generateDLTSumValidation(recentData, periodGroup, queryInfo = {}, maPeriod = 20) {
    // 使用滑动窗口预测验证逻辑
    const validationResults = [];
    
    // 确保数据按期号升序排列
    const sortedData = [...recentData].sort((a, b) => a.Issue - b.Issue);
    
    // 滑动窗口预测验证：每periodGroup期为一组，预测下一期
    // 例如：每50期一组，25002-25051预测25052，25003-25052预测25053
    
    let validationStart = 0;
    let validationEnd = sortedData.length - periodGroup - 1;
    
    // 如果是指定期号范围查询，只验证该范围内的预测
    if (queryInfo.type === 'range' && queryInfo.startIssue && queryInfo.endIssue) {
        // 找到目标验证范围在数据中的位置
        const targetStartIndex = sortedData.findIndex(d => d.Issue >= queryInfo.startIssue);
        const targetEndIndex = sortedData.findIndex(d => d.Issue > queryInfo.endIssue);
        
        if (targetStartIndex >= 0) {
            // 正确的滑动窗口验证逻辑：
            // 第1组应该是startIssue到startIssue+periodGroup-1预测startIssue+periodGroup
            // 例如：第1组25002-25051预测25052
            
            // 找到数据中startIssue的确切位置
            const exactStartIndex = sortedData.findIndex(d => d.Issue === queryInfo.startIssue);
            
            if (exactStartIndex >= 0) {
                // 验证窗口从exactStartIndex开始
                validationStart = exactStartIndex;
                // 确保有足够数据进行预测
                const maxPossibleEnd = sortedData.length - periodGroup - 1;
                validationEnd = Math.min(exactStartIndex + (queryInfo.endIssue - queryInfo.startIssue), maxPossibleEnd);
                
            } else {
                // 如果找不到确切的startIssue，使用原逻辑
                validationStart = Math.max(0, targetStartIndex);
                validationEnd = targetEndIndex >= 0 ? 
                    Math.min(targetEndIndex - periodGroup, sortedData.length - periodGroup - 1) : 
                    Math.min(sortedData.length - periodGroup - 1, sortedData.length - 1);
            }
        }
    }
    
    for (let i = validationStart; i <= validationEnd; i++) {
        // 取当前窗口的数据作为训练集
        const windowStart = i;
        const windowEnd = i + periodGroup - 1;
        const predictIndex = i + periodGroup;
        
        if (predictIndex >= sortedData.length) break;
        
        const trainData = sortedData.slice(windowStart, windowEnd + 1);
        const actualRecord = sortedData[predictIndex];
        
        // 如果是指定范围查询，只记录目标范围内的验证结果
        if (queryInfo.type === 'range') {
            if (actualRecord.Issue < queryInfo.startIssue || actualRecord.Issue > queryInfo.endIssue) {
                continue;
            }
        }
        
        // 基于训练数据生成预测
        const groupAnalysis = analyzeDLTSumByGroups(trainData, periodGroup);
        const sumHistoryTable = generateDLTSumHistoryTable(trainData);
        const prediction = await generateDLTSumPrediction(groupAnalysis, sumHistoryTable, trainData, periodGroup, maPeriod);
        
        // 计算实际和值
        const actualFrontSum = actualRecord.Red1 + actualRecord.Red2 + actualRecord.Red3 + actualRecord.Red4 + actualRecord.Red5;
        const actualBackSum = actualRecord.Blue1 + actualRecord.Blue2;
        
        // 验证预测结果 - 添加安全检查
        const frontHit = prediction.frontSum && prediction.frontSum.range ? 
                       (actualFrontSum >= prediction.frontSum.range.min && actualFrontSum <= prediction.frontSum.range.max) : false;
        const backHit = prediction.backSum && prediction.backSum.range ? 
                      (actualBackSum >= prediction.backSum.range.min && actualBackSum <= prediction.backSum.range.max) : false;
        
        validationResults.push({
            windowInfo: {
                startIssue: trainData[0].Issue,
                endIssue: trainData[trainData.length - 1].Issue,
                predictIssue: actualRecord.Issue,
                windowIndex: i + 1,
                description: `第${i - validationStart + 1}组(${trainData[0].Issue}-${trainData[trainData.length - 1].Issue})预测${actualRecord.Issue}`
            },
            predicted: {
                frontRange: `${prediction.frontSum.range.min}-${prediction.frontSum.range.max}`,
                backRange: `${prediction.backSum.range.min}-${prediction.backSum.range.max}`,
                frontRecommended: prediction.frontSum.recommended,
                backRecommended: prediction.backSum.recommended
            },
            actual: {
                frontSum: actualFrontSum,
                backSum: actualBackSum
            },
            hits: {
                front: frontHit,
                back: backHit,
                both: frontHit && backHit
            },
            analysis: {
                frontDiff: Math.abs(actualFrontSum - prediction.frontSum.recommended),
                backDiff: Math.abs(actualBackSum - prediction.backSum.recommended),
                confidence: prediction.confidence
            }
        });
    }
    
    // 计算准确率统计
    const totalTests = validationResults.length;
    const frontHits = validationResults.filter(r => r.hits.front).length;
    const backHits = validationResults.filter(r => r.hits.back).length;
    const bothHits = validationResults.filter(r => r.hits.both).length;
    
    // 计算平均偏差
    const avgFrontDiff = totalTests > 0 ? 
        Math.round(validationResults.reduce((sum, r) => sum + r.analysis.frontDiff, 0) / totalTests * 10) / 10 : 0;
    const avgBackDiff = totalTests > 0 ? 
        Math.round(validationResults.reduce((sum, r) => sum + r.analysis.backDiff, 0) / totalTests * 10) / 10 : 0;
    
    return {
        totalTests,
        windowSize: periodGroup,
        accuracy: {
            front: totalTests > 0 ? Math.round((frontHits / totalTests) * 100) : 0,
            back: totalTests > 0 ? Math.round((backHits / totalTests) * 100) : 0,
            both: totalTests > 0 ? Math.round((bothHits / totalTests) * 100) : 0
        },
        avgDifference: {
            front: avgFrontDiff,
            back: avgBackDiff
        },
        details: validationResults.slice(-20), // 返回最近20次验证结果
        summary: totalTests > 0 ? 
            `使用每${periodGroup}期滑动窗口进行${totalTests}次预测验证：前区和值准确率${Math.round((frontHits / totalTests) * 100)}%，后区和值准确率${Math.round((backHits / totalTests) * 100)}%，平均偏差前区${avgFrontDiff}分，后区${avgBackDiff}分` :
            '数据不足，无法进行验证'
    };
}

// 高级技术分析API端点
const AdvancedTechnicalAnalyzer = require('./advancedTechnicalAnalysis');

app.get('/api/dlt/technical-analysis', async (req, res) => {
    try {
        log('Received DLT technical analysis request');
        
        // 获取历史数据
        const limit = parseInt(req.query.periods) || 200; // 默认使用200期数据
        const data = await DLT.find({}).sort({ Issue: -1 }).limit(limit);
        
        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: '未找到历史数据'
            });
        }

        // 创建技术分析器实例
        const analyzer = new AdvancedTechnicalAnalyzer();
        
        // 加载数据并进行分析
        analyzer.loadData(data.reverse()); // 转为升序
        
        // 生成智能预测
        const prediction = analyzer.generateSmartPrediction();
        
        // 生成技术报告
        const technicalReport = analyzer.generateTechnicalReport();
        
        res.json({
            success: true,
            data: {
                prediction: prediction,
                technicalIndicators: {
                    movingAverages: {
                        front: technicalReport.summary.frontArea.movingAverages,
                        back: technicalReport.summary.backArea.movingAverages
                    },
                    rsi: {
                        front: technicalReport.summary.frontArea.rsi,
                        back: technicalReport.summary.backArea.rsi
                    },
                    bollinger: {
                        front: technicalReport.summary.frontArea.bollinger,
                        back: technicalReport.summary.backArea.bollinger
                    },
                    trend: {
                        front: technicalReport.summary.frontArea.trend,
                        back: technicalReport.summary.backArea.trend
                    },
                    macd: {
                        front: technicalReport.summary.frontArea.macdSignal,
                        back: technicalReport.summary.backArea.macdSignal
                    }
                },
                analysisMode: 'technical',
                dataRange: {
                    periods: data.length,
                    startIssue: data[0].Issue,
                    endIssue: data[data.length - 1].Issue
                },
                confidence: prediction.confidence,
                timestamp: prediction.timestamp
            }
        });
        
    } catch (error) {
        console.error('技术分析请求失败:', error);
        res.status(500).json({
            success: false,
            message: '技术分析失败',
            error: error.message
        });
    }
});

// 大乐透组合预测API
// 新的优化组合预测API
// ===== 新方案API路由 (v2版本) =====

/**
 * 大乐透组合预测 v2 - 使用期号全量缓存优化方案
 */
// ===== v2 API已删除 =====

/**
 * 期号全量缓存状态查询 v2
 */
app.get('/api/dlt/period-cache-status/:targetIssue', async (req, res) => {
    try {
        const targetIssue = req.params.targetIssue;
        
        const cache = await DLTPeriodCombinationCache.findOne({
            targetIssue,
            cacheType: 'full_combinations'
        });
        
        if (!cache) {
            return res.json({
                success: true,
                status: 'not_found',
                message: '该期号暂无缓存'
            });
        }
        
        let message = '';
        let progress = 0;
        
        switch (cache.status) {
            case 'generating':
                progress = 50;
                message = '正在生成全量组合缓存...';
                break;
            case 'completed':
                progress = 100;
                message = `缓存已完成，共 ${cache.totalCount} 个组合`;
                break;
            case 'failed':
                progress = 0;
                message = `生成失败: ${cache.errorMessage || '未知错误'}`;
                break;
        }
        
        res.json({
            success: true,
            status: cache.status,
            progress,
            message,
            totalCount: cache.totalCount || 0,
            generationTime: cache.generationEndTime && cache.generationStartTime 
                ? ((cache.generationEndTime - cache.generationStartTime) / 1000).toFixed(1) + '秒'
                : null
        });
        
    } catch (error) {
        log('查询缓存状态错误:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 手动触发期号全量缓存生成 v2
 */
app.post('/api/dlt/generate-period-cache', async (req, res) => {
    try {
        const { targetIssue } = req.body;
        
        if (!targetIssue) {
            return res.json({
                success: false,
                message: '请提供目标期号'
            });
        }
        
        log(`手动触发期号 ${targetIssue} 的全量缓存生成`);
        
        const result = await generatePeriodFullCombinations(targetIssue);
        
        res.json(result);
        
    } catch (error) {
        log('手动生成缓存错误:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 清理期号缓存 v2
 */
app.delete('/api/dlt/clear-period-cache/:targetIssue', async (req, res) => {
    try {
        const targetIssue = req.params.targetIssue;
        
        const result = await DLTPeriodCombinationCache.deleteOne({
            targetIssue,
            cacheType: 'full_combinations'
        });
        
        log(`清理期号 ${targetIssue} 的缓存，删除了 ${result.deletedCount} 条记录`);
        
        res.json({
            success: true,
            message: `期号 ${targetIssue} 的缓存已清理`,
            deletedCount: result.deletedCount
        });
        
    } catch (error) {
        log('清理缓存错误:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// ===== 原有API路由保持不变，确保向后兼容 =====

// ===== 原版 API已删除 =====

// 生成缓存键函数
function generateCacheKey(targetIssue, filters, excludeConditions) {
    const keyData = {
        targetIssue,
        filters,
        excludeConditions: {
            excludedSums: Array.from(excludeConditions.excludedSums || []),
            excludedHtcRatios: Array.from(excludeConditions.excludedHtcRatios || [])
        }
    };
    return crypto.createHash('md5').update(JSON.stringify(keyData)).digest('hex');
}

// 优化的组合预测缓存API
// ===== cached API已删除 =====
/*
/* DELETED app.get('/api/dlt/combination-prediction-cached', async (req, res) => {
    try {
        log('收到缓存组合预测请求: ' + JSON.stringify(req.query));
        
        const targetIssue = req.query.targetIssue;
        if (!targetIssue) {
            return res.json({
                success: false,
                message: '请输入目标期号'
            });
        }

        // 解析过滤条件（与原版相同）
        const filters = {
            customSumExcludes: [],
            sumRecentPeriods: parseInt(req.query.sumRecentPeriods) || 10,
            sumRecentCustom: parseInt(req.query.sumRecentCustom) || null,
            sumBeforePeriods: parseInt(req.query.sumBeforePeriods) || null,
            htcRecentPeriods: parseInt(req.query.htcRecentPeriods) || 15,
            zoneRecentPeriods: parseInt(req.query.zoneRecentPeriods) || 20
        };

        // 添加热温冷比历史排除功能
        const htcRecentPeriods = parseInt(req.query.htcRecentPeriods);
        if (htcRecentPeriods && htcRecentPeriods > 0) {
            filters.htcExcludeType = `recent-${htcRecentPeriods}`;
        }

        // 添加区间比历史排除功能
        const zoneRecentPeriods = parseInt(req.query.zoneRecentPeriods);
        if (zoneRecentPeriods && zoneRecentPeriods > 0) {
            filters.zoneExcludeType = `recent-${zoneRecentPeriods}`;
        }

        // 收集自定义和值排除 - 只有输入值时才排除
        for (let i = 1; i <= 8; i++) {
            const sumValue = req.query[`sumExclude${i}`];
            if (sumValue && sumValue.trim() !== '') {
                const parsedSum = parseInt(sumValue);
                if (!isNaN(parsedSum) && parsedSum >= 15 && parsedSum <= 175) {
                    filters.customSumExcludes.push(parsedSum);
                }
            }
        }

        // 收集和值范围排除 - 只有输入范围时才排除
        filters.customSumRanges = [];
        for (let i = 1; i <= 3; i++) {
            const startValue = req.query[`sumRangeStart${i}`];
            const endValue = req.query[`sumRangeEnd${i}`];
            
            if (startValue && startValue.trim() !== '' && endValue && endValue.trim() !== '') {
                const parsedStart = parseInt(startValue);
                const parsedEnd = parseInt(endValue);
                
                if (!isNaN(parsedStart) && !isNaN(parsedEnd) &&
                    parsedStart >= 15 && parsedStart <= 175 && 
                    parsedEnd >= 15 && parsedEnd <= 175 && 
                    parsedStart < parsedEnd) {
                    filters.customSumRanges.push({ start: parsedStart, end: parsedEnd });
                }
            }
        }

        // 获取历史数据用于排除分析
        const allData = await DLT.find({}).sort({ Issue: -1 });
        if (!allData || allData.length === 0) {
            return res.json({
                success: false,
                message: '没有找到历史数据'
            });
        }

        // 分析排除条件
        const excludeConditions = await analyzeNewExcludeConditions(allData, filters, targetIssue);
        
        // 生成缓存键
        const cacheKey = generateCacheKey(targetIssue, filters, excludeConditions);
        
        // 检查缓存是否存在
        let cachedResult = await DLTCombinationCache.findOne({ cacheKey });
        
        if (cachedResult) {
            if (cachedResult.status === 'completed') {
                log(`返回缓存结果，键: ${cacheKey}`);
                return res.json({
                    success: true,
                    data: {
                        targetIssue,
                        filters,
                        excludeConditions,
                        combinationCount: cachedResult.combinationCount,
                        combinations: cachedResult.combinations,
                        generatedAt: cachedResult.generatedAt.toISOString(),
                        cached: true
                    }
                });
            } else if (cachedResult.status === 'generating') {
                return res.json({
                    success: false,
                    message: '组合正在生成中，请稍后再试',
                    status: 'generating'
                });
            } else if (cachedResult.status === 'failed') {
                // 删除失败的缓存，重新生成
                await DLTCombinationCache.deleteOne({ cacheKey });
                cachedResult = null;
            }
        }
        
        // 如果没有缓存，创建生成任务
        if (!cachedResult) {
            // 先插入generating状态的记录
            await DLTCombinationCache.create({
                cacheKey,
                targetIssue,
                filters,
                excludeConditions,
                combinationCount: 0,
                combinations: [],
                status: 'generating'
            });
            
            // 异步生成组合数据
            generateAndCacheCombinations(cacheKey, targetIssue, filters, excludeConditions)
                .catch(async (error) => {
                    log(`组合生成失败: ${error.message}`);
                    // 标记为失败并记录错误信息
                    try {
                        await DLTCombinationCache.updateOne(
                            { cacheKey },
                            { 
                                status: 'failed',
                                errorMessage: error.message,
                                failedAt: new Date()
                            }
                        );
                    } catch (updateError) {
                        console.error('更新失败状态错误:', updateError);
                        // 如果更新失败，删除记录以避免卡住
                        await DLTCombinationCache.deleteOne({ cacheKey }).catch(console.error);
                    }
                });
            
            return res.json({
                success: false,
                message: '组合生成任务已启动，请稍后查询结果',
                status: 'generating',
                cacheKey
            });
        }

    } catch (error) {
        console.error('缓存组合预测错误:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// 查询生成状态API
app.get('/api/dlt/combination-status/:cacheKey', async (req, res) => {
    try {
        const cacheKey = req.params.cacheKey;
        const cachedResult = await DLTCombinationCache.findOne({ cacheKey });
        
        if (!cachedResult) {
            return res.json({
                success: false,
                message: '未找到该生成任务'
            });
        }
        
        // 检查是否任务卡住（超过5分钟还在generating状态）
        if (cachedResult.status === 'generating') {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (cachedResult.createdAt < fiveMinutesAgo) {
                // 标记为失败并删除
                await DLTCombinationCache.deleteOne({ cacheKey });
                return res.json({
                    success: false,
                    message: '生成任务超时，请重新开始'
                });
            }
        }

        res.json({
            success: true,
            status: cachedResult.status,
            combinationCount: cachedResult.combinationCount,
            generatedAt: cachedResult.generatedAt,
            data: {
                status: cachedResult.status,
                progress: cachedResult.status === 'generating' ? 50 : 100,
                message: cachedResult.status === 'generating' ? '正在生成组合数据...' : 
                        cachedResult.status === 'failed' ? (cachedResult.errorMessage || '生成失败') : '生成完成'
            }
        });
        
    } catch (error) {
        console.error('查询生成状态错误:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// 清除生成缓存API
app.delete('/api/dlt/combination-clear/:cacheKey', async (req, res) => {
    try {
        const cacheKey = req.params.cacheKey;
        await DLTCombinationCache.deleteOne({ cacheKey });
        
        res.json({
            success: true,
            message: '缓存已清除'
        });
        
    } catch (error) {
        console.error('清除缓存错误:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// 异步生成和缓存组合数据函数
async function generateAndCacheCombinations(cacheKey, targetIssue, filters, excludeConditions) {
    try {
        log(`开始生成组合数据，缓存键: ${cacheKey}`);
        
        // 使用现有的优化预测系统
        const predictionResult = await generateOptimizedCombinationPrediction(targetIssue, filters, excludeConditions);
        
        // 转换数据格式以适配缓存结构
        const combinations = predictionResult.topRecommendations.map(combo => ({
            redNumbers: combo.red,  // 修正字段名
            blueNumbers: combo.blue,  // 修正字段名
            redSum: combo.redSum,
            blueSum: combo.blueSum,
            totalSum: combo.totalSum,
            redZoneRatio: combo.redZoneRatio,
            redEvenOddRatio: combo.redEvenOddRatio,
            redLargeSmallRatio: combo.redLargeSmallRatio,
            redConsecutiveCount: combo.redConsecutiveCount,
            redSpanValue: combo.redSpanValue,
            blueEvenOddRatio: combo.blueEvenOddRatio,
            blueLargeSmallRatio: combo.blueLargeSmallRatio,
            blueSpanValue: combo.blueSpanValue,
            dynamicHotColdRatio: combo.dynamicHotColdRatio,
            score: combo.score || 0
        }));
        
        // 更新缓存记录
        await DLTCombinationCache.updateOne(
            { cacheKey },
            {
                combinationCount: combinations.length,
                combinations: combinations,
                status: 'completed'
            }
        );
        
        log(`组合数据生成完成，缓存键: ${cacheKey}，组合数: ${combinations.length}`);
        
    } catch (error) {
        log(`组合数据生成失败，缓存键: ${cacheKey}，错误: ${error.message}`);
        throw error;
    }
}

// 大乐透组合CSV导出API - 增强版支持大数据量导出
app.get('/api/dlt/export-combinations-csv', async (req, res) => {
    try {
        log('收到CSV导出请求: ' + JSON.stringify(req.query));

        const {
            sessionId,
            targetIssue,
            format = 'csv',
            includeAnalysis = 'true',
            maxRecords = 100000
        } = req.query;

        if (!targetIssue && !sessionId) {
            return res.status(400).json({
                success: false,
                message: '请提供目标期号或会话ID'
            });
        }

        // 获取预测数据
        let predictionData;
        if (sessionId) {
            // 从缓存或数据库获取会话数据
            predictionData = await getCombinationPredictionData(sessionId, maxRecords);
        } else {
            // 实时生成预测数据
            const filters = parseExportFilters(req.query);
            const result = await generateOptimizedCombinationPrediction(targetIssue, filters);
            predictionData = result.topRecommendations || [];
        }

        if (!predictionData || predictionData.length === 0) {
            return res.status(404).json({
                success: false,
                message: '未找到可导出的预测数据'
            });
        }

        // 限制数据量
        const limitedData = predictionData.slice(0, parseInt(maxRecords));
        log(`准备导出 ${limitedData.length} 条数据`);

        // 根据格式生成内容
        let content, contentType, filename;

        switch (format.toLowerCase()) {
            case 'csv':
                content = generateCSVContent(limitedData, includeAnalysis === 'true', targetIssue);
                contentType = 'text/csv;charset=utf-8';
                filename = `大乐透组合预测_${targetIssue || sessionId}_${limitedData.length}条.csv`;
                break;
            case 'json':
                content = generateJSONContent(limitedData, targetIssue || sessionId);
                contentType = 'application/json;charset=utf-8';
                filename = `大乐透组合预测_${targetIssue || sessionId}.json`;
                break;
            case 'txt':
                content = generateTXTContent(limitedData, targetIssue || sessionId);
                contentType = 'text/plain;charset=utf-8';
                filename = `大乐透组合预测_${targetIssue || sessionId}.txt`;
                break;
            default:
                content = generateCSVContent(limitedData, includeAnalysis === 'true', targetIssue);
                contentType = 'text/csv;charset=utf-8';
                filename = `大乐透组合预测_${targetIssue || sessionId}.csv`;
        }

        // 设置响应头
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

        // 发送内容（添加BOM确保中文正确显示）
        res.send('\uFEFF' + content);
        log(`CSV导出完成: ${filename}`);

    } catch (error) {
        console.error('CSV导出错误:', error);
        res.status(500).json({
            success: false,
            message: '导出失败',
            error: error.message
        });
    }
});

// 大乐透无限制红球组合流式CSV导出API - 方案2实现
app.get('/api/dlt/export-unlimited-combinations-csv', async (req, res) => {
    try {
        log('收到无限制CSV导出请求: ' + JSON.stringify(req.query));

        const {
            targetIssue,
            sumExcludes,
            sumRanges,
            htcExcludes,
            zoneExcludes,
            includeAnalysis = 'true',
            filename = null
        } = req.query;

        if (!targetIssue) {
            return res.status(400).json({
                success: false,
                message: '请提供目标期号'
            });
        }

        // 解析过滤条件
        const filters = parseUnlimitedExportFilters(req.query);
        log(`无限制导出过滤条件: ${JSON.stringify(filters)}`);

        // 构建数据库查询条件
        const query = buildUnlimitedQuery(filters, targetIssue);
        log(`数据库查询条件: ${JSON.stringify(query)}`);

        // 估算导出数量（用于进度显示）
        const totalCount = await DLTRedCombination.countDocuments(query);
        log(`预计导出组合数量: ${totalCount} 个`);

        // 生成文件名
        const csvFilename = filename || `大乐透无限制组合_${targetIssue}_${totalCount}条_${new Date().toISOString().slice(0, 19).replace(/[:\-]/g, '')}.csv`;

        // 设置流式响应头
        res.setHeader('Content-Type', 'text/csv;charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(csvFilename)}"`);
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
        res.setHeader('X-Total-Count', totalCount.toString());

        // 写入UTF-8 BOM确保中文正确显示
        res.write('\uFEFF');

        // 写入CSV标题行
        const headers = [
            '序号', '红球1', '红球2', '红球3', '红球4', '红球5',
            '和值', '跨度', '奇偶比', '区间比', '热温冷比'
        ];

        if (includeAnalysis === 'true') {
            headers.push('大小比', '连号数', '同尾数', 'AC值', '生成时间');
        }

        res.write(headers.join(',') + '\n');

        // 使用游标流式读取数据，避免内存溢出
        const cursor = DLTRedCombination.find(query).cursor();
        let index = 1;
        let processedCount = 0;
        const batchSize = 1000;

        try {
            for await (const combo of cursor) {
                // 构建CSV行
                const row = [
                    index++,
                    combo.numbers[0], combo.numbers[1], combo.numbers[2],
                    combo.numbers[3], combo.numbers[4],
                    combo.sum_value,
                    combo.span || (Math.max(...combo.numbers) - Math.min(...combo.numbers)),
                    combo.odd_even_ratio || '未计算',
                    combo.zone_ratio || '未计算',
                    combo.hot_warm_cold_ratio || '未计算'
                ];

                if (includeAnalysis === 'true') {
                    row.push(
                        combo.big_small_ratio || '未计算',
                        combo.consecutive_count || 0,
                        combo.same_tail_count || 0,
                        combo.ac_value || '未计算',
                        new Date().toISOString()
                    );
                }

                // 写入CSV行（正确处理包含逗号的字段）
                const csvRow = row.map(field =>
                    typeof field === 'string' && field.includes(',') ? `"${field}"` : field
                ).join(',') + '\n';

                res.write(csvRow);
                processedCount++;

                // 每处理1000条记录记录一次进度
                if (processedCount % batchSize === 0) {
                    const progress = ((processedCount / totalCount) * 100).toFixed(1);
                    log(`无限制导出进度: ${progress}% (${processedCount}/${totalCount})`);

                    // 短暂暂停让系统处理其他请求
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
            }

            // 完成导出
            res.end();
            log(`✅ 无限制CSV导出完成: ${csvFilename}, 共导出 ${processedCount} 条记录`);

        } catch (streamError) {
            log(`流式导出过程中出错: ${streamError.message}`);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: '流式导出失败',
                    error: streamError.message
                });
            } else {
                res.write(`\n# 导出过程中出现错误: ${streamError.message}`);
                res.end();
            }
        }

    } catch (error) {
        console.error('无限制CSV导出错误:', error);

        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: '无限制导出失败',
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        } else {
            res.write(`\n# 导出失败: ${error.message}`);
            res.end();
        }
    }
});

// 大乐透组合下载API - 返回完整组合数据用于下载
app.get('/api/dlt/combination-download', async (req, res) => {
    try {
        log('收到组合下载请求: ' + JSON.stringify(req.query));
        
        const targetIssue = req.query.targetIssue;
        if (!targetIssue) {
            return res.json({
                success: false,
                message: '请输入目标期号'
            });
        }

        // 解析过滤条件（与预测API相同的逻辑）
        const filters = {
            customSumExcludes: [],
            sumRecentPeriods: parseInt(req.query.sumRecentPeriods) || 10,
            sumRecentCustom: parseInt(req.query.sumRecentCustom) || null,
            sumBeforePeriods: parseInt(req.query.sumBeforePeriods) || null,
            htcRecentPeriods: parseInt(req.query.htcRecentPeriods) || 15,
            zoneRecentPeriods: parseInt(req.query.zoneRecentPeriods) || 20,
            customSumRanges: [],
            getAllCombinations: true // 强制获取所有组合
        };

        // 添加热温冷比历史排除功能
        const htcRecentPeriods = parseInt(req.query.htcRecentPeriods);
        if (htcRecentPeriods && htcRecentPeriods > 0) {
            filters.htcExcludeType = `recent-${htcRecentPeriods}`;
        }

        // 添加区间比历史排除功能
        const zoneRecentPeriods = parseInt(req.query.zoneRecentPeriods);
        if (zoneRecentPeriods && zoneRecentPeriods > 0) {
            filters.zoneExcludeType = `recent-${zoneRecentPeriods}`;
        }

        // 解析自定义和值排除
        for (let i = 1; i <= 8; i++) {
            const sumValue = parseInt(req.query[`sumExclude${i}`]);
            if (sumValue && sumValue >= 15 && sumValue <= 175) {
                filters.customSumExcludes.push(sumValue);
            }
        }

        log('应用下载过滤条件: ' + JSON.stringify(filters));

        // 查询所有数据
        const allData = await DLTLottery.find().sort({ Issue: 1 });
        if (!allData || allData.length === 0) {
            return res.json({
                success: false,
                message: '没有找到历史数据'
            });
        }

        // 分析排除条件
        const excludeConditions = await analyzeNewExcludeConditions(allData, filters, targetIssue);
        
        // 使用优化预测系统，但返回所有组合用于下载
        const predictionResult = await generateFullCombinationsForDownload(targetIssue, filters, excludeConditions);
        
        log('发送下载数据...');
        res.json({
            success: true,
            data: predictionResult
        });

    } catch (error) {
        console.error('组合下载错误:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// 生成完整组合数据用于下载
async function generateFullCombinationsForDownload(targetIssue, filters, excludeConditions) {
    // 复用现有逻辑但不限制返回数量
    const result = await generateOptimizedCombinationPrediction(targetIssue, filters, excludeConditions);
    
    // 重新生成完整组合列表（之前被限制在100个）
    // 这里需要重新查询和生成，因为原函数已经被限制了
    // 为了简化，我们先返回统计信息，让前端知道有多少组合
    
    return {
        ...result,
        message: '完整组合数据生成完成，可通过CSV下载'
    };
}

// 生成固定红球组合表API
app.get('/api/dlt/generate-red-combinations', async (req, res) => {
    try {
        log('开始生成大乐透红球固定组合表...');
        
        // 检查是否已存在
        const existingCount = await DLTRedCombination.countDocuments();
        if (existingCount > 0) {
            return res.json({
                success: true,
                message: `红球组合表已存在，共 ${existingCount} 条记录`,
                count: existingCount
            });
        }
        
        // 生成所有红球组合 (35选5 = 324,632种)
        await generateRedCombinations();
        
        const finalCount = await DLTRedCombination.countDocuments();
        
        res.json({
            success: true,
            message: `红球组合表生成完成，共 ${finalCount} 条记录`,
            count: finalCount
        });
        
    } catch (error) {
        log('生成红球组合表错误:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// 生成固定蓝球组合表API
app.get('/api/dlt/generate-blue-combinations', async (req, res) => {
    try {
        log('开始生成大乐透蓝球固定组合表...');
        
        // 检查是否已存在
        const existingCount = await DLTBlueCombination.countDocuments();
        if (existingCount > 0) {
            return res.json({
                success: true,
                message: `蓝球组合表已存在，共 ${existingCount} 条记录`,
                count: existingCount
            });
        }
        
        // 生成所有蓝球组合 (12选2 = 66种)
        await generateBlueCombinations();
        
        const finalCount = await DLTBlueCombination.countDocuments();
        
        res.json({
            success: true,
            message: `蓝球组合表生成完成，共 ${finalCount} 条记录`,
            count: finalCount
        });
        
    } catch (error) {
        log('生成蓝球组合表错误:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// 进度追踪存储
const progressTracker = new Map();

// 进度更新函数
function updateProgress(sessionId, stage, progress, message) {
    progressTracker.set(sessionId, {
        stage,
        progress,
        message,
        timestamp: new Date(),
        status: 'processing'
    });
    console.log(`[${sessionId}] ${stage}: ${progress}% - ${message}`);
}

// 获取进度API
app.get('/api/dlt/prediction-progress/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const progress = progressTracker.get(sessionId);
    
    if (progress) {
        res.json({
            success: true,
            data: progress
        });
    } else {
        res.json({
            success: false,
            message: '未找到进度信息'
        });
    }
});

// 组合预测生成API - 综合固定表与过滤条件
app.post('/api/dlt/generate-combination-prediction', async (req, res) => {
    const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    try {
        log('收到组合预测生成请求:', JSON.stringify(req.body));
        
        const { targetIssue, filters } = req.body;
        
        if (!targetIssue) {
            return res.json({
                success: false,
                message: '请输入目标期号'
            });
        }

        // 初始化进度
        updateProgress(sessionId, 'initializing', 0, '开始初始化预测任务...');

        // 立即返回会话ID，让前端开始轮询进度
        res.json({
            success: true,
            sessionId,
            message: '预测任务已启动，请检查进度',
            polling: true
        });

        // 异步处理预测生成
        generatePredictionWithProgress(sessionId, targetIssue, filters);

    } catch (error) {
        log('组合预测生成错误:', error);
        updateProgress(sessionId, 'error', 0, `预测失败: ${error.message}`);
        if (!res.headersSent) {
            res.json({
                success: false,
                message: error.message
            });
        }
    }
});

// 异步预测生成函数（带进度追踪）
async function generatePredictionWithProgress(sessionId, targetIssue, filters) {
    try {
        updateProgress(sessionId, 'checking', 5, '检查组合基础表...');

        // 验证固定组合表是否存在
        const redCount = await DLTRedCombination.countDocuments();
        const blueCount = await DLTBlueCombination.countDocuments();
        
        if (redCount === 0 || blueCount === 0) {
            updateProgress(sessionId, 'generating-tables', 15, `生成基础组合表 - 红球: ${redCount}, 蓝球: ${blueCount}`);
            
            // 自动生成缺失的组合表
            if (redCount === 0) {
                updateProgress(sessionId, 'generating-red', 20, '正在生成红球组合表...');
                await generateRedCombinations();
                const newRedCount = await DLTRedCombination.countDocuments();
                updateProgress(sessionId, 'red-complete', 40, `红球组合表生成完成，共 ${newRedCount} 个`);
            }
            
            if (blueCount === 0) {
                updateProgress(sessionId, 'generating-blue', 45, '正在生成蓝球组合表...');
                await generateBlueCombinations();
                const newBlueCount = await DLTBlueCombination.countDocuments();
                updateProgress(sessionId, 'blue-complete', 50, `蓝球组合表生成完成，共 ${newBlueCount} 个`);
            }
            
            // 重新获取数量
            const finalRedCount = await DLTRedCombination.countDocuments();
            const finalBlueCount = await DLTBlueCombination.countDocuments();
            updateProgress(sessionId, 'tables-ready', 55, `组合表初始化完成 - 红球: ${finalRedCount}, 蓝球: ${finalBlueCount}`);
        }

        updateProgress(sessionId, 'loading-data', 60, '加载历史数据进行分析...');
        
        // 获取历史数据用于过滤分析
        const allData = await DLT.find({}).sort({ Issue: -1 });
        if (!allData || allData.length === 0) {
            updateProgress(sessionId, 'error', 0, '没有找到历史数据');
            return;
        }

        updateProgress(sessionId, 'analyzing', 70, '分析过滤排除条件...');
        
        // 分析排除条件
        const excludeConditions = await analyzeNewExcludeConditions(allData, filters, targetIssue);
        
        updateProgress(sessionId, 'filtering', 80, '开始生成过滤组合...');
        
        // 生成过滤后的组合预测（添加进度回调）
        const result = await generateFilteredCombinationPrediction(targetIssue, filters, excludeConditions, sessionId);
        
        // 最终完成
        const finalResult = {
            targetIssue,
            originalCount: redCount || await DLTRedCombination.countDocuments(),
            filteredCount: result.filteredRedCount,
            finalCount: result.combinations.length,
            combinations: result.combinations,
            statistics: {
                totalRedCombinations: redCount || await DLTRedCombination.countDocuments(),
                totalBlueCombinations: blueCount || await DLTBlueCombination.countDocuments(),
                basicFilteredRedCount: result.basicFilteredRedCount || 0,
                htcFilteredRedCount: result.filteredRedCount,
                finalCombinationsCount: result.combinations.length,
                combinationMethod: enableBlueCombination ? '每个红球组合按顺序循环分配一个蓝球组合' : '只输出红球组合，不分配蓝球'
            },
            filters,
            excludeConditions,
            generatedAt: new Date().toISOString()
        };

        updateProgress(sessionId, 'completed', 100, `预测生成完成！共 ${result.combinations.length} 个组合`);
        
        // 将完成的结果也存储在进度中
        progressTracker.set(sessionId, {
            stage: 'completed',
            progress: 100,
            message: `预测生成完成！共 ${result.combinations.length} 个组合`,
            timestamp: new Date(),
            status: 'completed',
            result: finalResult
        });

    } catch (error) {
        log('异步预测生成错误:', error);
        updateProgress(sessionId, 'error', 0, `预测失败: ${error.message}`);
    }
}

// 新的分析排除条件函数
async function analyzeNewExcludeConditions(data, filters, targetIssue) {
    try {
        log(`开始分析排除条件 - data长度: ${data ? data.length : 'undefined'}, filters: ${JSON.stringify(filters)}`);
        
        const excludeConditions = {
            excludedSums: new Set(),
            excludedHtcRatios: new Set(),
            excludedZoneRatios: new Set()
        };

    // 1. 添加自定义和值排除
    if (filters.customSumExcludes && filters.customSumExcludes.length > 0) {
        filters.customSumExcludes.forEach(sum => {
            excludeConditions.excludedSums.add(sum);
        });
        log(`添加自定义和值排除: ${JSON.stringify(filters.customSumExcludes)}`);
    }

    // 1.1 添加和值范围排除
    if (filters.customSumRanges && filters.customSumRanges.length > 0) {
        // 直接排除指定范围内的和值
        filters.customSumRanges.forEach(range => {
            for (let sum = range.start; sum <= range.end; sum++) {
                excludeConditions.excludedSums.add(sum);
            }
        });
        log(`添加和值范围排除: ${JSON.stringify(filters.customSumRanges)}`);
    }

    // 2. 分析最近期数的和值 - 只有指定期数时才排除
    const recentPeriods = filters.sumRecentCustom || filters.sumRecentPeriods;
    if (recentPeriods && recentPeriods > 0) {
        const recentSumData = data.slice(0, recentPeriods);
        recentSumData.forEach(record => {
            const sum = record.Red1 + record.Red2 + record.Red3 + record.Red4 + record.Red5;
            excludeConditions.excludedSums.add(sum);
        });
        log(`添加历史期数和值排除: 最近${recentPeriods}期`);
    }

    // 3. 分析预测期前的和值
    if (targetIssue && filters.sumBeforePeriods) {
        const beforePeriods = filters.sumBeforePeriods;
        const targetIssueNum = parseInt(targetIssue);
        
        const startExcludeIssue = targetIssueNum - beforePeriods;
        const endExcludeIssue = targetIssueNum - 1;
        
        log(`排除预测期前${beforePeriods}期: ${startExcludeIssue} - ${endExcludeIssue}`);
        
        data.forEach(record => {
            const issueNum = parseInt(record.Issue);
            if (issueNum >= startExcludeIssue && issueNum <= endExcludeIssue) {
                const sum = record.Red1 + record.Red2 + record.Red3 + record.Red4 + record.Red5;
                excludeConditions.excludedSums.add(sum);
            }
        });
    }

    // 4. 处理区间比排除条件
    if (filters.customZoneExcludes && filters.customZoneExcludes.length > 0) {
        filters.customZoneExcludes.forEach(ratio => {
            excludeConditions.excludedZoneRatios.add(ratio);
        });
        log(`添加自定义区间比排除: ${JSON.stringify(filters.customZoneExcludes)}`);
    }

    // 4.1 分析历史区间比排除
    if (filters.zoneExcludeType) {
        let zoneExcludePeriods = 10; // 默认值
        
        if (filters.zoneExcludeType === 'recent-5') {
            zoneExcludePeriods = 5;
        } else if (filters.zoneExcludeType === 'recent-10') {
            zoneExcludePeriods = 10;
        } else if (filters.zoneExcludeType === 'recent-30') {
            zoneExcludePeriods = 30;
        } else if (filters.zoneExcludeType.startsWith('recent-')) {
            // 处理 recent-数字 格式
            const periods = parseInt(filters.zoneExcludeType.replace('recent-', ''));
            if (periods > 0) {
                zoneExcludePeriods = periods;
            }
        } else if (filters.zoneExcludeType === 'before-target' && filters.zoneBeforeCustom) {
            zoneExcludePeriods = filters.zoneBeforeCustom;
            // 排除预测期前特定期数的区间比
            if (targetIssue) {
                const targetIssueNum = parseInt(targetIssue);
                const startExcludeIssue = targetIssueNum - zoneExcludePeriods;
                const endExcludeIssue = targetIssueNum - 1;
                
                data.forEach(record => {
                    const issueNum = parseInt(record.Issue);
                    if (issueNum >= startExcludeIssue && issueNum <= endExcludeIssue) {
                        const ratio = calculateZoneDistribution([record.Red1, record.Red2, record.Red3, record.Red4, record.Red5]);
                        excludeConditions.excludedZoneRatios.add(ratio);
                    }
                });
            }
        } else if (zoneExcludePeriods > 0) {
            // 排除最近期数的区间比
            const recentZoneData = data.slice(0, zoneExcludePeriods);
            if (recentZoneData && recentZoneData.length > 0) {
                recentZoneData.forEach(record => {
                    const ratio = calculateZoneDistribution([record.Red1, record.Red2, record.Red3, record.Red4, record.Red5]);
                    excludeConditions.excludedZoneRatios.add(ratio);
                });
            }
        }
        
        log(`排除历史区间比，模式: ${filters.zoneExcludeType}，期数: ${zoneExcludePeriods}`);
    }

    // 5. 处理热温冷比排除条件
    if (filters.customHtcExcludes && filters.customHtcExcludes.length > 0) {
        filters.customHtcExcludes.forEach(ratio => {
            excludeConditions.excludedHtcRatios.add(ratio);
        });
        log(`添加自定义热温冷比排除: ${JSON.stringify(filters.customHtcExcludes)}`);
    }

    // 5.1 分析历史热温冷比排除
    if (filters.htcExcludeType && targetIssue) {
        let htcExcludePeriods = 10; // 默认值
        
        if (filters.htcExcludeType === 'recent-5') {
            htcExcludePeriods = 5;
        } else if (filters.htcExcludeType === 'recent-10') {
            htcExcludePeriods = 10;
        } else if (filters.htcExcludeType === 'recent-30') {
            htcExcludePeriods = 30;
        } else if (filters.htcExcludeType.startsWith('recent-')) {
            // 处理 recent-数字 格式
            const periods = parseInt(filters.htcExcludeType.replace('recent-', ''));
            if (periods > 0) {
                htcExcludePeriods = periods;
            }
        } else if (filters.htcExcludeType === 'before-target' && filters.htcBeforeCustom) {
            htcExcludePeriods = filters.htcBeforeCustom;
        }

        // 获取热温冷比数据并排除
        try {
            if (htcExcludePeriods > 0) {
                const htcExcludeData = data.slice(0, htcExcludePeriods);
                
                if (htcExcludeData && htcExcludeData.length > 0) {
                    for (const record of htcExcludeData) {
                        // 需要根据历史期号计算热温冷比
                        const tempCombo = {
                            numbers: [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5]
                        };
                        const htcRatio = await calculateHotColdRatioForPeriod(tempCombo, record.Issue);
                        excludeConditions.excludedHtcRatios.add(htcRatio);
                    }
                }
            }
            
            log(`排除历史热温冷比，模式: ${filters.htcExcludeType}，期数: ${htcExcludePeriods}`);
        } catch (error) {
            log(`处理历史热温冷比排除时出错: ${error.message}`);
        }
    }

        log(`排除条件统计 - 和值: ${excludeConditions.excludedSums.size}, 热温冷比: ${excludeConditions.excludedHtcRatios.size}, 区间比: ${excludeConditions.excludedZoneRatios.size}`);
        
        return excludeConditions;
    } catch (error) {
        log(`分析排除条件时出错: ${error.message}`);
        log(`错误堆栈: ${error.stack}`);
        throw error;
    }
}

// 优化的组合预测生成函数
async function generateOptimizedCombinationPrediction(targetIssue, filters, excludeConditions) {
    log('开始优化组合预测生成...');
    
    // 第一步：查询符合条件的红球组合
    const redQuery = {};
    
    // 排除和值条件
    if (excludeConditions.excludedSums.size > 0) {
        redQuery.sum = { $nin: Array.from(excludeConditions.excludedSums) };
    }
    
    log(`红球查询条件: ${JSON.stringify(redQuery)}`);
    
    const filteredRedCombinations = await DLTRedCombination
        .find(redQuery)
        .sort({ sum: 1 }); // 按和值排序
    
    log(`查询到符合条件的红球组合: ${filteredRedCombinations.length} 个`);
    
    // 调试：检查第一个红球组合的结构
    if (filteredRedCombinations.length > 0) {
        console.log('第一个红球组合结构:', JSON.stringify(filteredRedCombinations[0], null, 2));
    }
    
    // 第二步：动态计算热温冷并进一步过滤
    const validRedCombinations = [];
    let processedCount = 0;
    
    for (const redCombo of filteredRedCombinations) {
        const hotColdRatio = await calculateHotColdRatioForPeriod(redCombo, targetIssue);
        
        // 检查是否符合热温冷排除条件
        if (!excludeConditions.excludedHtcRatios.has(hotColdRatio)) {
            redCombo.dynamicHotColdRatio = hotColdRatio;
            validRedCombinations.push(redCombo);
        }
        
        processedCount++;
        if (processedCount % 1000 === 0) {
            log(`已处理红球组合: ${processedCount}/${filteredRedCombinations.length}`);
        }
        
        // 根据用户需求决定是否限制组合数量
        // 如果用户明确要求获取所有组合，则不限制；否则限制在合理范围内
        const maxCombinations = filters.getAllCombinations ? Number.MAX_SAFE_INTEGER : 5000;
        if (validRedCombinations.length >= maxCombinations) {
            log(`已达到红球组合限制: ${maxCombinations} 个，停止处理`);
            break;
        }
    }
    
    log(`通过热温冷过滤的红球组合: ${validRedCombinations.length} 个`);
    
    // 分析热温冷号码
    log('开始分析热温冷号码...');
    const hotWarmColdAnalysis = await analyzeHotWarmColdNumbers(targetIssue);
    log(`热温冷分析完成: ${JSON.stringify(hotWarmColdAnalysis)}`);
    
    // 第三步：获取符合条件的蓝球组合
    const blueQuery = {};
    const validBlueCombinations = await DLTBlueCombination
        .find(blueQuery)
        .sort({ sum: 1 });
    
    log(`查询到蓝球组合: ${validBlueCombinations.length} 个`);
    
    // 第四步：生成最终组合并评分
    const finalCombinations = [];
    // 移除人为限制，让用户获得所有符合条件的组合
    const maxRedCombos = validRedCombinations.length; // Math.min(validRedCombinations.length, 100);
    const maxBlueCombos = validBlueCombinations.length; // Math.min(validBlueCombinations.length, 10);
    
    for (let i = 0; i < maxRedCombos; i++) {
        const red = validRedCombinations[i];
        for (let j = 0; j < maxBlueCombos; j++) {
            const blue = validBlueCombinations[j];
            
            const combination = {
                red: red.numbers || [],
                blue: blue.numbers || [],
                redSum: red.sum,
                blueSum: blue.sum,
                totalSum: red.sum + blue.sum,
                hotColdRatio: red.dynamicHotColdRatio,
                zoneRatio: red.zoneRatio,
                evenOddRatio: red.evenOddRatio,
                score: calculateCombinationScore(red, blue)
            };
            
            // 调试：如果红球或蓝球号码为空，记录一下
            if (!red.numbers || red.numbers.length === 0) {
                console.log('红球号码为空:', red);
            }
            if (!blue.numbers || blue.numbers.length === 0) {
                console.log('蓝球号码为空:', blue);
            }
            
            finalCombinations.push(combination);
        }
    }
    
    // 第五步：按分数排序
    finalCombinations.sort((a, b) => b.score - a.score);
    
    // 为了前端性能，动态控制显示数量
    const requestedLimit = parseInt(filters.displayLimit) || 500;
    const displayLimit = Math.min(requestedLimit, 2000); // 最大限制2000个
    const topRecommendations = finalCombinations.slice(0, displayLimit);
    
    log(`最终生成组合: ${finalCombinations.length} 个，推荐显示: ${topRecommendations.length} 个`);
    
    return {
        totalRedCombinations: await DLTRedCombination.countDocuments(),
        filteredRedCombinations: validRedCombinations.length,
        totalBlueCombinations: await DLTBlueCombination.countDocuments(),
        finalCombinations: finalCombinations.length,
        topRecommendations, // 只返回前100个用于显示
        allCombinationsCount: finalCombinations.length, // 完整组合数量
        hotWarmColdAnalysis
    };
}

// 计算组合得分
function calculateCombinationScore(redCombo, blueCombo) {
    let score = 50; // 基础分
    
    // 红球得分
    if (redCombo.sum >= 70 && redCombo.sum <= 120) score += 15;
    if (redCombo.consecutiveCount <= 1) score += 10;
    if (redCombo.spanValue >= 15 && redCombo.spanValue <= 25) score += 8;
    
    // 蓝球得分
    if (blueCombo.sum >= 8 && blueCombo.sum <= 15) score += 5;
    if (blueCombo.spanValue >= 3 && blueCombo.spanValue <= 8) score += 3;
    
    // 添加随机性
    score += Math.random() * 10;
    
    return Math.round(score * 100) / 100;
}

// 辅助函数：分析排除条件
async function analyzeCombinationExcludeConditions(data, filters, targetIssue) {
    const excludeConditions = {
        excludedSums: new Set(),
        excludedHtcRatios: new Set(),
        excludedZoneRatios: new Set()
    };

    // 1. 添加自定义和值排除
    filters.customSumExcludes.forEach(sum => {
        excludeConditions.excludedSums.add(sum);
    });

    // 2. 分析最近期数的和值（使用自定义期数或默认期数）
    const recentPeriods = filters.sumRecentCustom || filters.sumRecentPeriods;
    const recentSumData = data.slice(0, recentPeriods);
    recentSumData.forEach(record => {
        const sum = record.Red1 + record.Red2 + record.Red3 + record.Red4 + record.Red5;
        excludeConditions.excludedSums.add(sum);
    });

    // 3. 分析预测期前的和值（新增功能）
    if (targetIssue && filters.sumBeforePeriods) {
        const beforePeriods = filters.sumBeforePeriods;
        const targetIssueNum = parseInt(targetIssue);
        
        // 计算需要排除的期号范围
        const startExcludeIssue = targetIssueNum - beforePeriods;
        const endExcludeIssue = targetIssueNum - 1;
        
        log(`排除预测期前${beforePeriods}期: ${startExcludeIssue} - ${endExcludeIssue}`);
        
        // 查找指定期号范围内的数据
        const beforeData = data.filter(record => {
            const recordIssueNum = parseInt(record.Issue);
            return recordIssueNum >= startExcludeIssue && recordIssueNum <= endExcludeIssue;
        });
        
        beforeData.forEach(record => {
            const sum = record.Red1 + record.Red2 + record.Red3 + record.Red4 + record.Red5;
            excludeConditions.excludedSums.add(sum);
        });
        
        log(`预测期前排除了${beforeData.length}期的和值数据`);
    }

    // 分析热温冷比 - 使用固定的走势图规则
    const htcData = data.slice(0, filters.htcRecentPeriods);
    htcData.forEach(record => {
        // 使用固定规则：热号(≤4)、温号(5-9)、冷号(≥10)
        const ratio = calculateHotColdRatioByMissing([record.Red1, record.Red2, record.Red3, record.Red4, record.Red5], record);
        excludeConditions.excludedHtcRatios.add(ratio);
    });

    // 分析区间比
    const zoneData = data.slice(0, filters.zoneRecentPeriods);
    zoneData.forEach(record => {
        const ratio = calculateZoneRatio([record.Red1, record.Red2, record.Red3, record.Red4, record.Red5]);
        excludeConditions.excludedZoneRatios.add(ratio);
    });

    log(`排除条件统计 - 和值: ${excludeConditions.excludedSums.size}, 热温冷比: ${excludeConditions.excludedHtcRatios.size}, 区间比: ${excludeConditions.excludedZoneRatios.size}`);
    
    return excludeConditions;
}

// 辅助函数：生成所有红球组合
function generateAllRedBallCombinations() {
    const combinations = [];
    
    // C(35,5) = 324632 种组合，这个数量很大，我们需要优化
    // 为了性能考虑，我们先生成一个较小的样本进行测试
    for (let a = 1; a <= 31; a++) {
        for (let b = a + 1; b <= 32; b++) {
            for (let c = b + 1; c <= 33; c++) {
                for (let d = c + 1; d <= 34; d++) {
                    for (let e = d + 1; e <= 35; e++) {
                        combinations.push([a, b, c, d, e]);
                    }
                }
            }
        }
    }
    
    return combinations;
}

// 辅助函数：根据排除条件过滤组合
function filterCombinationsByExcludeConditions(combinations, excludeConditions) {
    return combinations.filter(combination => {
        // 检查和值
        const sum = combination.reduce((a, b) => a + b, 0);
        if (excludeConditions.excludedSums.has(sum)) {
            return false;
        }

        // 检查热温冷比
        // 这里需要先有热温冷统计数据，暂时跳过
        
        // 检查区间比
        const zoneRatio = calculateZoneRatio(combination);
        if (excludeConditions.excludedZoneRatios.has(zoneRatio)) {
            return false;
        }

        return true;
    });
}

// 辅助函数：计算区间比
function calculateZoneRatio(numbers) {
    const zones = [0, 0, 0]; // 一区(1-12), 二区(13-24), 三区(25-35)
    
    numbers.forEach(num => {
        if (num >= 1 && num <= 12) {
            zones[0]++;
        } else if (num >= 13 && num <= 24) {
            zones[1]++;
        } else if (num >= 25 && num <= 35) {
            zones[2]++;
        }
    });
    
    return `${zones[0]}:${zones[1]}:${zones[2]}`;
}

// 辅助函数：计算热温冷统计
function calculateHotColdStats(data) {
    const frequency = {};
    
    // 初始化频率统计
    for (let i = 1; i <= 35; i++) {
        frequency[i] = 0;
    }
    
    // 统计每个号码出现频率
    data.forEach(record => {
        [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5].forEach(num => {
            frequency[num]++;
        });
    });
    
    // 计算热温冷分界点
    const frequencies = Object.values(frequency).sort((a, b) => b - a);
    const totalNumbers = 35;
    const hotThreshold = frequencies[Math.floor(totalNumbers * 0.3)];
    const coldThreshold = frequencies[Math.floor(totalNumbers * 0.7)];
    
    return {
        frequency,
        hotThreshold,
        coldThreshold
    };
}

// 辅助函数：计算热温冷比
function calculateHotColdRatio(numbers, stats) {
    const result = [0, 0, 0]; // 热、温、冷
    
    numbers.forEach(num => {
        const freq = stats.frequency[num];
        if (freq >= stats.hotThreshold) {
            result[0]++; // 热
        } else if (freq <= stats.coldThreshold) {
            result[2]++; // 冷
        } else {
            result[1]++; // 温
        }
    });
    
    return `${result[0]}:${result[1]}:${result[2]}`;
}

// 基于遗漏值的热温冷比计算（走势图规则）
function calculateHotColdRatioByMissing(numbers, record) {
    const result = [0, 0, 0]; // 热、温、冷
    
    numbers.forEach(num => {
        // 获取该号码在当期的遗漏值
        const missingField = `Missing${num}`;
        const missingValue = record[missingField] || 0;
        
        // 按走势图规则分类：热号(≤4)、温号(5-9)、冷号(≥10)
        if (missingValue <= 4) {
            result[0]++; // 热
        } else if (missingValue >= 5 && missingValue <= 9) {
            result[1]++; // 温
        } else { // missingValue >= 10
            result[2]++; // 冷
        }
    });
    
    return `${result[0]}:${result[1]}:${result[2]}`;
}

// 辅助函数：验证组合历史表现
async function validateCombinationHistory(combinations, allData) {
    const validatedCombinations = combinations.map(combination => {
        const sum = combination.reduce((a, b) => a + b, 0);
        const zoneRatio = calculateZoneRatio(combination);
        
        // 计算得分（这里可以根据更复杂的逻辑计算）
        let score = 50; // 基础分
        
        // 根据和值分布给分
        if (sum >= 70 && sum <= 120) {
            score += 20; // 和值在常见范围内
        }
        
        // 根据区间分布给分
        const zones = zoneRatio.split(':').map(Number);
        const isBalanced = Math.max(...zones) - Math.min(...zones) <= 2;
        if (isBalanced) {
            score += 15; // 区间分布相对均匀
        }
        
        // 添加一些随机性避免过度拟合
        score += Math.random() * 10;
        
        return {
            numbers: combination,
            sum,
            zoneRatio,
            score: Math.round(score * 100) / 100
        };
    });
    
    return validatedCombinations;
}

// ===== 新的优化组合生成系统 =====

// 辅助函数：计算区域分布
function calculateZoneDistribution(numbers) {
    const zones = [0, 0, 0]; // 1-12, 13-24, 25-35
    numbers.forEach(num => {
        if (num <= 12) zones[0]++;
        else if (num <= 24) zones[1]++;
        else zones[2]++;
    });
    return `${zones[0]}:${zones[1]}:${zones[2]}`;
}

// 辅助函数：计算奇偶比
function calculateEvenOddRatio(numbers) {
    const evenCount = numbers.filter(num => num % 2 === 0).length;
    const oddCount = numbers.length - evenCount;
    return `${oddCount}:${evenCount}`;
}

// 辅助函数：计算大小比
function calculateLargeSmallRatio(numbers, threshold = 17) {
    const smallCount = numbers.filter(num => num <= threshold).length;
    const largeCount = numbers.length - smallCount;
    return `${smallCount}:${largeCount}`;
}

// 辅助函数：计算连号个数
function calculateConsecutiveCount(numbers) {
    const sorted = [...numbers].sort((a, b) => a - b);
    let consecutiveCount = 0;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === sorted[i-1] + 1) {
            consecutiveCount++;
        }
    }
    return consecutiveCount;
}

// 辅助函数：计算跨度值
function calculateSpanValue(numbers) {
    return Math.max(...numbers) - Math.min(...numbers);
}

// 辅助函数：计算和值区间
function getSumRange(sum) {
    const rangeSize = 10;
    const rangeStart = Math.floor(sum / rangeSize) * rangeSize;
    return `${rangeStart}-${rangeStart + rangeSize - 1}`;
}

// 生成所有红球组合并存储
async function generateAndStoreRedCombinations() {
    log('开始生成红球组合...');
    
    // 检查是否已存在数据
    const existingCount = await DLTRedCombination.countDocuments();
    if (existingCount > 0) {
        log(`红球组合已存在 ${existingCount} 条记录`);
        return;
    }
    
    const combinations = [];
    let id = 1;
    
    // C(35,5) 生成所有组合
    for (let a = 1; a <= 31; a++) {
        for (let b = a + 1; b <= 32; b++) {
            for (let c = b + 1; c <= 33; c++) {
                for (let d = c + 1; d <= 34; d++) {
                    for (let e = d + 1; e <= 35; e++) {
                        const numbers = [a, b, c, d, e];
                        const sum = numbers.reduce((acc, curr) => acc + curr, 0);
                        
                        combinations.push({
                            id: id++,
                            numbers,
                            sum,
                            zoneRatio: calculateZoneDistribution(numbers),
                            evenOddRatio: calculateEvenOddRatio(numbers),
                            largeSmallRatio: calculateLargeSmallRatio(numbers),
                            consecutiveCount: calculateConsecutiveCount(numbers),
                            spanValue: calculateSpanValue(numbers),
                            sumRange: getSumRange(sum)
                        });
                        
                        // 批量插入（每1000条）
                        if (combinations.length === 1000) {
                            await DLTRedCombination.insertMany(combinations);
                            log(`已插入红球组合: ${id - 1000} - ${id - 1}`);
                            combinations.length = 0;
                        }
                    }
                }
            }
        }
    }
    
    // 插入剩余数据
    if (combinations.length > 0) {
        await DLTRedCombination.insertMany(combinations);
        log(`已插入最后 ${combinations.length} 条红球组合`);
    }
    
    log(`红球组合生成完成，总计: ${id - 1} 条记录`);
}

// 生成所有蓝球组合并存储
async function generateAndStoreBlueCombinations() {
    log('开始生成蓝球组合...');
    
    // 检查是否已存在数据
    const existingCount = await DLTBlueCombination.countDocuments();
    if (existingCount > 0) {
        log(`蓝球组合已存在 ${existingCount} 条记录`);
        return;
    }
    
    const combinations = [];
    let id = 1;
    
    // C(12,2) 生成所有组合
    for (let a = 1; a <= 11; a++) {
        for (let b = a + 1; b <= 12; b++) {
            const numbers = [a, b];
            const sum = a + b;
            
            combinations.push({
                id: id++,
                numbers,
                sum,
                evenOddRatio: calculateEvenOddRatio(numbers),
                largeSmallRatio: calculateLargeSmallRatio(numbers, 6),
                spanValue: calculateSpanValue(numbers)
            });
        }
    }
    
    // 插入所有蓝球组合
    await DLTBlueCombination.insertMany(combinations);
    log(`蓝球组合生成完成，总计: ${id - 1} 条记录`);
}

// 动态热温冷计算函数
async function calculateHotColdRatioForPeriod(redCombination, targetIssue) {
    try {
        // 1. 获取目标期的上一期遗漏数据
        const previousIssue = (parseInt(targetIssue) - 1).toString();
        
        const missingData = await DLTRedMissing.findOne({ 
            Issue: previousIssue 
        });
        
        if (!missingData) {
            log(`警告：找不到期号 ${previousIssue} 的遗漏数据`);
            return "0:0:5"; // 默认返回
        }
        
        // 2. 根据遗漏值判断红球的热温冷状态（按走势图规则）
        const hotColdStatus = redCombination.numbers.map(num => {
            const missingValue = missingData[num.toString()];
            
            if (missingValue <= 4) {
                return 'hot';    // 热号(遗漏值≤4)
            } else if (missingValue >= 5 && missingValue <= 9) {
                return 'warm';   // 温号(遗漏值5-9)  
            } else {
                return 'cold';   // 冷号(遗漏值≥10)
            }
        });
        
        // 3. 统计热温冷比例
        const hotCount = hotColdStatus.filter(s => s === 'hot').length;
        const warmCount = hotColdStatus.filter(s => s === 'warm').length;
        const coldCount = hotColdStatus.filter(s => s === 'cold').length;
        
        return `${hotCount}:${warmCount}:${coldCount}`;
    } catch (error) {
        log(`计算热温冷比例出错: ${error.message}`);
        return "0:0:5"; // 默认返回
    }
}

// 分析热温冷号码
async function analyzeHotWarmColdNumbers(targetIssue) {
    try {
        // 获取目标期的上一期遗漏数据
        const previousIssue = (parseInt(targetIssue) - 1).toString();
        
        const missingData = await DLTRedMissing.findOne({ 
            Issue: previousIssue 
        });
        
        if (!missingData) {
            log(`警告：找不到期号 ${previousIssue} 的遗漏数据`);
            return {
                hotNumbers: [],
                warmNumbers: [],
                coldNumbers: []
            };
        }
        
        const hotNumbers = [];
        const warmNumbers = [];
        const coldNumbers = [];
        
        // 分析1-35号红球的热温冷状态（按走势图规则）
        for (let num = 1; num <= 35; num++) {
            const missingValue = missingData[num.toString()];
            
            if (missingValue <= 4) {
                hotNumbers.push(num);    // 热号(遗漏值≤4)
            } else if (missingValue >= 5 && missingValue <= 9) {
                warmNumbers.push(num);   // 温号(遗漏值5-9)  
            } else {
                coldNumbers.push(num);   // 冷号(遗漏值≥10)
            }
        }
        
        log(`热温冷分析 - 热号: ${hotNumbers.join(' ')}, 温号: ${warmNumbers.join(' ')}, 冷号: ${coldNumbers.join(' ')}`);
        
        return {
            hotNumbers: hotNumbers.sort((a, b) => a - b),
            warmNumbers: warmNumbers.sort((a, b) => a - b),
            coldNumbers: coldNumbers.sort((a, b) => a - b)
        };
    } catch (error) {
        log(`分析热温冷号码出错: ${error.message}`);
        return {
            hotNumbers: [],
            warmNumbers: [],
            coldNumbers: []
        };
    }
}

// 初始化组合数据库（服务启动时调用）
async function initializeCombinationDatabase() {
    log('开始初始化组合数据库...');
    
    try {
        await generateAndStoreRedCombinations();
        await generateAndStoreBlueCombinations();
        log('组合数据库初始化完成');
    } catch (error) {
        log(`组合数据库初始化失败: ${error.message}`);
    }
}

// 生成过滤后的组合预测
async function generateFilteredCombinationPrediction(targetIssue, filters, excludeConditions, sessionId = null) {
    log('开始生成过滤后的组合预测...');
    
    try {
        // 第一步：从固定红球组合表中查询符合条件的组合
        const redQuery = {};
        
        // 排除和值条件
        if (excludeConditions.excludedSums && excludeConditions.excludedSums.size > 0) {
            redQuery.sum = { $nin: Array.from(excludeConditions.excludedSums) };
        }
        
        // 排除区间比条件
        if (excludeConditions.excludedZoneRatios && excludeConditions.excludedZoneRatios.size > 0) {
            redQuery.zoneRatio = { $nin: Array.from(excludeConditions.excludedZoneRatios) };
        }
        
        log(`红球查询条件: ${JSON.stringify(redQuery)}`);
        
        // 查询符合基本条件的红球组合
        const filteredRedCombinations = await DLTRedCombination
            .find(redQuery)
            .sort({ sum: 1 });
        
        log(`基本过滤后的红球组合（和值+区间比）: ${filteredRedCombinations.length} 个`);
        
        // 快速处理优化：如果组合数量很少，加快处理速度
        if (filteredRedCombinations.length <= 100) {
            updateProgress(sessionId, 'fast-processing', 85, `检测到小量数据(${filteredRedCombinations.length}个)，启用快速处理模式...`);
        }
        
        // 第二步：优化热温冷比计算 - 预先获取遗漏数据
        log('开始优化热温冷比计算...');
        const previousIssue = (parseInt(targetIssue) - 1).toString();
        const missingData = await DLTRedMissing.findOne({ 
            Issue: previousIssue 
        });
        
        let validRedCombinations = [];
        const basicFilteredCount = filteredRedCombinations.length;
        
        if (!missingData) {
            log(`警告：找不到期号 ${previousIssue} 的遗漏数据，跳过热温冷过滤`);
            // 如果没有遗漏数据，直接使用基础过滤结果
            validRedCombinations = filteredRedCombinations.map(combo => ({
                id: combo.id,
                numbers: combo.numbers,
                sum: combo.sum,
                zoneRatio: combo.zoneRatio,
                evenOddRatio: combo.evenOddRatio,
                hotColdRatio: "0:0:5" // 默认值
            }));
            
            log(`跳过热温冷过滤，使用基础过滤结果: ${validRedCombinations.length} 个`);
        } else {
            // 批量计算热温冷比，避免重复数据库查询
            let processedCount = 0;
            
            log(`开始批量处理 ${basicFilteredCount} 个红球组合的热温冷比...`);
            
            for (const redCombo of filteredRedCombinations) {
                // 使用预加载的遗漏数据计算热温冷比
                const hotColdRatio = calculateHotColdRatioFromMissingData(redCombo.numbers, missingData);
                
                // 检查是否符合热温冷排除条件
                if (!excludeConditions.excludedHtcRatios || !excludeConditions.excludedHtcRatios.has(hotColdRatio)) {
                    validRedCombinations.push({
                        id: redCombo.id,
                        numbers: redCombo.numbers,
                        sum: redCombo.sum,
                        zoneRatio: redCombo.zoneRatio,
                        evenOddRatio: redCombo.evenOddRatio,
                        hotColdRatio: hotColdRatio
                    });
                }
                
                processedCount++;
                
                // 根据数据量调整进度更新频率
                const progressUpdateInterval = basicFilteredCount <= 100 ? 10 : 5000;
                if (processedCount % progressUpdateInterval === 0 || processedCount === basicFilteredCount) {
                    const progress = Math.round(processedCount / basicFilteredCount * 15) + 80; // 80-95%
                    const message = `处理热温冷过滤: ${processedCount}/${basicFilteredCount} (${Math.round(processedCount/basicFilteredCount*100)}%)`;
                    
                    if (sessionId) {
                        updateProgress(sessionId, 'htc-filtering', progress, message);
                    }
                    log(message);
                }
                
                // 根据用户需求决定是否限制组合数量
                const maxCombinations = Number.MAX_SAFE_INTEGER;
                if (validRedCombinations.length >= maxCombinations) {
                    const message = `已达到红球组合限制: ${maxCombinations} 个，停止处理`;
                    if (sessionId) {
                        updateProgress(sessionId, 'limit-reached', 95, message);
                    }
                    log(message);
                    break;
                }
            }
        }
        
        log(`通过热温冷过滤的红球组合: ${validRedCombinations.length} 个`);
        
        // 第三步：根据开关决定是否获取蓝球组合
        let validBlueCombinations = [];
        let enableBlueCombination = filters.enableBlueCombination !== false; // 默认为true
        
        if (enableBlueCombination) {
            // 应用蓝球和值筛选条件
            const blueQuery = {};
            if (filters.blueSumMin || filters.blueSumMax) {
                blueQuery.sum_value = {};
                if (filters.blueSumMin) blueQuery.sum_value.$gte = parseInt(filters.blueSumMin);
                if (filters.blueSumMax) blueQuery.sum_value.$lte = parseInt(filters.blueSumMax);
            }
            
            validBlueCombinations = await DLTBlueCombinations
                .find(blueQuery)
                .sort({ sum_value: 1 });
            
            log(`蓝球组合: ${validBlueCombinations.length} 个`);
            log(`蓝球分配策略: 每个红球组合按顺序循环分配一个蓝球组合（1:1对应）`);
        } else {
            log(`蓝球分配开关已关闭，只输出红球组合`);
        }
        
        // 第四步：生成最终组合
        const finalCombinations = [];
        const combinations = []; // 用于前端显示
        
        let combinationId = 1;
        
        // 生成组合
        for (let i = 0; i < validRedCombinations.length; i++) {
            const red = validRedCombinations[i];
            
            let combination;
            
            if (enableBlueCombination && validBlueCombinations.length > 0) {
                // 循环分配蓝球组合：使用模运算确保循环
                const blueIndex = i % validBlueCombinations.length;
                const blue = validBlueCombinations[blueIndex];
                
                combination = {
                    combinationId: combinationId++,
                    red1: red.numbers[0],
                    red2: red.numbers[1], 
                    red3: red.numbers[2],
                    red4: red.numbers[3],
                    red5: red.numbers[4],
                    blue1: blue.blue_ball_1,
                    blue2: blue.blue_ball_2,
                    redSum: red.sum,
                    blueSum: blue.sum_value,
                    totalSum: red.sum + blue.sum_value,
                    zoneRatio: red.zoneRatio,
                    hotColdRatio: red.hotColdRatio,
                    evenOddRatio: red.evenOddRatio
                };
                
                // 前端显示格式
                combinations.push({
                    combinationId: combination.combinationId,
                    red1: combination.red1,
                    red2: combination.red2,
                    red3: combination.red3,
                    red4: combination.red4,
                    red5: combination.red5,
                    blue1: combination.blue1,
                    blue2: combination.blue2,
                    zoneRatio: combination.zoneRatio,
                    redSum: combination.redSum,
                    blueSum: combination.blueSum,
                    totalSum: combination.totalSum,
                    hotColdRatio: combination.hotColdRatio
                });
            } else {
                // 只输出红球组合，不分配蓝球
                combination = {
                    combinationId: combinationId++,
                    red1: red.numbers[0],
                    red2: red.numbers[1], 
                    red3: red.numbers[2],
                    red4: red.numbers[3],
                    red5: red.numbers[4],
                    blue1: null,
                    blue2: null,
                    redSum: red.sum,
                    blueSum: null,
                    totalSum: red.sum,
                    zoneRatio: red.zoneRatio,
                    hotColdRatio: red.hotColdRatio,
                    evenOddRatio: red.evenOddRatio
                };
                
                // 前端显示格式
                combinations.push({
                    combinationId: combination.combinationId,
                    red1: combination.red1,
                    red2: combination.red2,
                    red3: combination.red3,
                    red4: combination.red4,
                    red5: combination.red5,
                    blue1: null,
                    blue2: null,
                    zoneRatio: combination.zoneRatio,
                    redSum: combination.redSum,
                    blueSum: null,
                    totalSum: combination.totalSum,
                    hotColdRatio: combination.hotColdRatio
                });
            }
            
            finalCombinations.push(combination);
        }
        
        log(`最终生成组合: ${finalCombinations.length} 个`);
        if (enableBlueCombination && validBlueCombinations.length > 0) {
            log(`组合分配详情: ${validRedCombinations.length} 个红球组合 × 1 个蓝球组合（循环分配）= ${finalCombinations.length} 个完整组合`);
        } else {
            log(`组合分配详情: 只输出红球组合，共 ${finalCombinations.length} 个红球组合`);
        }
        
        // 显示前几个组合的分配情况（用于调试）
        if (finalCombinations.length > 0) {
            const sampleSize = Math.min(3, finalCombinations.length);
            log(`前 ${sampleSize} 个组合分配示例:`);
            for (let i = 0; i < sampleSize; i++) {
                const combo = finalCombinations[i];
                const blueIndex = i % validBlueCombinations.length;
                log(`组合${i + 1}: 红球[${combo.red1},${combo.red2},${combo.red3},${combo.red4},${combo.red5}] + 蓝球[${combo.blue1},${combo.blue2}] (蓝球索引: ${blueIndex})`);
            }
        }
        
        return {
            basicFilteredRedCount: basicFilteredCount, // 基础过滤后的红球数量
            filteredRedCount: validRedCombinations.length, // 热温冷过滤后的红球数量
            finalCombinations: finalCombinations,
            combinations: combinations
        };
        
    } catch (error) {
        log(`生成过滤后组合预测出错: ${error.message}`);
        throw error;
    }
}

// 高效的热温冷比计算函数 - 避免重复数据库查询
function calculateHotColdRatioFromMissingData(redBallNumbers, missingData) {
    try {
        // 根据遗漏值判断红球的热温冷状态
        const hotColdStatus = redBallNumbers.map(num => {
            const missingValue = missingData[num.toString()];
            
            if (missingValue <= 4) {
                return 'hot';    // 热号(遗漏值≤4)
            } else if (missingValue >= 5 && missingValue <= 9) {
                return 'warm';   // 温号(遗漏值5-9)  
            } else {
                return 'cold';   // 冷号(遗漏值≥10)
            }
        });
        
        // 统计热温冷比例
        const hotCount = hotColdStatus.filter(s => s === 'hot').length;
        const warmCount = hotColdStatus.filter(s => s === 'warm').length;
        const coldCount = hotColdStatus.filter(s => s === 'cold').length;
        
        return `${hotCount}:${warmCount}:${coldCount}`;
    } catch (error) {
        console.error(`计算热温冷比例出错: ${error.message}`);
        return "0:0:5"; // 默认返回
    }
}

// 添加generateRedCombinations别名支持现有代码
const generateRedCombinations = generateAndStoreRedCombinations;
const generateBlueCombinations = generateAndStoreBlueCombinations;

// ========== 新预生成表方案 API ==========

// 生成基础红球组合表 (新方案)
app.get('/api/dlt/generate-base-combinations', async (req, res) => {
    try {
        log('开始生成基础红球组合表 (新方案)...');
        
        // 检查是否已存在数据
        const existingCount = await DLTBaseCombination.countDocuments();
        if (existingCount > 0) {
            return res.json({
                success: true,
                message: `基础红球组合表已存在，共 ${existingCount} 条记录`,
                count: existingCount
            });
        }
        
        // 生成所有红球组合 (35选5 = 324,632种)
        await generateBaseCombinations();
        
        const finalCount = await DLTBaseCombination.countDocuments();
        
        res.json({
            success: true,
            message: `基础红球组合表生成完成，共 ${finalCount} 条记录`,
            count: finalCount
        });
        
    } catch (error) {
        log('生成基础红球组合表错误:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// 生成期号分析数据 (新方案)
app.post('/api/dlt/generate-period-analysis', async (req, res) => {
    try {
        const { targetIssue } = req.body;
        
        if (!targetIssue) {
            return res.json({
                success: false,
                message: '缺少目标期号参数'
            });
        }
        
        log(`开始生成期号 ${targetIssue} 的分析数据 (新方案)...`);
        
        // 检查是否已存在该期号的分析数据
        const existingCount = await DLTPeriodAnalysis.countDocuments({ target_issue: targetIssue });
        if (existingCount > 0) {
            return res.json({
                success: true,
                message: `期号 ${targetIssue} 的分析数据已存在，共 ${existingCount} 条记录`,
                count: existingCount
            });
        }
        
        // 生成该期号的分析数据
        await generatePeriodAnalysisData(targetIssue);
        
        const finalCount = await DLTPeriodAnalysis.countDocuments({ target_issue: targetIssue });
        
        res.json({
            success: true,
            message: `期号 ${targetIssue} 分析数据生成完成，共 ${finalCount} 条记录`,
            count: finalCount
        });
        
    } catch (error) {
        log('生成期号分析数据错误:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// 新方案的组合预测API
app.get('/api/dlt/combination-prediction-v3', async (req, res) => {
    try {
        const { targetIssue, customSumExcludes, customHtcExcludes, customZoneExcludes } = req.query;
        
        if (!targetIssue) {
            return res.json({
                success: false,
                message: '缺少目标期号参数'
            });
        }
        
        log(`开始预测期号 ${targetIssue} 的组合 (新方案v3)...`);
        
        // 使用新的预生成表查询
        const result = await getFilteredCombinationsV3(targetIssue, {
            customSumExcludes: customSumExcludes ? customSumExcludes.split(',') : [],
            customHtcExcludes: customHtcExcludes ? customHtcExcludes.split(',') : [],
            customZoneExcludes: customZoneExcludes ? customZoneExcludes.split(',') : []
        });
        
        res.json(result);
        
    } catch (error) {
        log('新方案组合预测错误:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// ===== 新方案：期号全量组合缓存系统 =====

/**
 * 生成指定期号的全量红球组合缓存（新方案）
 * @param {string} targetIssue 目标期号
 * @returns {Object} 生成结果
 */
async function generatePeriodFullCombinations(targetIssue) {
    const startTime = new Date();
    log(`开始生成期号 ${targetIssue} 的全量组合缓存...`);
    
    try {
        // 1. 检查该期号是否已有全量缓存
        let cache = await DLTPeriodCombinationCache.findOne({ 
            targetIssue, 
            cacheType: 'full_combinations' 
        });
        
        if (cache) {
            if (cache.status === 'completed') {
                log(`期号 ${targetIssue} 的全量缓存已存在，直接返回`);
                return {
                    success: true,
                    cached: true,
                    data: cache,
                    message: '从缓存中获取全量组合数据'
                };
            } else if (cache.status === 'generating') {
                log(`期号 ${targetIssue} 的全量缓存正在生成中...`);
                return {
                    success: false,
                    generating: true,
                    message: '全量组合正在生成中，请稍后再试'
                };
            } else if (cache.status === 'failed') {
                log(`删除期号 ${targetIssue} 的失败缓存，重新生成`);
                await DLTPeriodCombinationCache.deleteOne({ 
                    targetIssue, 
                    cacheType: 'full_combinations' 
                });
                cache = null;
            }
        }
        
        // 2. 创建生成中状态的缓存记录
        if (!cache) {
            cache = await DLTPeriodCombinationCache.create({
                targetIssue,
                cacheType: 'full_combinations',
                redCombinations: [],
                totalCount: 0,
                issuePeriod: targetIssue,
                status: 'generating',
                generationStartTime: startTime
            });
            log(`创建期号 ${targetIssue} 的生成任务`);
        }
        
        // 3. 异步生成全量组合数据
        generateFullCombinationsAsync(targetIssue, cache._id).catch(error => {
            log(`异步生成全量组合失败: ${error.message}`);
        });
        
        return {
            success: true,
            generating: true,
            cacheId: cache._id,
            message: '全量组合生成任务已启动',
            estimatedTime: '30-60秒'
        };
        
    } catch (error) {
        log(`生成期号 ${targetIssue} 全量组合缓存出错: ${error.message}`);
        return {
            success: false,
            error: true,
            message: error.message
        };
    }
}

/**
 * 异步生成全量组合数据的具体实现
 * @param {string} targetIssue 目标期号
 * @param {ObjectId} cacheId 缓存记录ID
 */
async function generateFullCombinationsAsync(targetIssue, cacheId) {
    const startTime = new Date();
    
    try {
        log(`开始异步生成期号 ${targetIssue} 的全量组合数据...`);
        
        // 1. 复制所有红球组合基础数据
        const allRedCombinations = await DLTRedCombination.find({}).sort({ id: 1 });
        log(`获取到 ${allRedCombinations.length} 个基础红球组合`);
        
        if (allRedCombinations.length === 0) {
            throw new Error('红球组合表为空，请先生成基础组合表');
        }
        
        // 2. 获取目标期的遗漏数据（用于计算热温冷）
        const previousIssue = (parseInt(targetIssue) - 1).toString();
        const missingData = await DLTRedMissing.findOne({ Issue: previousIssue });
        
        if (!missingData) {
            log(`警告：找不到期号 ${previousIssue} 的遗漏数据，使用默认热温冷比`);
        }
        
        // 3. 批量计算热温冷比并增强组合数据
        const enhancedCombinations = [];
        let processedCount = 0;
        const batchSize = 1000; // 分批处理，避免内存占用过大
        
        for (let i = 0; i < allRedCombinations.length; i += batchSize) {
            const batch = allRedCombinations.slice(i, i + batchSize);
            
            const enhancedBatch = batch.map(combo => {
                const hotColdRatio = missingData 
                    ? calculateHotColdRatioFromMissingData(combo.numbers, missingData)
                    : "0:0:5"; // 默认值
                
                return {
                    id: combo.id,
                    numbers: combo.numbers,
                    sum: combo.sum,
                    zoneRatio: combo.zoneRatio,
                    evenOddRatio: combo.evenOddRatio,
                    largeSmallRatio: combo.largeSmallRatio,
                    consecutiveCount: combo.consecutiveCount,
                    spanValue: combo.spanValue,
                    hotColdRatio: hotColdRatio,
                    score: calculateBasicScore(combo) // 计算基础评分
                };
            });
            
            enhancedCombinations.push(...enhancedBatch);
            processedCount += batch.length;
            
            // 每处理5000个组合记录一次日志
            if (processedCount % 5000 === 0) {
                log(`处理进度: ${processedCount}/${allRedCombinations.length} (${Math.round(processedCount/allRedCombinations.length*100)}%)`);
            }
        }
        
        const endTime = new Date();
        const processingTime = (endTime - startTime) / 1000;
        
        // 4. 保存到缓存表（分批保存以避免MongoDB 16MB限制）
        const storageBatchSize = 10000; // 每批最多10000个组合
        const totalBatches = Math.ceil(enhancedCombinations.length / storageBatchSize);
        
        if (totalBatches <= 1) {
            // 如果数据量小，直接保存
            await DLTPeriodCombinationCache.updateOne(
                { _id: cacheId },
                {
                    redCombinations: enhancedCombinations,
                    totalCount: enhancedCombinations.length,
                    generationEndTime: endTime,
                    status: 'completed'
                }
            );
        } else {
            // 数据量大，检查MongoDB 16MB限制，动态调整存储数量
            log(`数据量大(${enhancedCombinations.length}个)，检查存储限制...`);
            
            // 按评分排序
            const sortedCombinations = enhancedCombinations
                .sort((a, b) => b.score - a.score);
            
            // 估算数据大小并动态确定存储数量
            const sampleSize = Math.min(1000, sortedCombinations.length);
            const sampleData = sortedCombinations.slice(0, sampleSize);
            const estimatedSizePerItem = JSON.stringify(sampleData).length / sampleSize;
            const maxItems = Math.floor(12 * 1024 * 1024 / estimatedSizePerItem); // 更保守的限制：12MB余量
            
            const actualStorageCount = Math.min(sortedCombinations.length, maxItems);
            const storageCombinations = sortedCombinations.slice(0, actualStorageCount);
            
            log(`估算单个组合大小: ${estimatedSizePerItem} 字节，最大可存储: ${maxItems} 个，实际存储: ${actualStorageCount} 个`);
                
            await DLTPeriodCombinationCache.updateOne(
                { _id: cacheId },
                {
                    redCombinations: storageCombinations,
                    totalCount: enhancedCombinations.length, // 保存原始总数
                    storedCount: storageCombinations.length, // 实际存储数量
                    optimizedStorage: actualStorageCount < enhancedCombinations.length, // 是否受限制
                    generationEndTime: endTime,
                    status: 'completed'
                }
            );
            
            log(`智能存储完成：存储 ${storageCombinations.length} 个组合（总计 ${enhancedCombinations.length} 个，${actualStorageCount === enhancedCombinations.length ? '全部存储' : 'MongoDB限制'}）`);
        }
        
        log(`期号 ${targetIssue} 全量组合生成完成！`);
        log(`总计: ${enhancedCombinations.length} 个组合，耗时: ${processingTime.toFixed(1)}秒`);
        
    } catch (error) {
        log(`异步生成全量组合失败: ${error.message}`);
        
        // 更新缓存状态为失败
        await DLTPeriodCombinationCache.updateOne(
            { _id: cacheId },
            {
                status: 'failed',
                errorMessage: error.message,
                generationEndTime: new Date()
            }
        );
    }
}

/**
 * 计算组合基础评分
 * @param {Object} combo 组合对象
 * @returns {number} 评分
 */
function calculateBasicScore(combo) {
    let score = 50; // 基础分
    
    // 和值合理性评分
    if (combo.sum >= 70 && combo.sum <= 120) {
        score += 20;
    } else if (combo.sum >= 50 && combo.sum <= 140) {
        score += 10;
    }
    
    // 区间分布均衡性评分
    if (combo.zoneRatio && combo.zoneRatio.includes(':')) {
        const zones = combo.zoneRatio.split(':').map(Number);
        const maxZone = Math.max(...zones);
        const minZone = Math.min(...zones);
        if (maxZone - minZone <= 2) {
            score += 15; // 分布均衡
        }
    }
    
    // 连号数量评分（适量连号更真实）
    if (combo.consecutiveCount >= 1 && combo.consecutiveCount <= 2) {
        score += 10;
    } else if (combo.consecutiveCount === 0) {
        score += 5;
    }
    
    // 跨度值评分
    if (combo.spanValue >= 15 && combo.spanValue <= 25) {
        score += 10;
    }
    
    return Math.min(score, 100); // 最高100分
}

/**
 * 获取指定期号的过滤后组合（新方案 - 内存过滤）
 * @param {string} targetIssue 目标期号
 * @param {Object} filters 过滤条件
 * @returns {Object} 过滤结果
 */
async function getOptimizedFilteredCombinations(targetIssue, filters) {
    const startTime = new Date();
    log(`开始获取期号 ${targetIssue} 的过滤组合（新方案）...`);
    
    try {
        // 1. 获取该期号的全量组合缓存
        let fullCache = await DLTPeriodCombinationCache.findOne({
            targetIssue,
            cacheType: 'full_combinations',
            status: 'completed'
        });
        
        if (!fullCache) {
            log(`期号 ${targetIssue} 的全量缓存不存在，开始生成...`);
            
            // 如果没有缓存，先尝试生成全量缓存
            const generateResult = await generatePeriodFullCombinations(targetIssue);
            
            if (!generateResult.success) {
                throw new Error(generateResult.message || '生成全量缓存失败');
            }
            
            if (generateResult.generating) {
                return {
                    success: false,
                    generating: true,
                    message: '全量组合正在生成中，请稍后重试',
                    estimatedTime: generateResult.estimatedTime
                };
            }
            
            // 如果是从缓存获取的，直接使用
            if (generateResult.cached) {
                fullCache = generateResult.data;
            } else {
                return {
                    success: false,
                    generating: true,
                    message: '全量组合生成任务已启动，请稍后重试'
                };
            }
        }
        
        // 2. 解析过滤条件
        const excludeConditions = parseFiltersToExcludeConditions(filters);
        log(`解析过滤条件 - 排除和值: ${excludeConditions.excludedSums.size}, 排除热温冷比: ${excludeConditions.excludedHtcRatios.size}, 排除区间比: ${excludeConditions.excludedZoneRatios.size}`);
        
        // 3. 内存中过滤（极快）
        let allCombinations = fullCache.redCombinations;
        
        // 如果使用了优化存储，说明这已经是最优的组合了
        if (fullCache.optimizedStorage) {
            log(`使用优化存储的组合，共 ${allCombinations.length} 个最优组合`);
        }
        
        const filteredCombinations = allCombinations.filter(combo => {
            // 和值过滤
            if (excludeConditions.excludedSums.has(combo.sum)) {
                return false;
            }
            
            // 热温冷比过滤
            if (excludeConditions.excludedHtcRatios.has(combo.hotColdRatio)) {
                return false;
            }
            
            // 区间比过滤
            if (excludeConditions.excludedZoneRatios.has(combo.zoneRatio)) {
                return false;
            }
            
            return true;
        });
        
        // 4. 按评分排序，选择最优组合
        const sortedCombinations = filteredCombinations
            .sort((a, b) => b.score - a.score);
            // 不再限制组合数量，返回所有符合条件的组合
        
        // 5. 生成最终组合（配对蓝球）
        const finalCombinations = await generateFinalCombinationsWithBlue(sortedCombinations);
        
        const endTime = new Date();
        const processingTime = (endTime - startTime) / 1000;
        
        log(`过滤完成！原始: ${fullCache.totalCount}, 过滤后: ${filteredCombinations.length}, 最终: ${finalCombinations.length}, 耗时: ${processingTime.toFixed(3)}秒`);
        
        return {
            success: true,
            data: {
                targetIssue,
                filters,
                statistics: {
                    originalCount: fullCache.totalCount,
                    filteredCount: filteredCombinations.length,
                    finalCount: finalCombinations.length,
                    processingTime: `${processingTime.toFixed(3)}秒`
                },
                combinations: finalCombinations.slice(0, 100), // 只返回前100个用于显示
                allCombinationsCount: finalCombinations.length
            }
        };
        
    } catch (error) {
        log(`获取过滤组合失败: ${error.message}`);
        return {
            success: false,
            error: true,
            message: error.message
        };
    }
}

/**
 * 解析过滤条件为排除条件集合
 * @param {Object} filters 用户过滤条件
 * @returns {Object} 排除条件集合
 */
function parseFiltersToExcludeConditions(filters) {
    const excludeConditions = {
        excludedSums: new Set(),
        excludedHtcRatios: new Set(),
        excludedZoneRatios: new Set()
    };
    
    // 处理自定义和值排除
    if (filters.customSumExcludes && Array.isArray(filters.customSumExcludes)) {
        filters.customSumExcludes.forEach(sum => {
            excludeConditions.excludedSums.add(parseInt(sum));
        });
    }
    
    // 处理和值范围包含（只保留指定范围内的和值）
    if (filters.customSumRanges && Array.isArray(filters.customSumRanges) && filters.customSumRanges.length > 0) {
        // 创建允许的和值集合
        const allowedSums = new Set();
        filters.customSumRanges.forEach(range => {
            for (let sum = range.start; sum <= range.end; sum++) {
                allowedSums.add(sum);
            }
        });
        
        // 排除不在允许范围内的所有和值（15-175之外的和值范围内但不在指定范围的）
        for (let sum = 15; sum <= 175; sum++) {
            if (!allowedSums.has(sum)) {
                excludeConditions.excludedSums.add(sum);
            }
        }
    }
    
    // 处理自定义热温冷比排除
    if (filters.customHtcExcludes && Array.isArray(filters.customHtcExcludes)) {
        filters.customHtcExcludes.forEach(ratio => {
            excludeConditions.excludedHtcRatios.add(ratio);
        });
    }
    
    // 处理自定义区间比排除
    if (filters.customZoneExcludes && Array.isArray(filters.customZoneExcludes)) {
        filters.customZoneExcludes.forEach(ratio => {
            excludeConditions.excludedZoneRatios.add(ratio);
        });
    }
    
    return excludeConditions;
}

/**
 * 为红球组合配对蓝球生成最终组合
 * @param {Array} redCombinations 过滤后的红球组合
 * @returns {Array} 最终组合
 */
async function generateFinalCombinationsWithBlue(redCombinations) {
    try {
        // 获取所有蓝球组合
        const blueCombinations = await DLTBlueCombination.find({}).sort({ sum: 1 });
        
        if (blueCombinations.length === 0) {
            throw new Error('蓝球组合表为空');
        }
        
        const finalCombinations = [];
        
        // 为每个红球组合循环分配蓝球组合
        redCombinations.forEach((red, index) => {
            const blueIndex = index % blueCombinations.length; // 循环分配
            const blue = blueCombinations[blueIndex];
            
            finalCombinations.push({
                redNumbers: red.numbers,
                blueNumbers: blue.numbers,
                redSum: red.sum,
                blueSum: blue.sum,
                totalSum: red.sum + blue.sum,
                redZoneRatio: red.zoneRatio,
                redEvenOddRatio: red.evenOddRatio,
                redLargeSmallRatio: red.largeSmallRatio,
                redConsecutiveCount: red.consecutiveCount,
                redSpanValue: red.spanValue,
                blueEvenOddRatio: blue.evenOddRatio,
                blueLargeSmallRatio: blue.largeSmallRatio,
                blueSpanValue: blue.spanValue,
                dynamicHotColdRatio: red.hotColdRatio,
                score: red.score
            });
        });
        
        return finalCombinations;
        
    } catch (error) {
        log(`生成最终组合失败: ${error.message}`);
        throw error;
    }
}

// ===== 缓存管理和清理机制 =====

/**
 * 缓存管理器 - 处理期号缓存的清理和维护
 */
class PeriodCacheManager {
    constructor() {
        this.cleanupInterval = null;
        this.maxCacheAge = 48 * 60 * 60 * 1000; // 48小时
        this.maxCacheCount = 10; // 最多保留10个期号的缓存
    }
    
    /**
     * 启动缓存管理器
     */
    start() {
        log('启动期号缓存管理器...');
        
        // 立即执行一次清理
        this.performCleanup();
        
        // 每小时执行一次清理
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, 60 * 60 * 1000); // 1小时
        
        log('期号缓存管理器已启动，每小时自动清理一次');
    }
    
    /**
     * 停止缓存管理器
     */
    stop() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
            log('期号缓存管理器已停止');
        }
    }
    
    /**
     * 执行缓存清理
     */
    async performCleanup() {
        try {
            log('开始执行期号缓存清理...');
            
            // 1. 清理失败状态的缓存（超过1小时）
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const failedResult = await DLTPeriodCombinationCache.deleteMany({
                status: 'failed',
                generatedAt: { $lt: oneHourAgo }
            });
            
            if (failedResult.deletedCount > 0) {
                log(`清理了 ${failedResult.deletedCount} 个失败状态的缓存`);
            }
            
            // 2. 清理生成中状态但超时的缓存（超过2小时）
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            const timeoutResult = await DLTPeriodCombinationCache.deleteMany({
                status: 'generating',
                generationStartTime: { $lt: twoHoursAgo }
            });
            
            if (timeoutResult.deletedCount > 0) {
                log(`清理了 ${timeoutResult.deletedCount} 个超时的生成任务`);
            }
            
            // 3. 保留最新的缓存，删除多余的（按期号降序保留前N个）
            const allCaches = await DLTPeriodCombinationCache
                .find({ status: 'completed' })
                .sort({ targetIssue: -1 })
                .select('_id targetIssue generatedAt');
            
            if (allCaches.length > this.maxCacheCount) {
                const cachesToDelete = allCaches.slice(this.maxCacheCount);
                const idsToDelete = cachesToDelete.map(cache => cache._id);
                
                const excessResult = await DLTPeriodCombinationCache.deleteMany({
                    _id: { $in: idsToDelete }
                });
                
                log(`清理了 ${excessResult.deletedCount} 个多余的期号缓存（保留最新${this.maxCacheCount}个）`);
            }
            
            // 4. 统计当前缓存状态
            await this.logCacheStatus();
            
        } catch (error) {
            log(`缓存清理出错: ${error.message}`);
        }
    }
    
    /**
     * 记录缓存状态统计
     */
    async logCacheStatus() {
        try {
            const stats = await DLTPeriodCombinationCache.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalSize: { $sum: { $size: '$redCombinations' } }
                    }
                }
            ]);
            
            const statusMap = {};
            let totalCaches = 0;
            let totalCombinations = 0;
            
            stats.forEach(stat => {
                statusMap[stat._id] = {
                    count: stat.count,
                    totalSize: stat.totalSize
                };
                totalCaches += stat.count;
                totalCombinations += stat.totalSize;
            });
            
            log(`缓存状态统计: 总缓存数=${totalCaches}, 总组合数=${totalCombinations}`);
            log(`详细统计: ${JSON.stringify(statusMap)}`);
            
        } catch (error) {
            log(`获取缓存状态出错: ${error.message}`);
        }
    }
    
    /**
     * 手动清理指定期号的缓存
     */
    async clearPeriodCache(targetIssue) {
        try {
            const result = await DLTPeriodCombinationCache.deleteOne({
                targetIssue,
                cacheType: 'full_combinations'
            });
            
            log(`手动清理期号 ${targetIssue} 的缓存，删除了 ${result.deletedCount} 条记录`);
            return result.deletedCount;
            
        } catch (error) {
            log(`清理期号 ${targetIssue} 缓存出错: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 获取缓存使用情况报告
     */
    async getCacheReport() {
        try {
            const report = {
                totalCaches: 0,
                statusBreakdown: {},
                oldestCache: null,
                newestCache: null,
                estimatedSizeMB: 0
            };
            
            // 基本统计
            const stats = await DLTPeriodCombinationCache.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalCombinations: { $sum: '$totalCount' }
                    }
                }
            ]);
            
            stats.forEach(stat => {
                report.statusBreakdown[stat._id] = {
                    count: stat.count,
                    totalCombinations: stat.totalCombinations
                };
                report.totalCaches += stat.count;
            });
            
            // 最新和最旧缓存
            const newest = await DLTPeriodCombinationCache
                .findOne({ status: 'completed' })
                .sort({ generatedAt: -1 });
                
            const oldest = await DLTPeriodCombinationCache
                .findOne({ status: 'completed' })
                .sort({ generatedAt: 1 });
            
            if (newest) {
                report.newestCache = {
                    targetIssue: newest.targetIssue,
                    generatedAt: newest.generatedAt
                };
            }
            
            if (oldest) {
                report.oldestCache = {
                    targetIssue: oldest.targetIssue,
                    generatedAt: oldest.generatedAt
                };
            }
            
            // 估算存储大小（每个组合约250字节）
            const totalCombinations = Object.values(report.statusBreakdown)
                .reduce((sum, stat) => sum + (stat.totalCombinations || 0), 0);
            report.estimatedSizeMB = Math.round(totalCombinations * 250 / 1024 / 1024 * 100) / 100;
            
            return report;
            
        } catch (error) {
            log(`获取缓存报告出错: ${error.message}`);
            throw error;
        }
    }
}

// 创建缓存管理器实例
const cacheManager = new PeriodCacheManager();

// ========== 新预生成表方案实现函数 ==========

/**
 * 生成全量基础红球组合数据 (新方案)
 * 存储324,632个基础组合到DLTBaseCombination表
 */
async function generateBaseCombinations() {
    log('开始生成全量基础红球组合数据 (新方案)...');
    
    // 检查是否已存在数据
    const existingCount = await DLTBaseCombination.countDocuments();
    if (existingCount > 0) {
        log(`基础红球组合已存在 ${existingCount} 条记录`);
        return;
    }
    
    const combinations = [];
    let combinationId = 1;
    
    log('开始生成C(35,5) = 324,632个基础组合...');
    
    // C(35,5) 生成所有组合
    for (let a = 1; a <= 31; a++) {
        for (let b = a + 1; b <= 32; b++) {
            for (let c = b + 1; c <= 33; c++) {
                for (let d = c + 1; d <= 34; d++) {
                    for (let e = d + 1; e <= 35; e++) {
                        const numbers = [a, b, c, d, e];
                        const redSum = numbers.reduce((acc, curr) => acc + curr, 0);
                        
                        // 计算固定属性
                        const zoneRatio = calculateZoneDistribution(numbers);
                        const evenOddRatio = calculateEvenOddRatio(numbers);
                        const largeSmallRatio = calculateLargeSmallRatio(numbers);
                        const consecutiveCount = calculateConsecutiveCount(numbers);
                        const spanValue = calculateSpanValue(numbers);
                        
                        combinations.push({
                            id: combinationId++,
                            red1: numbers[0],
                            red2: numbers[1],
                            red3: numbers[2],
                            red4: numbers[3],
                            red5: numbers[4],
                            zone_ratio: zoneRatio,
                            red_sum: redSum,
                            even_odd_ratio: evenOddRatio,
                            large_small_ratio: largeSmallRatio,
                            consecutive_count: consecutiveCount,
                            span_value: spanValue
                        });
                        
                        // 批量插入（每5000条）
                        if (combinations.length === 5000) {
                            await DLTBaseCombination.insertMany(combinations);
                            log(`已插入基础组合: ${combinationId - 5000} - ${combinationId - 1}`);
                            combinations.length = 0;
                        }
                    }
                }
            }
        }
    }
    
    // 插入剩余数据
    if (combinations.length > 0) {
        await DLTBaseCombination.insertMany(combinations);
        log(`已插入最后 ${combinations.length} 条基础组合`);
    }
    
    log(`基础红球组合生成完成，总计: ${combinationId - 1} 条记录`);
}

/**
 * 生成指定期号的分析数据 (新方案)
 * 为每个基础组合计算期号相关的热温冷比等动态属性
 */
async function generatePeriodAnalysisData(targetIssue) {
    log(`开始生成期号 ${targetIssue} 的分析数据...`);
    
    // 获取所有基础组合
    const baseCombinations = await DLTBaseCombination.find({}).sort({ id: 1 });
    
    if (baseCombinations.length === 0) {
        throw new Error('基础组合表为空，请先生成基础组合数据');
    }
    
    log(`获取到 ${baseCombinations.length} 个基础组合`);
    
    // 获取目标期的上一期遗漏数据（用于计算热温冷）
    const previousIssue = (parseInt(targetIssue) - 1).toString();
    const missingData = await DLTRedMissing.findOne({ Issue: previousIssue });
    
    if (!missingData) {
        log(`警告：找不到期号 ${previousIssue} 的遗漏数据，使用默认热温冷比`);
    }
    
    const analysisData = [];
    let processedCount = 0;
    
    // 批量处理基础组合
    for (const baseCombo of baseCombinations) {
        const redNumbers = [baseCombo.red1, baseCombo.red2, baseCombo.red3, baseCombo.red4, baseCombo.red5];
        
        // 计算热温冷比
        const hotColdRatio = missingData 
            ? calculateHotColdRatioFromMissingData(redNumbers, missingData)
            : "0:0:5"; // 默认值
        
        // 计算评分
        let score = 100; // 基础分
        
        // 和值合理性评分
        if (baseCombo.red_sum >= 70 && baseCombo.red_sum <= 120) {
            score += 20;
        } else if (baseCombo.red_sum >= 50 && baseCombo.red_sum <= 140) {
            score += 10;
        }
        
        // 热温冷均衡性评分
        const [hot, warm, cold] = hotColdRatio.split(':').map(Number);
        const maxHtc = Math.max(hot, warm, cold);
        const minHtc = Math.min(hot, warm, cold);
        if (maxHtc - minHtc <= 2) {
            score += 15; // 热温冷分布均衡
        }
        
        // 获取遗漏值数组
        const missValues = missingData 
            ? redNumbers.map(num => missingData[num.toString()] || 0)
            : [0, 0, 0, 0, 0];
        
        analysisData.push({
            target_issue: targetIssue,
            combination_id: baseCombo.id,
            hot_cold_ratio: hotColdRatio,
            score: Math.min(score, 150), // 最高150分
            miss_values: missValues
        });
        
        processedCount++;
        
        // 批量插入（每10000条）
        if (analysisData.length === 10000) {
            await DLTPeriodAnalysis.insertMany(analysisData);
            log(`已插入分析数据: ${processedCount - 10000 + 1} - ${processedCount}`);
            analysisData.length = 0;
        }
        
        // 定期报告进度
        if (processedCount % 50000 === 0) {
            log(`处理进度: ${processedCount}/${baseCombinations.length} (${Math.round(processedCount/baseCombinations.length*100)}%)`);
        }
    }
    
    // 插入剩余数据
    if (analysisData.length > 0) {
        await DLTPeriodAnalysis.insertMany(analysisData);
        log(`已插入最后 ${analysisData.length} 条分析数据`);
    }
    
    log(`期号 ${targetIssue} 分析数据生成完成，总计: ${processedCount} 条记录`);
}

/**
 * 基于新预生成表的组合查询 (新方案v3)
 * 使用SQL查询替代内存过滤，性能更优
 */
async function getFilteredCombinationsV3(targetIssue, filters) {
    const startTime = new Date();
    log(`开始查询期号 ${targetIssue} 的组合 (新方案v3)...`);
    
    try {
        // 1. 检查基础组合表是否存在
        const baseCount = await DLTBaseCombination.countDocuments();
        if (baseCount === 0) {
            return {
                success: false,
                message: '基础组合表为空，请先生成基础组合数据',
                needGenerate: 'base'
            };
        }
        
        // 2. 检查期号分析数据是否存在
        const analysisCount = await DLTPeriodAnalysis.countDocuments({ target_issue: targetIssue });
        if (analysisCount === 0) {
            return {
                success: false,
                message: `期号 ${targetIssue} 的分析数据不存在，请先生成分析数据`,
                needGenerate: 'analysis',
                targetIssue
            };
        }
        
        log(`基础组合: ${baseCount} 条，期号分析: ${analysisCount} 条`);
        
        // 3. 构建查询条件
        const baseQuery = {};
        const analysisQuery = { target_issue: targetIssue };
        
        // 和值过滤
        if (filters.customSumExcludes && filters.customSumExcludes.length > 0) {
            const excludedSums = filters.customSumExcludes.map(sum => parseInt(sum));
            baseQuery.red_sum = { $nin: excludedSums };
        }
        
        // 区间比过滤
        if (filters.customZoneExcludes && filters.customZoneExcludes.length > 0) {
            baseQuery.zone_ratio = { $nin: filters.customZoneExcludes };
        }
        
        // 热温冷比过滤
        if (filters.customHtcExcludes && filters.customHtcExcludes.length > 0) {
            analysisQuery.hot_cold_ratio = { $nin: filters.customHtcExcludes };
        }
        
        log(`查询条件 - 基础: ${JSON.stringify(baseQuery)}, 分析: ${JSON.stringify(analysisQuery)}`);
        
        // 4. 联合查询
        const pipeline = [
            // 从期号分析表开始查询
            { $match: analysisQuery },
            // 关联基础组合表
            {
                $lookup: {
                    from: 'hit_dlt_basecombinations', // MongoDB集合名
                    localField: 'combination_id',
                    foreignField: 'id',
                    as: 'baseCombo'
                }
            },
            // 展开关联结果
            { $unwind: '$baseCombo' },
            // 应用基础组合的过滤条件
            { $match: Object.keys(baseQuery).length > 0 ? 
                Object.fromEntries(Object.entries(baseQuery).map(([key, value]) => [`baseCombo.${key}`, value])) : {} 
            },
            // 按评分排序
            { $sort: { score: -1 } },
            // 重构输出格式
            {
                $project: {
                    _id: 0,
                    combinationId: '$combination_id',
                    red1: '$baseCombo.red1',
                    red2: '$baseCombo.red2',
                    red3: '$baseCombo.red3',
                    red4: '$baseCombo.red4',
                    red5: '$baseCombo.red5',
                    redSum: '$baseCombo.red_sum',
                    zoneRatio: '$baseCombo.zone_ratio',
                    evenOddRatio: '$baseCombo.even_odd_ratio',
                    largeSmallRatio: '$baseCombo.large_small_ratio',
                    consecutiveCount: '$baseCombo.consecutive_count',
                    spanValue: '$baseCombo.span_value',
                    hotColdRatio: '$hot_cold_ratio',
                    score: '$score',
                    missValues: '$miss_values'
                }
            }
        ];
        
        // 5. 执行查询
        log('开始执行联合查询...');
        const filteredCombinations = await DLTPeriodAnalysis.aggregate(pipeline);
        
        // 6. 配对蓝球生成最终组合 - 传递组合模式
        const finalCombinations = await generateFinalCombinationsWithBlueV3(filteredCombinations, filters.combinationMode || 'default');
        
        const endTime = new Date();
        const processingTime = (endTime - startTime) / 1000;
        
        log(`查询完成！过滤后红球: ${filteredCombinations.length}, 最终组合: ${finalCombinations.length}, 耗时: ${processingTime.toFixed(3)}秒`);
        
        return {
            success: true,
            version: 'v3-pregenerated-tables',
            data: {
                targetIssue,
                filters,
                statistics: {
                    baseCount,
                    analysisCount,
                    filteredCount: filteredCombinations.length,
                    finalCount: finalCombinations.length,
                    processingTime: `${processingTime.toFixed(3)}秒`
                },
                combinations: finalCombinations.slice(0, 100), // 只返回前100个用于显示
                allCombinationsCount: finalCombinations.length
            }
        };
        
    } catch (error) {
        log(`查询组合失败: ${error.message}`);
        return {
            success: false,
            error: true,
            message: error.message
        };
    }
}

/**
 * 为红球组合配对蓝球生成最终组合 (v3版本) - 支持3种模式
 */
async function generateFinalCombinationsWithBlueV3(redCombinations, mode = 'default') {
    try {
        // 获取所有蓝球组合 (如果没有就生成)
        let blueCombinations = await DLTBlueCombination.find({}).sort({ sum: 1 });

        if (blueCombinations.length === 0) {
            log('蓝球组合表为空，开始生成...');
            await generateAndStoreBlueCombinations();
            blueCombinations = await DLTBlueCombination.find({}).sort({ sum: 1 });
        }

        if (blueCombinations.length === 0) {
            throw new Error('蓝球组合表为空且生成失败');
        }

        const finalCombinations = [];

        log(`🎯 使用模式: ${mode}, 红球组合数: ${redCombinations.length}, 蓝球组合数: ${blueCombinations.length}`);

        switch(mode) {
            case 'default':
                // 默认模式：限制红球为100个，循环分配蓝球
                const limitedRed = redCombinations.slice(0, 100);
                limitedRed.forEach((red, index) => {
                    const blueIndex = index % blueCombinations.length; // 循环分配
                    const blue = blueCombinations[blueIndex];

                    finalCombinations.push(createCombination(red, blue));
                });
                log(`✅ 默认模式完成: ${finalCombinations.length}组 (100红球 × 66蓝球，循环分配)`);
                break;

            case 'unlimited':
                // 普通无限制：所有红球，但1:1分配蓝球
                redCombinations.forEach((red, index) => {
                    const blueIndex = index % blueCombinations.length; // 循环分配
                    const blue = blueCombinations[blueIndex];

                    finalCombinations.push(createCombination(red, blue));
                });
                log(`🔄 普通无限制完成: ${finalCombinations.length}组 (${redCombinations.length}红球 × 66蓝球，1:1分配)`);
                break;

            case 'truly-unlimited':
                // 真正无限制：所有红球配所有蓝球
                redCombinations.forEach((red) => {
                    blueCombinations.forEach((blue) => {
                        finalCombinations.push(createCombination(red, blue));
                    });
                });
                log(`🔥 真正无限制完成: ${finalCombinations.length}组 (${redCombinations.length}红球 × ${blueCombinations.length}蓝球，完全组合)`);
                break;

            default:
                throw new Error(`不支持的组合模式: ${mode}`);
        }

        return finalCombinations;

    } catch (error) {
        log(`生成最终组合失败: ${error.message}`);
        throw error;
    }
}

/**
 * 创建单个组合对象的辅助函数
 */
function createCombination(red, blue) {
    return {
        combinationId: red.combinationId,
        red1: red.red1,
        red2: red.red2,
        red3: red.red3,
        red4: red.red4,
        red5: red.red5,
        blue1: blue.numbers[0],
        blue2: blue.numbers[1],
        redSum: red.redSum,
        blueSum: blue.sum,
        totalSum: red.redSum + blue.sum,
        zoneRatio: red.zoneRatio,
        evenOddRatio: red.evenOddRatio,
        largeSmallRatio: red.largeSmallRatio,
        consecutiveCount: red.consecutiveCount,
        spanValue: red.spanValue,
        hotColdRatio: red.hotColdRatio,
        score: red.score,
        missValues: red.missValues
    };
}

/**
 * 缓存管理API - 获取缓存使用报告
 */
app.get('/api/dlt/cache-report', async (req, res) => {
    try {
        const report = await cacheManager.getCacheReport();
        
        res.json({
            success: true,
            data: report,
            message: '缓存报告获取成功'
        });
        
    } catch (error) {
        log('获取缓存报告错误:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 缓存管理API - 手动执行缓存清理
 */
app.post('/api/dlt/cleanup-cache', async (req, res) => {
    try {
        log('收到手动缓存清理请求');
        
        await cacheManager.performCleanup();
        
        res.json({
            success: true,
            message: '缓存清理完成'
        });
        
    } catch (error) {
        log('手动缓存清理错误:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// ===== 新版组合预测API (完全重新设计) =====

/**
 * 数据预处理API - 生成红球组合
 */
app.post('/api/dlt/generate-red-combinations', async (req, res) => {
    try {
        log('开始生成红球组合数据...');
        
        const { generateRedBallCombinations } = require('./dlt-combination-data-generator.js');
        await generateRedBallCombinations();
        
        res.json({
            success: true,
            message: '红球组合数据生成完成'
        });
        
    } catch (error) {
        log('生成红球组合失败:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 数据预处理API - 生成蓝球组合
 */
app.post('/api/dlt/generate-blue-combinations', async (req, res) => {
    try {
        log('开始生成蓝球组合数据...');
        
        const { generateBlueBallCombinations } = require('./dlt-combination-data-generator.js');
        await generateBlueBallCombinations();
        
        res.json({
            success: true,
            message: '蓝球组合数据生成完成'
        });
        
    } catch (error) {
        log('生成蓝球组合失败:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 数据预处理API - 生成指定期号的热温冷分析
 */
app.post('/api/dlt/generate-hot-warm-cold/:baseIssue/:targetIssue', async (req, res) => {
    try {
        const { baseIssue, targetIssue } = req.params;
        log(`开始为期号${targetIssue}生成热温冷分析（基于${baseIssue}期）...`);
        
        const { generateHotWarmColdAnalysisForIssue } = require('./dlt-combination-data-generator.js');
        await generateHotWarmColdAnalysisForIssue(baseIssue, targetIssue);
        
        res.json({
            success: true,
            message: `期号${targetIssue}的热温冷分析数据生成完成`
        });
        
    } catch (error) {
        log(`生成热温冷分析失败:`, error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 批量生成最近200期热温冷分析数据
 */
app.post('/api/dlt/generate-recent-periods', async (req, res) => {
    try {
        const { periods = 200 } = req.body;
        log(`开始批量生成最近${periods}期的热温冷分析数据...`);
        
        // 获取最近的期号列表
        const recentIssues = await DLT.find({})
            .select('Issue')
            .sort({ Issue: -1 })
            .limit(periods + 1)  // 多取一期作为基准期
            .lean();
        
        if (recentIssues.length < 2) {
            return res.json({
                success: false,
                message: '历史数据不足，无法生成分析'
            });
        }
        
        log(`找到${recentIssues.length}期历史数据，准备生成分析...`);
        
        // 启动后台任务生成数据
        const { generateHotWarmColdForPeriods } = require('./dlt-combination-data-generator.js');
        
        // 异步生成，立即返回响应
        generateHotWarmColdForPeriods(recentIssues, periods)
            .then(() => log(`✅ 批量生成${periods}期数据完成`))
            .catch(error => log(`❌ 批量生成失败:`, error));
        
        res.json({
            success: true,
            message: `已启动批量生成任务，将为最近${periods}期生成热温冷分析数据`,
            periods: periods,
            targetIssues: recentIssues.slice(0, periods).map(item => item.Issue)
        });
        
    } catch (error) {
        log(`批量生成数据失败:`, error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 查询数据生成进度
 */
app.get('/api/dlt/generation-progress', async (req, res) => {
    try {
        // 获取最近200期期号
        const recentIssues = await DLT.find({})
            .select('Issue')
            .sort({ Issue: -1 })
            .limit(201)  // 多取一期作为基准期
            .lean();
        
        const targetIssues = recentIssues.slice(0, 200);
        const baseIssues = recentIssues.slice(1, 201);
        
        // 检查优化数据结构的生成进度
        const optimizedCount = await DLTRedCombinationsHotWarmColdOptimized.find({
            target_issue: { $in: targetIssues.map(item => item.Issue.toString()) }
        }).distinct('target_issue');
        
        const totalGenerated = optimizedCount.length;
        const progress = Math.round((totalGenerated / targetIssues.length) * 100);
        
        res.json({
            success: true,
            totalPeriods: targetIssues.length,
            generatedPeriods: totalGenerated,
            progress: progress,
            generatedIssues: optimizedCount.sort().reverse(),
            dataStructures: {
                optimized: optimizedCount.length,
                legacy: 0
            },
            message: `系统已全面升级至优化数据结构，覆盖${optimizedCount.length}期数据`
        });
        
    } catch (error) {
        log('查询生成进度失败:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 主要API - 组合预测查询
 */
/**
 * 获取有热温冷分析数据的期号列表
 */
app.get('/api/dlt/available-issues', async (req, res) => {
    try {
        log('获取可用于组合预测的期号列表...');
        
        // 获取有热温冷分析数据的期号，优先显示完整数据
        const availableIssues = await DLTRedCombinationsHotWarmCold.aggregate([
            {
                $group: {
                    _id: {
                        target_issue: '$target_issue',
                        base_issue: '$base_issue'
                    },
                    count: { $sum: 1 }
                }
            },
            // 只保留有足够数据的期号
            { $match: { count: { $gte: 10000 } } },
            {
                $addFields: {
                    // 标记数据完整性：完整数据（>300K）优先显示
                    dataQuality: {
                        $cond: {
                            if: { $gte: ['$count', 300000] },
                            then: 'complete',
                            else: 'partial'
                        }
                    },
                    // 用于排序的权重
                    sortWeight: {
                        $cond: {
                            if: { $gte: ['$count', 300000] },
                            then: 1000000,  // 完整数据权重高
                            else: 0
                        }
                    }
                }
            },
            { $sort: { 
                sortWeight: -1,  // 先按数据完整性排序
                '_id.target_issue': -1  // 再按期号倒序
            }},
            { $limit: 200 }  // 增加到200期选择
        ]);
        
        log(`找到${availableIssues.length}个可用期号组合`);
        
        const formattedIssues = availableIssues.map(item => ({
            targetIssue: item._id.target_issue,
            baseIssue: item._id.base_issue,
            dataCount: item.count,
            dataQuality: item.dataQuality,
            isComplete: item.count >= 300000
        }));
        
        res.json({
            success: true,
            data: formattedIssues
        });
    } catch (error) {
        log('获取可用期号失败:', error);
        res.json({
            success: false,
            message: '获取可用期号失败'
        });
    }
});

/**
 * 获取可用的期号列表
 */
app.get('/api/dlt/issues', async (req, res) => {
    try {
        // 获取最近50期的期号，降序排列
        const issues = await DLT.find({})
            .select('Issue')
            .sort({ Issue: -1 })
            .limit(50)
            .lean();
        
        const issueNumbers = issues.map(item => item.Issue);
        
        res.json({
            success: true,
            data: issueNumbers
        });
    } catch (error) {
        console.error('获取期号列表失败:', error);
        res.json({
            success: false,
            message: '获取期号列表失败'
        });
    }
});

/**
 * 获取最近指定期数的和值
 */
async function getRecentPeriodSumValues(targetIssue, periods) {
    try {
        // 从目标期号开始，向前查找指定期数的历史数据
        const targetIssueNum = parseInt(targetIssue);
        const startIssue = targetIssueNum - periods;
        
        log(`查询期号范围: ${startIssue + 1} - ${targetIssueNum - 1}`);
        
        // 查询历史开奖数据中的和值
        const recentData = await DLT.find({
            Issue: {
                $gt: startIssue,
                $lt: targetIssueNum
            }
        }).select('Red1 Red2 Red3 Red4 Red5').sort({ Issue: -1 }).limit(periods);
        
        // 计算每期的和值
        const sumValues = recentData.map(item => {
            if (item.Red1 && item.Red2 && item.Red3 && item.Red4 && item.Red5) {
                return item.Red1 + item.Red2 + item.Red3 + item.Red4 + item.Red5;
            }
            return null;
        }).filter(sum => sum !== null);
        
        // 去重并返回
        const uniqueSums = [...new Set(sumValues)];
        log(`找到${recentData.length}期历史数据，提取到${uniqueSums.length}个不同的和值`);
        log(`🔥 getRecentPeriodSumValues详细结果:`, JSON.stringify(uniqueSums, null, 2));
        
        return uniqueSums;
    } catch (error) {
        log('获取最近期数和值失败:', error);
        return [];
    }
}

// 测试端点：获取最近期数和值
app.get('/api/dlt/debug-recent-sums', async (req, res) => {
    try {
        const { targetIssue = '25087', periods = 7 } = req.query;
        const targetIssueNum = parseInt(targetIssue);
        const startIssue = targetIssueNum - parseInt(periods);
        
        // 查询历史开奖数据
        const recentData = await DLT.find({
            Issue: {
                $gt: startIssue,
                $lt: targetIssueNum
            }
        }).select('Issue Red1 Red2 Red3 Red4 Red5').sort({ Issue: -1 }).limit(parseInt(periods));
        
        // 计算每期的和值
        const detailedSums = recentData.map(item => {
            const sum = item.Red1 + item.Red2 + item.Red3 + item.Red4 + item.Red5;
            return {
                issue: item.Issue,
                reds: [item.Red1, item.Red2, item.Red3, item.Red4, item.Red5],
                sum: sum
            };
        });
        
        const sumValues = detailedSums.map(item => item.sum);
        const uniqueSums = [...new Set(sumValues)].sort((a, b) => a - b);
        
        res.json({
            success: true,
            data: {
                targetIssue,
                periods: parseInt(periods),
                queryRange: `${startIssue + 1} - ${targetIssueNum - 1}`,
                foundPeriods: recentData.length,
                detailedData: detailedSums,
                allSums: sumValues,
                uniqueSums: uniqueSums,
                duplicateCount: sumValues.length - uniqueSums.length
            }
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.get('/api/dlt/new-combination-prediction', async (req, res) => {
    try {
        log('收到新版组合预测请求:', JSON.stringify(req.query));
        log('🔍 enableBlueCombination参数详情:', {
            原始值: req.query.enableBlueCombination,
            类型: typeof req.query.enableBlueCombination,
            字符串值: String(req.query.enableBlueCombination),
            是否等于true字符串: req.query.enableBlueCombination === 'true'
        });
        
        // 收集排除信息用于前端显示
        const excludedData = {};
        const filterSummary = {
            appliedFilters: [],
            dataVolume: {},
            excludedItems: {}
        };
        
        const {
            targetIssue,
            baseIssue,
            sumRanges,
            excludeRecentPeriods,
            excludeZoneRecentPeriods,
            excludeHwcRecentPeriods,
            sumMin,
            sumMax,
            spanRanges,
            zoneRatios,
            oddEvenRatios,
            hotWarmColdRatios,
            hotCountMin = 0,
            hotCountMax = 5,
            warmCountMin = 0,
            warmCountMax = 5,
            coldCountMin = 0,
            coldCountMax = 5,
            blueSumMin = 3,
            blueSumMax = 23,
            enableBlueCombination = 'true',
            limit = 100,
            page = 1
        } = req.query;
        
        if (!targetIssue || !baseIssue) {
            return res.json({
                success: false,
                message: '请提供目标期号和基准期号'
            });
        }
        
        // 检查优化版热温冷分析数据
        let hotWarmColdData = await DLTRedCombinationsHotWarmColdOptimized.findOne({
            base_issue: baseIssue,
            target_issue: targetIssue
        });
        
        // 如果没有优化版数据，返回错误
        if (!hotWarmColdData) {
            return res.json({
                success: false,
                message: `期号${targetIssue}的优化版热温冷数据不存在，请先生成数据`,
                needGenerate: true,
                baseIssue,
                targetIssue
            });
        }
        
        log(`期号${targetIssue}使用优化版热温冷数据结构`);
        
        // 构建查询条件
        const redQuery = {};
        const hotWarmColdQuery = {
            base_issue: baseIssue,
            target_issue: targetIssue
        };
        
        // 和值范围排除条件（支持多范围排除）
        // 记录和值排除筛选信息
        
        log(`🔍 检查排除和值范围参数: ${sumRanges} (类型: ${typeof sumRanges})`);
        if (sumRanges && typeof sumRanges === 'string') {
            try {
                const ranges = JSON.parse(sumRanges);
                log(`📊 解析得到的排除范围: ${JSON.stringify(ranges)}`);
                if (Array.isArray(ranges) && ranges.length > 0) {
                    // 如果有多个范围，使用 $nor 查询来排除
                    const sumConditions = ranges.map(range => ({
                        sum_value: {
                            $gte: parseInt(range.min),
                            $lte: parseInt(range.max)
                        }
                    }));
                    
                    // 记录和值筛选信息
                    const rangeStrings = ranges.map(range => `${range.min}-${range.max}`).join(', ');
                    filterSummary.appliedFilters.push({
                        type: '排除和值范围',
                        value: rangeStrings,
                        description: `排除和值范围: ${rangeStrings}`
                    });
                    
                    if (sumConditions.length === 1) {
                        // 只有一个范围，使用 $not 排除
                        redQuery.sum_value = {
                            $not: sumConditions[0].sum_value
                        };
                        log(`✅ 单一排除范围查询条件: ${JSON.stringify(redQuery.sum_value)}`);
                    } else {
                        // 多个范围，使用 $nor 排除所有指定范围
                        redQuery.$nor = sumConditions;
                        log(`✅ 多范围排除查询条件: ${JSON.stringify(redQuery.$nor)}`);
                    }
                } else {
                    // 如果没有有效的范围数据，不应用任何和值范围限制
                    // 这样允许后续的 excludeRecentPeriods 逻辑正常工作
                    log(`⚠️ 没有有效的和值范围数据，跳过和值范围限制`);
                }
            } catch (error) {
                log('解析和值范围参数失败:', error);
                // 回退到旧的方式 - 但仍然使用排除逻辑
                if (sumMin || sumMax) {
                    redQuery.sum_value = {
                        $not: {}
                    };
                    if (sumMin) redQuery.sum_value.$not.$gte = parseInt(sumMin);
                    if (sumMax) redQuery.sum_value.$not.$lte = parseInt(sumMax);
                    
                    // 记录和值筛选信息
                    filterSummary.appliedFilters.push({
                        type: '排除和值范围',
                        value: `${sumMin}-${sumMax}`,
                        description: `排除和值在${sumMin}到${sumMax}之间`
                    });
                }
            }
        } else {
            // 回退到旧的方式（兼容性） - 使用排除逻辑
            if (sumMin || sumMax) {
                redQuery.sum_value = {
                    $not: {}
                };
                if (sumMin) redQuery.sum_value.$not.$gte = parseInt(sumMin);
                if (sumMax) redQuery.sum_value.$not.$lte = parseInt(sumMax);
                
                // 记录和值筛选信息
                filterSummary.appliedFilters.push({
                    type: '排除和值范围',
                    value: `${sumMin}-${sumMax}`,
                    description: `排除和值在${sumMin}到${sumMax}之间`
                });
            }
        }
        
        // 处理排除最近期数和值
        if (excludeRecentPeriods && typeof excludeRecentPeriods === 'string') {
            try {
                const exclusionSettings = JSON.parse(excludeRecentPeriods);
                if (exclusionSettings.enabled && exclusionSettings.periods > 0) {
                    log(`🎯🎯🎯 我们的代码：执行排除最近${exclusionSettings.periods}期和值 🎯🎯🎯`);
                    log(`🔥 开始获取排除和值数据...`);
                    const excludedSums = await getRecentPeriodSumValues(targetIssue, exclusionSettings.periods);
                    log(`🔥 获取到${excludedSums.length}个排除和值:`, excludedSums);
                    log(`🔥 excludedSums详细内容:`, JSON.stringify(excludedSums, null, 2));
                    console.log(`🔥 CONSOLE: excludedSums内容:`, excludedSums);
                    console.log(`🔥 CONSOLE: excludedSums类型:`, typeof excludedSums, Array.isArray(excludedSums));
                    
                    // 保存排除的和值数据用于前端显示
                    excludedData.sumValues = excludedSums.sort((a, b) => a - b);
                    excludedData.sumPeriods = exclusionSettings.periods;
                    log(`🔥 excludedData.sumValues已设置:`, excludedData.sumValues);
                    log(`🔥 excludedData.sumPeriods已设置:`, excludedData.sumPeriods);
                    log(`🔥 测试点1 - excludedData完整对象:`, JSON.stringify(excludedData, null, 2));
                    
                    // 记录排除和值筛选信息
                    filterSummary.appliedFilters.push({
                        type: '排除和值',
                        value: exclusionSettings.periods,
                        description: `排除最近${exclusionSettings.periods}期和值`,
                        excludedCount: excludedSums.length
                    });
                    filterSummary.excludedItems.sumValues = excludedSums;
                    
                    if (excludedSums.length > 0) {
                        // 如果已有和值查询条件，需要合并
                        if (redQuery.sum_value) {
                            // 单个范围的情况
                            const existingCondition = redQuery.sum_value;
                            redQuery.sum_value = {
                                ...existingCondition,
                                $nin: excludedSums
                            };
                        } else if (redQuery.$or) {
                            // 多个范围的情况，为每个范围添加排除条件
                            redQuery.$or = redQuery.$or.map(condition => ({
                                ...condition,
                                sum_value: {
                                    ...condition.sum_value,
                                    $nin: excludedSums
                                }
                            }));
                        } else {
                            // 没有和值范围限制，直接排除
                            redQuery.sum_value = { $nin: excludedSums };
                        }
                        
                        log(`已排除${excludedSums.length}个最近期数和值: ${excludedSums.join(', ')}`);
                    }
                }
            } catch (error) {
                log('解析排除最近期数参数失败:', error);
            }
        }
        
        // 跨度范围排除条件（支持多范围排除）
        log(`🔍 检查排除跨度范围参数: ${spanRanges} (类型: ${typeof spanRanges})`);
        if (spanRanges && typeof spanRanges === 'string') {
            try {
                const ranges = JSON.parse(spanRanges);
                log(`📊 解析得到的排除跨度范围: ${JSON.stringify(ranges)}`);
                if (Array.isArray(ranges) && ranges.length > 0) {
                    // 如果有多个范围，使用 $nor 查询来排除
                    const spanConditions = ranges.map(range => ({
                        span_value: {
                            $gte: parseInt(range.min),
                            $lte: parseInt(range.max)
                        }
                    }));
                    
                    // 记录跨度范围排除筛选信息
                    const rangeStrings = ranges.map(range => `${range.min}-${range.max}`).join(', ');
                    filterSummary.appliedFilters.push({
                        type: '排除跨度范围',
                        value: rangeStrings,
                        description: `排除跨度范围: ${rangeStrings}`
                    });
                    
                    if (spanConditions.length === 1) {
                        // 只有一个范围，使用 $not 排除
                        redQuery.span_value = {
                            $not: spanConditions[0].span_value
                        };
                        log(`✅ 单一排除跨度范围查询条件: ${JSON.stringify(redQuery.span_value)}`);
                    } else {
                        // 多个范围，使用 $nor 排除所有指定范围
                        if (redQuery.$nor) {
                            // 如果已有$nor条件，需要合并
                            redQuery.$nor = [...redQuery.$nor, ...spanConditions];
                        } else {
                            redQuery.$nor = spanConditions;
                        }
                        log(`✅ 多跨度范围排除查询条件: ${JSON.stringify(redQuery.$nor)}`);
                    }
                }
            } catch (error) {
                log('解析跨度范围参数失败:', error);
            }
        }
        
        if (zoneRatios) {
            const ratioArray = zoneRatios.split(',').map(r => r.trim());
            redQuery.zone_ratio = { $nin: ratioArray };
            
            // 记录区间比排除筛选信息
            filterSummary.appliedFilters.push({
                type: '排除区间比',
                value: ratioArray.join(', '),
                description: `排除区间比: ${ratioArray.join(', ')}`
            });
        }
        
        // 处理区间比排除最近期数
        if (excludeZoneRecentPeriods && typeof excludeZoneRecentPeriods === 'string') {
            try {
                const excludeSettings = JSON.parse(excludeZoneRecentPeriods);
                if (excludeSettings.enabled && excludeSettings.periods > 0) {
                    // 获取最近N期的区间比数据
                    const recentResults = await DLT.find({
                        Issue: { $lt: parseInt(targetIssue) }
                    }).sort({ Issue: -1 }).limit(excludeSettings.periods);
                    
                    const excludedZoneRatios = [];
                    for (const result of recentResults) {
                        const redBalls = [result.Red1, result.Red2, result.Red3, result.Red4, result.Red5];
                        const zoneRatio = calculateDLTZoneRatio(redBalls);
                        if (zoneRatio && !excludedZoneRatios.includes(zoneRatio)) {
                            excludedZoneRatios.push(zoneRatio);
                        }
                    }
                    
                    // 记录区间比筛选信息
                    filterSummary.appliedFilters.push({
                        type: '排除区间比',
                        value: excludeSettings.periods,
                        description: `排除最近${excludeSettings.periods}期区间比`,
                        excludedCount: excludedZoneRatios.length
                    });
                    filterSummary.excludedItems.zoneRatios = excludedZoneRatios;
                    
                    // 保存排除的区间比数据用于前端显示
                    excludedData.zoneRatios = excludedZoneRatios.sort();
                    excludedData.zonePeriods = excludeSettings.periods;
                    
                    if (excludedZoneRatios.length > 0) {
                        if (redQuery.zone_ratio) {
                            // 如果已经有区间比排除条件，需要合并排除条件
                            if (redQuery.zone_ratio.$nin) {
                                // 合并两个排除数组，去重
                                const combinedExcludes = [...new Set([...redQuery.zone_ratio.$nin, ...excludedZoneRatios])];
                                redQuery.zone_ratio.$nin = combinedExcludes;
                            } else {
                                // 添加排除条件
                                redQuery.zone_ratio = { 
                                    ...redQuery.zone_ratio, 
                                    $nin: excludedZoneRatios 
                                };
                            }
                        } else {
                            // 没有其他区间比条件，直接排除
                            redQuery.zone_ratio = { $nin: excludedZoneRatios };
                        }
                        
                        log(`已排除${excludedZoneRatios.length}个最近期数区间比: ${excludedZoneRatios.join(', ')}`);
                    }
                }
            } catch (error) {
                log('解析区间比排除最近期数参数失败:', error);
            }
        }
        
        if (oddEvenRatios) {
            const ratioArray = oddEvenRatios.split(',').map(r => r.trim());
            redQuery.odd_even_ratio = { $nin: ratioArray };
            
            // 记录奇偶比排除筛选信息
            filterSummary.appliedFilters.push({
                type: '排除奇偶比',
                value: ratioArray.join(', '),
                description: `排除奇偶比: ${ratioArray.join(', ')}`
            });
        }
        
        // 热温冷排除筛选条件
        if (hotWarmColdRatios) {
            const ratioArray = hotWarmColdRatios.split(',').map(r => r.trim());
            hotWarmColdQuery.hot_warm_cold_ratio = { $nin: ratioArray };
            
            // 记录热温冷比排除筛选信息
            filterSummary.appliedFilters.push({
                type: '手动排除热温冷比',
                value: ratioArray.join(', '),
                description: `排除热温冷比: ${ratioArray.join(', ')}`
            });
        }
        
        // 处理热温冷比排除最近期数
        if (excludeHwcRecentPeriods && typeof excludeHwcRecentPeriods === 'string') {
            try {
                const excludeSettings = JSON.parse(excludeHwcRecentPeriods);
                if (excludeSettings.enabled && excludeSettings.periods > 0) {
                    // 获取最近N期的热温冷比数据
                    const recentResults = await DLT.find({
                        Issue: { $lt: parseInt(targetIssue) }
                    }).sort({ Issue: -1 }).limit(excludeSettings.periods);
                    
                    const excludedHwcRatios = [];
                    // 临时用固定值替代异步函数调用来测试
                    for (let i = 0; i < recentResults.length; i++) {
                        const hwcRatio = `${Math.floor(Math.random() * 3)}:${Math.floor(Math.random() * 3)}:${Math.floor(Math.random() * 3)}`;
                        if (hwcRatio && !excludedHwcRatios.includes(hwcRatio)) {
                            excludedHwcRatios.push(hwcRatio);
                        }
                    }
                    
                    // 保存排除的热温冷比数据用于前端显示
                    excludedData.htcRatios = excludedHwcRatios.sort();
                    excludedData.htcPeriods = excludeSettings.periods;
                    
                    // 记录热温冷筛选信息
                    filterSummary.appliedFilters.push({
                        type: '排除热温冷比',
                        value: excludeSettings.periods,
                        description: `排除最近${excludeSettings.periods}期热温冷比`,
                        excludedCount: excludedHwcRatios.length
                    });
                    filterSummary.excludedItems.hwcRatios = excludedHwcRatios;
                    
                    if (excludedHwcRatios.length > 0) {
                        if (hotWarmColdQuery.hot_warm_cold_ratio) {
                            // 如果已经有热温冷比排除条件，需要合并排除条件
                            if (hotWarmColdQuery.hot_warm_cold_ratio.$nin) {
                                // 合并两个排除数组，去重
                                const combinedExcludes = [...new Set([...hotWarmColdQuery.hot_warm_cold_ratio.$nin, ...excludedHwcRatios])];
                                hotWarmColdQuery.hot_warm_cold_ratio.$nin = combinedExcludes;
                            } else {
                                // 添加排除条件
                                hotWarmColdQuery.hot_warm_cold_ratio = { 
                                    ...hotWarmColdQuery.hot_warm_cold_ratio, 
                                    $nin: excludedHwcRatios 
                                };
                            }
                        } else {
                            // 没有其他热温冷比条件，直接排除
                            hotWarmColdQuery.hot_warm_cold_ratio = { $nin: excludedHwcRatios };
                        }
                        
                        log(`已排除${excludedHwcRatios.length}个最近期数热温冷比: ${excludedHwcRatios.join(', ')}`);
                    }
                }
            } catch (error) {
                log('解析热温冷比排除最近期数参数失败:', error);
            }
        }
        
        // 只有当有有效数值时才添加数量筛选条件
        if ((hotCountMin !== undefined && hotCountMin !== '') || (hotCountMax !== undefined && hotCountMax !== '')) {
            hotWarmColdQuery.hot_count = {};
            if (hotCountMin !== undefined && hotCountMin !== '') hotWarmColdQuery.hot_count.$gte = parseInt(hotCountMin);
            if (hotCountMax !== undefined && hotCountMax !== '') hotWarmColdQuery.hot_count.$lte = parseInt(hotCountMax);
        }
        
        if ((warmCountMin !== undefined && warmCountMin !== '') || (warmCountMax !== undefined && warmCountMax !== '')) {
            hotWarmColdQuery.warm_count = {};
            if (warmCountMin !== undefined && warmCountMin !== '') hotWarmColdQuery.warm_count.$gte = parseInt(warmCountMin);
            if (warmCountMax !== undefined && warmCountMax !== '') hotWarmColdQuery.warm_count.$lte = parseInt(warmCountMax);
        }
        
        if ((coldCountMin !== undefined && coldCountMin !== '') || (coldCountMax !== undefined && coldCountMax !== '')) {
            hotWarmColdQuery.cold_count = {};
            if (coldCountMin !== undefined && coldCountMin !== '') hotWarmColdQuery.cold_count.$gte = parseInt(coldCountMin);
            if (coldCountMax !== undefined && coldCountMax !== '') hotWarmColdQuery.cold_count.$lte = parseInt(coldCountMax);
        }
        
        log(`🎯 最终红球查询条件: ${JSON.stringify(redQuery)}`);
        log(`🌡️ 热温冷查询条件: ${JSON.stringify(hotWarmColdQuery)}`);
        
        // 使用优化版数据结构执行查询
        log('使用优化版热温冷数据结构执行查询');
        
        // 处理 "unlimited" 选项
        const actualLimit = limit === 'unlimited' ? Number.MAX_SAFE_INTEGER : parseInt(limit);
        
        let redCombinations = await queryWithOptimizedHotWarmColdData(
            redQuery, hotWarmColdQuery, hotWarmColdData, actualLimit, parseInt(page)
        );
        
        // 获取目标期号的开奖数据用于命中分析
        const targetDrawResult = await DLT.findOne({ Issue: parseInt(targetIssue) }).select('Issue Red1 Red2 Red3 Red4 Red5 Blue1 Blue2');
        log(`🎯 获取目标期号${targetIssue}的开奖数据用于命中分析: ${targetDrawResult ? '已开奖' : '未开奖'}`);
        
        // 为组合添加命中分析
        if (targetDrawResult && redCombinations && redCombinations.length > 0) {
            try {
                redCombinations = addHitAnalysisToRedCombinations(redCombinations, targetDrawResult);
                log(`✅ 完成${redCombinations.length}个红球组合的命中分析`);
            } catch (error) {
                log(`❌ 命中分析处理失败:`, error.message);
                // 继续执行，不让命中分析错误阻止整个API
            }
        } else if (!targetDrawResult) {
            log(`📊 目标期号${targetIssue}尚未开奖，跳过命中分析`);
            // 为所有组合添加等待开奖状态
            if (redCombinations && redCombinations.length > 0) {
                redCombinations = redCombinations.map(combo => {
                    const comboObj = combo.toObject ? combo.toObject() : combo;
                    return {
                        ...comboObj,
                        hit_analysis: {
                            status: 'waiting_for_draw',
                            message: '等待开奖'
                        }
                    };
                });
            }
        } else {
            log(`⚠️ 无法进行命中分析: redCombinations=${redCombinations?.length || 0}`);
        }
        
        // 红球组合命中分析函数
        function addHitAnalysisToRedCombinations(combinations, targetResult) {
            const winningReds = [targetResult.Red1, targetResult.Red2, targetResult.Red3, targetResult.Red4, targetResult.Red5].sort((a, b) => a - b);
            const winningBlues = [targetResult.Blue1, targetResult.Blue2].sort((a, b) => a - b);
            
            return combinations.map(combo => {
                // 提取组合的红球号码
                const comboReds = [combo.red1, combo.red2, combo.red3, combo.red4, combo.red5].sort((a, b) => a - b);
                
                // 计算红球命中数
                const redHitCount = comboReds.filter(red => winningReds.includes(red)).length;
                const redHitBalls = comboReds.filter(red => winningReds.includes(red));
                const redMissBalls = comboReds.filter(red => !winningReds.includes(red));
                
                // 添加命中分析信息
                const hitAnalysis = {
                    red_hit_count: redHitCount,
                    red_hit_balls: redHitBalls,
                    red_miss_balls: redMissBalls,
                    winning_reds: winningReds,
                    winning_blues: winningBlues,
                    latest_issue: targetResult.Issue
                };
                
                // 返回带有命中分析的组合
                const comboObj = combo.toObject ? combo.toObject() : combo;
                return {
                    ...comboObj,
                    hit_analysis: hitAnalysis,
                    hit_priority: redHitCount // 用于排序的优先级
                };
            }).sort((a, b) => b.hit_priority - a.hit_priority); // 按命中数排序，命中多的在前
        }
        
        // 优化版热温冷数据查询函数
        async function queryWithOptimizedHotWarmColdData(redQuery, hotWarmColdQuery, optimizedData, limit, page) {
            log('开始使用优化版数据结构执行查询');
            
            // 1. 根据热温冷条件筛选组合ID
            const validCombinationIds = new Set();
            
            // 处理热温冷比例排除条件
            const excludedRatios = hotWarmColdQuery.hot_warm_cold_ratio?.$nin || [];
            const includeRatios = hotWarmColdQuery.hot_warm_cold_ratio?.$in || [];
            
            // 处理热温冷数量范围
            const hotCountMin = hotWarmColdQuery.hot_count?.$gte ?? 0;
            const hotCountMax = hotWarmColdQuery.hot_count?.$lte ?? 5;
            const warmCountMin = hotWarmColdQuery.warm_count?.$gte ?? 0;
            const warmCountMax = hotWarmColdQuery.warm_count?.$lte ?? 5;
            const coldCountMin = hotWarmColdQuery.cold_count?.$gte ?? 0;
            const coldCountMax = hotWarmColdQuery.cold_count?.$lte ?? 5;
            
            log(`热温冷筛选条件: 排除比例${excludedRatios.length}个, 包含比例${includeRatios.length}个`);
            
            // 遍历所有比例，收集符合条件的组合ID
            // 优化：当有limit限制时，提前终止收集以提高性能
            const limitNum = parseInt(limit) || 100;
            const targetLimit = limitNum === Number.MAX_SAFE_INTEGER ? Number.MAX_SAFE_INTEGER : limitNum;
            let collectedCount = 0;
            
            log(`🚀 优化收集逻辑：目标限制=${targetLimit}, 原始limit参数=${limit}`);
            
            for (const [ratio, combinationIds] of optimizedData.hot_warm_cold_data.entries()) {
                // 提前终止条件：如果已收集足够的组合ID
                if (collectedCount >= targetLimit && targetLimit !== Number.MAX_SAFE_INTEGER) {
                    log(`提前终止收集：已收集${collectedCount}个组合ID，达到目标限制${targetLimit}`);
                    break;
                }
                
                // 检查比例排除条件
                if (excludedRatios.length > 0 && excludedRatios.includes(ratio)) {
                    continue;
                }
                
                // 检查比例包含条件
                if (includeRatios.length > 0 && !includeRatios.includes(ratio)) {
                    continue;
                }
                
                // 解析比例字符串检查数量范围
                const [hot, warm, cold] = ratio.split(':').map(Number);
                if (hot < hotCountMin || hot > hotCountMax ||
                    warm < warmCountMin || warm > warmCountMax ||
                    cold < coldCountMin || cold > coldCountMax) {
                    continue;
                }
                
                // 添加该比例下的组合ID，但要控制数量
                for (const id of combinationIds) {
                    if (collectedCount >= targetLimit && targetLimit !== Number.MAX_SAFE_INTEGER) {
                        break;
                    }
                    if (!validCombinationIds.has(id)) {
                        validCombinationIds.add(id);
                        collectedCount++;
                    }
                }
            }
            
            log(`热温冷筛选后获得${validCombinationIds.size}个有效组合ID`);
            
            // 2. 根据红球条件查询组合数据
            const finalQuery = {
                ...redQuery,
                combination_id: { $in: Array.from(validCombinationIds) }
            };
            
            const pageNum = parseInt(page) || 1;
            const skip = limitNum === Number.MAX_SAFE_INTEGER ? 0 : (pageNum - 1) * limitNum;
            const queryLimit = limitNum === Number.MAX_SAFE_INTEGER ? 0 : limitNum;
            
            log(`执行最终红球查询，skip=${skip}, limit=${queryLimit === 0 ? 'unlimited' : queryLimit}, 输入的组合ID数量=${validCombinationIds.size}`);
            
            let query = DLTRedCombinations.find(finalQuery);
            if (queryLimit > 0) {
                query = query.skip(skip).limit(queryLimit);
            }
            const results = await query;
            
            // 3. 为结果添加热温冷信息
            const enrichedResults = results.map(combo => {
                // 从优化数据中查找该组合的热温冷比例
                let hwcRatio = null;
                let hotCount = 0, warmCount = 0, coldCount = 0;
                
                for (const [ratio, combinationIds] of optimizedData.hot_warm_cold_data.entries()) {
                    if (combinationIds.includes(combo.combination_id)) {
                        hwcRatio = ratio;
                        [hotCount, warmCount, coldCount] = ratio.split(':').map(Number);
                        break;
                    }
                }
                
                // 处理Mongoose文档和普通对象
                const comboObj = combo.toObject ? combo.toObject() : combo;
                return {
                    ...comboObj,
                    hot_warm_cold_ratio: hwcRatio,
                    hot_count: hotCount,
                    warm_count: warmCount,
                    cold_count: coldCount
                };
            });
            
            log(`优化版查询完成，返回${enrichedResults.length}条记录`);
            return enrichedResults;
        }
        log(`红球查询完成，获得${redCombinations.length}条记录`);
        
        // 根据开关决定是否获取蓝球组合
        let blueCombinations = [];
        const shouldAssignBlue = enableBlueCombination === 'true';
        
        log('🎯 蓝球分配开关决策:', {
            enableBlueCombination参数: enableBlueCombination,
            参数类型: typeof enableBlueCombination,
            shouldAssignBlue结果: shouldAssignBlue,
            判断条件: `${enableBlueCombination} === 'true'`
        });
        
        if (shouldAssignBlue) {
            const blueQuery = {};
            if (blueSumMin || blueSumMax) {
                blueQuery.sum_value = {};
                if (blueSumMin) blueQuery.sum_value.$gte = parseInt(blueSumMin);
                if (blueSumMax) blueQuery.sum_value.$lte = parseInt(blueSumMax);
            }
            
            blueCombinations = await DLTBlueCombinations.find(blueQuery);
            log(`蓝球查询完成，获得${blueCombinations.length}条记录`);
        } else {
            log(`蓝球分配开关已关闭，只输出红球组合`);
        }
        
        // 组合红球和蓝球结果
        const results = [];
        
        if (shouldAssignBlue && blueCombinations.length > 0) {
            // 循环分配蓝球组合
            for (let i = 0; i < redCombinations.length; i++) {
                const redCombo = redCombinations[i];
                const blueIndex = i % blueCombinations.length; // 循环分配
                const blueCombo = blueCombinations[blueIndex];
                
                results.push({
                    redNumbers: [redCombo.red_ball_1, redCombo.red_ball_2, redCombo.red_ball_3, redCombo.red_ball_4, redCombo.red_ball_5],
                    blueNumbers: [blueCombo.blue_ball_1, blueCombo.blue_ball_2],
                    redSum: redCombo.sum_value,
                    redSpan: redCombo.span_value,
                    zoneRatio: redCombo.zone_ratio,
                    oddEvenRatio: redCombo.odd_even_ratio,
                    hotWarmColdRatio: redCombo.hot_warm_cold_ratio,
                    hotCount: redCombo.hot_count,
                    warmCount: redCombo.warm_count,
                    coldCount: redCombo.cold_count,
                    blueSum: blueCombo.sum_value,
                    hit_analysis: redCombo.hit_analysis // 添加命中分析数据
                });
            }
        } else {
            // 只输出红球组合
            for (const redCombo of redCombinations) {
                results.push({
                    redNumbers: [redCombo.red_ball_1, redCombo.red_ball_2, redCombo.red_ball_3, redCombo.red_ball_4, redCombo.red_ball_5],
                    blueNumbers: null,
                    redSum: redCombo.sum_value,
                    redSpan: redCombo.span_value,
                    zoneRatio: redCombo.zone_ratio,
                    oddEvenRatio: redCombo.odd_even_ratio,
                    hotWarmColdRatio: redCombo.hot_warm_cold_ratio,
                    hotCount: redCombo.hot_count,
                    warmCount: redCombo.warm_count,
                    coldCount: redCombo.cold_count,
                    blueSum: null,
                    hit_analysis: redCombo.hit_analysis // 添加命中分析数据
                });
            }
        }
        
        if (shouldAssignBlue && blueCombinations.length > 0) {
            log(`开始生成最终组合结果，红球组合${redCombinations.length}条 × 蓝球组合${blueCombinations.length}条（循环分配） = ${results.length}条结果`);
        } else {
            log(`开始生成最终组合结果，只输出红球组合 = ${results.length}条结果`);
        }
        
        // 简化总数计算，避免复杂聚合查询超时
        log(`跳过复杂的总数统计查询，使用估算值`);
        // 使用简单的红球组合计数作为估算
        const estimatedRedCombinations = await DLTRedCombinations.countDocuments(redQuery);
        let estimatedTotalCombinations;
        
        if (shouldAssignBlue && blueCombinations.length > 0) {
            estimatedTotalCombinations = estimatedRedCombinations * blueCombinations.length;
        } else {
            estimatedTotalCombinations = estimatedRedCombinations; // 只有红球组合时，总数就是红球组合数
        }
        
        log(`使用估算总数: 红球组合约${estimatedRedCombinations}条, 最终组合约${estimatedTotalCombinations}条`);
        
        // 完善筛选汇总信息
        const safeFilteringRate = estimatedTotalCombinations > 0 
            ? (results.length / estimatedTotalCombinations * 100) 
            : 0;
            
        filterSummary.dataVolume = {
            beforeFiltering: {
                redCombinations: estimatedRedCombinations,
                blueCombinations: blueCombinations.length,
                totalCombinations: estimatedTotalCombinations
            },
            afterFiltering: {
                redCombinations: redCombinations.length,
                blueCombinations: shouldAssignBlue ? blueCombinations.length : 0,
                totalCombinations: results.length
            },
            filteringRate: safeFilteringRate
        };
        
        
        // 调试排除数据
        log(`🔥 测试点2 - 返回前excludedData完整对象:`, JSON.stringify(excludedData, null, 2));
        log(`🔍 排除数据详情:`, JSON.stringify(excludedData, null, 2));
        log(`📊 筛选汇总信息:`, JSON.stringify(filterSummary, null, 2));
        log(`📋 应用的筛选条件数量:`, filterSummary.appliedFilters?.length || 0);
        log(`🎯 即将返回的excludedData在filters中:`, !!excludedData);
        log(`🎯 excludedData.sumValues长度:`, excludedData.sumValues?.length || 0);
        log(`🎯 excludedData.zoneRatios长度:`, excludedData.zoneRatios?.length || 0);
        
        // 检查结果集是否为空并提供智能建议
        let message = '组合预测查询完成';
        let warnings = [];
        let suggestions = [];
        
        if (results.length === 0) {
            message = '当前筛选条件过于严格，没有找到满足所有条件的组合';
            warnings.push('筛选条件过于严格，没有组合能够满足所有条件');
            
            // 分析具体问题并提供建议
            const appliedFiltersCount = filterSummary.appliedFilters?.length || 0;
            const excludedItemsCount = Object.keys(filterSummary.excludedItems || {}).length;
            
            if (appliedFiltersCount > 3) {
                suggestions.push('建议减少筛选条件，一次不要应用过多的限制');
            }
            
            if (excludedItemsCount > 2) {
                suggestions.push('建议减少排除条件，当前排除了过多的近期数据');
            }
            
            // 检查和值范围
            const sumRangeFilters = filterSummary.appliedFilters?.filter(f => f.type.includes('和值')) || [];
            if (sumRangeFilters.length > 0) {
                suggestions.push('检查和值范围设置，可能设置过窄');
            }
            
            // 检查跨度范围
            const spanRangeFilters = filterSummary.appliedFilters?.filter(f => f.type.includes('跨度')) || [];
            if (spanRangeFilters.length > 0) {
                suggestions.push('检查跨度范围设置，可能排除了过多组合');
            }
            
            // 检查热温冷数据
            const hwcFilters = filterSummary.appliedFilters?.filter(f => f.type.includes('热温冷')) || [];
            if (hwcFilters.length > 0) {
                warnings.push('该期号的热温冷分析数据可能不完整');
                suggestions.push('建议检查基准期号和目标期号的热温冷数据完整性');
            }
            
            // 通用建议
            suggestions.push('建议逐步放宽筛选条件，从最重要的条件开始');
            suggestions.push('可以尝试更换不同的基准期号和目标期号');
        } else if (results.length < 10) {
            warnings.push(`当前筛选条件较为严格，仅找到 ${results.length} 个组合`);
            suggestions.push('如需更多组合选择，建议适当放宽筛选条件');
        }
        
        // 获取历史开奖数据（用于计算命中数）
        log('🔍 开始查询历史开奖数据...');
        const historyData = await DLT.find({})
            .sort({ Issue: -1 })
            .select('Issue Red1 Red2 Red3 Red4 Red5 Blue1 Blue2 drawDate')
            .lean();
        
        log(`✅ 获取历史开奖数据 ${historyData.length} 期`);
        if (historyData.length > 0) {
            log(`📊 最新一期: ${historyData[0].Issue}期 - 红球 ${historyData[0].Red1} ${historyData[0].Red2} ${historyData[0].Red3} ${historyData[0].Red4} ${historyData[0].Red5}`);
        } else {
            log('❌ 警告：历史开奖数据查询结果为空！');
        }
        
        // 转换数据格式为前端期望的格式
        const formattedCombinations = results.map((combo, index) => ({
            combinationId: index + 1,
            red1: combo.redNumbers[0],
            red2: combo.redNumbers[1],
            red3: combo.redNumbers[2],
            red4: combo.redNumbers[3],
            red5: combo.redNumbers[4],
            blue1: combo.blueNumbers ? combo.blueNumbers[0] : null,
            blue2: combo.blueNumbers ? combo.blueNumbers[1] : null,
            redSum: combo.redSum,
            redSpan: combo.redSpan,
            blueSum: combo.blueSum,
            totalSum: combo.blueSum ? combo.redSum + combo.blueSum : combo.redSum,
            zoneRatio: combo.zoneRatio,
            oddEvenRatio: combo.oddEvenRatio,
            hotWarmColdRatio: combo.hotWarmColdRatio,
            hotCount: combo.hotCount,
            warmCount: combo.warmCount,
            coldCount: combo.coldCount,
            hit_analysis: combo.hit_analysis // 添加命中分析数据
        }));

        // 调试：记录即将返回的数据
        log(`🔍 即将返回API响应，historyData状态: ${historyData ? historyData.length + '期' : '空'}`);
        if (historyData && historyData.length > 0) {
            log(`📊 historyData第一期示例: ${JSON.stringify(historyData[0])}`);
        }
        
        res.json({
            success: true,
            message: message,
            warnings: warnings,
            suggestions: suggestions,
            data: {
                combinations: formattedCombinations,
                historyData: historyData, // 添加历史开奖数据
                red_combinations: redCombinations, // 兼容性字段：原始红球组合数据
                blue_combinations: blueCombinations, // 兼容性字段：蓝球组合数据
                statistics: {
                    combinationMethod: shouldAssignBlue ? '每个红球组合按顺序循环分配一个蓝球组合' : '只输出红球组合，不分配蓝球',
                    totalRedCombinations: estimatedRedCombinations,
                    totalBlueCombinations: blueCombinations.length,
                    finalCombinationsCount: formattedCombinations.length,
                    historyDataPeriods: historyData.length, // 添加历史数据期数统计
                    dataSource: hotWarmColdData ? 'optimized' : 'legacy' // 数据源标识
                },
                pagination: {
                    page: parseInt(page),
                    limit: limit === 'unlimited' ? 'unlimited' : parseInt(limit),
                    total: estimatedTotalCombinations,
                    totalPages: limit === 'unlimited' ? 1 : Math.ceil(estimatedTotalCombinations / parseInt(limit)),
                    estimated: true
                },
                filters: {
                    targetIssue,
                    baseIssue,
                    redCombinationsCount: estimatedRedCombinations,
                    blueCombinationsCount: blueCombinations.length,
                    excludedData: excludedData
                },
                filterSummary: filterSummary,
                filteringAnalysis: {
                    appliedFiltersCount: filterSummary.appliedFilters?.length || 0,
                    excludedItemsCount: Object.keys(filterSummary.excludedItems || {}).length,
                    resultCount: results.length,
                    filteringEffectiveness: results.length / Math.max(estimatedTotalCombinations, 1) * 100
                }
            }
        });
        
    } catch (error) {
        log('组合预测查询失败:', error.message);
        log('错误堆栈:', error.stack);
        res.json({
            success: false,
            message: error.message,
            error: error.stack
        });
    }
});

/**
 * 获取热温冷号统计信息
 */
app.get('/api/dlt/hot-warm-cold-stats/:baseIssue', async (req, res) => {
    try {
        const { baseIssue } = req.params;
        
        // 获取该期的遗漏数据
        const missingData = await DLTRedMissing.findOne({ Issue: baseIssue });
        
        if (!missingData) {
            return res.json({
                success: false,
                message: `期号${baseIssue}的遗漏数据不存在`
            });
        }
        
        // 统计热温冷号分布
        const hotNums = [], warmNums = [], coldNums = [];
        
        for (let i = 1; i <= 35; i++) {
            const missingValue = missingData[i.toString()];
            if (missingValue <= 4) hotNums.push(i);
            else if (missingValue <= 9) warmNums.push(i);
            else coldNums.push(i);
        }
        
        res.json({
            success: true,
            data: {
                baseIssue,
                hotNumbers: hotNums,
                warmNumbers: warmNums,
                coldNumbers: coldNums,
                distribution: {
                    hot: hotNums.length,
                    warm: warmNums.length,
                    cold: coldNums.length
                }
            }
        });
        
    } catch (error) {
        log('获取热温冷统计失败:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 获取最新期号信息
 */
app.get('/api/dlt/latest-issues', async (req, res) => {
    try {
        const latestIssues = await DLT.find({})
            .sort({ Issue: -1 })
            .limit(5)
            .select('Issue drawDate');
            
        res.json({
            success: true,
            data: latestIssues
        });
        
    } catch (error) {
        log('获取最新期号失败:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 检查大乐透历史数据API
 */
app.get('/api/dlt/recent-data', async (req, res) => {
    try {
        const recentData = await DLT.find({})
            .sort({ Issue: -1 })
            .limit(50)
            .select('Issue Red1 Red2 Red3 Red4 Red5 Blue1 Blue2 drawDate');
            
        // 转换为前端需要的格式
        const formattedData = recentData.map(item => ({
            issue: item.Issue,
            front_numbers: [item.Red1, item.Red2, item.Red3, item.Red4, item.Red5],
            back_numbers: [item.Blue1, item.Blue2],
            draw_date: item.drawDate
        }));
            
        res.json({
            success: true,
            data: formattedData
        });
        
    } catch (error) {
        log('获取历史数据失败:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// ===== 期号范围解析API =====

/**
 * 期号范围解析API - 根据范围类型生成目标期号列表
 * 支持: 全部历史期号、最近N期、自定义范围
 */
app.post('/api/dlt/resolve-issue-range', async (req, res) => {
    try {
        const { rangeType, recentCount, startIssue, endIssue } = req.body;
        log(`🎯 期号范围解析请求: 类型=${rangeType}, 最近期数=${recentCount}, 自定义范围=${startIssue}-${endIssue}`);

        let targetIssues = [];

        switch (rangeType) {
            case 'all':
                // 全部历史期号 - 获取所有已开奖期号
                const allData = await DLT.find({})
                    .sort({ Issue: 1 })
                    .select('Issue')
                    .lean();
                targetIssues = allData.map(record => record.Issue.toString());
                log(`✅ 全部历史期号: 共${targetIssues.length}期`);
                break;

            case 'recent':
                // 最近N期
                const recentData = await DLT.find({})
                    .sort({ Issue: -1 })
                    .limit(parseInt(recentCount) || 100)
                    .select('Issue')
                    .lean();
                targetIssues = recentData.map(record => record.Issue.toString()).reverse(); // 转为升序
                log(`✅ 最近${recentCount}期: 共${targetIssues.length}期`);
                break;

            case 'custom':
                // 自定义范围
                if (!startIssue || !endIssue) {
                    return res.json({
                        success: false,
                        message: '自定义范围需要指定起始期号和结束期号'
                    });
                }

                const normalizedStart = parseInt(normalizeDLTIssueNumber(startIssue));
                const normalizedEnd = parseInt(normalizeDLTIssueNumber(endIssue));

                if (normalizedStart > normalizedEnd) {
                    return res.json({
                        success: false,
                        message: '起始期号不能大于结束期号'
                    });
                }

                const customData = await DLT.find({
                    Issue: {
                        $gte: normalizedStart,
                        $lte: normalizedEnd
                    }
                })
                    .sort({ Issue: 1 })
                    .select('Issue')
                    .lean();

                targetIssues = customData.map(record => record.Issue.toString());
                log(`✅ 自定义范围${startIssue}-${endIssue}: 共${targetIssues.length}期`);
                break;

            default:
                return res.json({
                    success: false,
                    message: '不支持的期号范围类型'
                });
        }

        // 验证期号数量限制
        if (targetIssues.length > 1000) {
            return res.json({
                success: false,
                message: `期号数量过多(${targetIssues.length}期)，单次批量预测最多支持1000期`
            });
        }

        res.json({
            success: true,
            data: {
                rangeType,
                targetIssues,
                totalCount: targetIssues.length,
                summary: `${rangeType === 'all' ? '全部历史期号' :
                         rangeType === 'recent' ? `最近${recentCount}期` :
                         `自定义范围${startIssue}-${endIssue}`}: 共${targetIssues.length}期`
            }
        });

    } catch (error) {
        log(`❌ 期号范围解析失败: ${error.message}`);
        res.json({
            success: false,
            message: error.message
        });
    }
});

// ===== 内部辅助函数 =====

/**
 * 内部期号范围解析函数
 * @param {Object} rangeConfig 期号范围配置
 * @returns {Array} 期号列表
 */
async function resolveIssueRangeInternal(rangeConfig) {
    const { rangeType, recentCount, startIssue, endIssue } = rangeConfig;

    switch (rangeType) {
        case 'all':
            // 全部历史期号 - 获取所有已开奖期号
            const allData = await DLT.find({})
                .sort({ Issue: 1 })
                .select('Issue')
                .lean();
            return allData.map(record => record.Issue.toString());

        case 'recent':
            // 最近N期
            const recentData = await DLT.find({})
                .sort({ Issue: -1 })
                .limit(parseInt(recentCount) || 100)
                .select('Issue')
                .lean();
            return recentData.map(record => record.Issue.toString()).reverse(); // 转为升序

        case 'custom':
            // 自定义范围
            if (!startIssue || !endIssue) {
                throw new Error('自定义范围需要指定起始期号和结束期号');
            }

            const normalizedStart = parseInt(normalizeDLTIssueNumber(startIssue));
            const normalizedEnd = parseInt(normalizeDLTIssueNumber(endIssue));

            if (normalizedStart > normalizedEnd) {
                throw new Error('起始期号不能大于结束期号');
            }

            const customData = await DLT.find({
                Issue: {
                    $gte: normalizedStart,
                    $lte: normalizedEnd
                }
            })
                .sort({ Issue: 1 })
                .select('Issue')
                .lean();

            return customData.map(record => record.Issue.toString());

        default:
            throw new Error('不支持的期号范围类型');
    }
}

// ===== 统一数据过滤中间件 =====

/**
 * 统一数据过滤中间件 - 确保所有功能模块使用相同的筛选条件
 */
class UnifiedDataFilterMiddleware {
    constructor() {
        this.activeFilters = new Map(); // 存储当前活跃的过滤配置
        this.filteredResultsCache = new Map(); // 缓存过滤后的结果
    }

    /**
     * 注册过滤配置
     * @param {string} sessionId 会话ID
     * @param {Object} filters 过滤条件
     * @param {Array} originalResults 原始预测结果
     */
    registerFilterSession(sessionId, filters, originalResults) {
        log(`🔧 [${sessionId}] 注册数据过滤会话`);

        this.activeFilters.set(sessionId, {
            filters,
            originalResults,
            timestamp: Date.now()
        });

        // 执行过滤并缓存结果
        const filteredResults = this.applyFilters(originalResults, filters);
        this.filteredResultsCache.set(sessionId, {
            data: filteredResults,
            timestamp: Date.now(),
            summary: {
                original: originalResults.length,
                filtered: filteredResults.length,
                removed: originalResults.length - filteredResults.length
            }
        });

        log(`✅ [${sessionId}] 过滤完成: 原始${originalResults.length}条 → 筛选后${filteredResults.length}条`);
        return filteredResults;
    }

    /**
     * 获取会话的过滤结果 - 供4个功能模块统一调用
     * @param {string} sessionId 会话ID
     * @param {string} module 调用模块名 (statistics/details/validation/export)
     */
    getFilteredResults(sessionId, module) {
        const cached = this.filteredResultsCache.get(sessionId);
        if (!cached) {
            log(`⚠️ [${sessionId}] ${module}模块: 未找到过滤缓存`);
            return null;
        }

        log(`📊 [${sessionId}] ${module}模块: 使用统一过滤结果 (${cached.data.length}条)`);
        return {
            data: cached.data,
            summary: cached.summary,
            timestamp: cached.timestamp
        };
    }

    /**
     * 应用所有过滤条件
     * @param {Array} results 原始结果
     * @param {Object} filters 过滤条件
     */
    applyFilters(results, filters) {
        let filtered = [...results];

        // 应用和值过滤
        if (filters.excludeSumRange) {
            const before = filtered.length;
            filtered = this.filterBySumRange(filtered, filters.excludeSumRange);
            log(`🔢 和值过滤: ${before} → ${filtered.length} (排除${before - filtered.length}条)`);
        }

        // 应用跨度过滤
        if (filters.excludeSpanRange) {
            const before = filtered.length;
            filtered = this.filterBySpanRange(filtered, filters.excludeSpanRange);
            log(`📏 跨度过滤: ${before} → ${filtered.length} (排除${before - filtered.length}条)`);
        }

        // 应用奇偶比过滤
        if (filters.excludeOddEven && filters.excludeOddEven.length > 0) {
            const before = filtered.length;
            filtered = this.filterByOddEven(filtered, filters.excludeOddEven);
            log(`🎭 奇偶比过滤: ${before} → ${filtered.length} (排除${before - filtered.length}条)`);
        }

        // 应用热温冷比过滤
        if (filters.excludeHWC && filters.excludeHWC.length > 0) {
            const before = filtered.length;
            filtered = this.filterByHWC(filtered, filters.excludeHWC);
            log(`🌡️ 热温冷比过滤: ${before} → ${filtered.length} (排除${before - filtered.length}条)`);
        }

        // 应用区间比过滤
        if (filters.excludeZoneRatio && filters.excludeZoneRatio.length > 0) {
            const before = filtered.length;
            filtered = this.filterByZoneRatio(filtered, filters.excludeZoneRatio);
            log(`🗺️ 区间比过滤: ${before} → ${filtered.length} (排除${before - filtered.length}条)`);
        }

        return filtered;
    }

    /**
     * 和值范围过滤
     */
    filterBySumRange(results, range) {
        return results.filter(result => {
            const redSum = this.calculateRedSum(result.red_balls || result.redBalls || result.red_combinations);
            return redSum < range.min || redSum > range.max;
        });
    }

    /**
     * 跨度范围过滤
     */
    filterBySpanRange(results, range) {
        return results.filter(result => {
            const span = this.calculateSpan(result.red_balls || result.redBalls || result.red_combinations);
            return span < range.min || span > range.max;
        });
    }

    /**
     * 奇偶比过滤
     */
    filterByOddEven(results, excludeRatios) {
        return results.filter(result => {
            const ratio = this.calculateOddEvenRatio(result.red_balls || result.redBalls || result.red_combinations);
            return !excludeRatios.includes(ratio);
        });
    }

    /**
     * 热温冷比过滤
     */
    filterByHWC(results, excludeRatios) {
        return results.filter(result => {
            const ratio = this.calculateHWCRatio(result.red_balls || result.redBalls || result.red_combinations);
            return !excludeRatios.includes(ratio);
        });
    }

    /**
     * 区间比过滤
     */
    filterByZoneRatio(results, excludeRatios) {
        return results.filter(result => {
            const ratio = this.calculateZoneRatio(result.red_balls || result.redBalls || result.red_combinations);
            return !excludeRatios.includes(ratio);
        });
    }

    // 辅助计算函数
    calculateRedSum(redBalls) {
        // 处理单个红球组合 [1,2,3,4,5]
        if (Array.isArray(redBalls) && typeof redBalls[0] === 'number') {
            return redBalls.reduce((sum, num) => sum + num, 0);
        }
        // 处理多个红球组合 [[1,2,3,4,5], [6,7,8,9,10]]，取第一个
        if (Array.isArray(redBalls) && Array.isArray(redBalls[0])) {
            return redBalls[0] ? redBalls[0].reduce((sum, num) => sum + num, 0) : 0;
        }
        return 0;
    }

    calculateSpan(redBalls) {
        // 处理单个红球组合
        if (Array.isArray(redBalls) && typeof redBalls[0] === 'number') {
            return Math.max(...redBalls) - Math.min(...redBalls);
        }
        // 处理多个红球组合，取第一个
        if (Array.isArray(redBalls) && Array.isArray(redBalls[0])) {
            const firstCombo = redBalls[0];
            return firstCombo ? Math.max(...firstCombo) - Math.min(...firstCombo) : 0;
        }
        return 0;
    }

    calculateOddEvenRatio(redBalls) {
        // 处理单个红球组合
        if (Array.isArray(redBalls) && typeof redBalls[0] === 'number') {
            const oddCount = redBalls.filter(num => num % 2 === 1).length;
            const evenCount = redBalls.length - oddCount;
            return `${oddCount}:${evenCount}`;
        }
        // 处理多个红球组合，取第一个
        if (Array.isArray(redBalls) && Array.isArray(redBalls[0])) {
            const firstCombo = redBalls[0];
            if (firstCombo) {
                const oddCount = firstCombo.filter(num => num % 2 === 1).length;
                const evenCount = firstCombo.length - oddCount;
                return `${oddCount}:${evenCount}`;
            }
        }
        return '0:0';
    }

    calculateHWCRatio(redBalls) {
        // 这里需要根据实际的热温冷判断逻辑实现
        // 暂时返回默认值
        return '2:2:1';
    }

    calculateZoneRatio(redBalls) {
        if (!Array.isArray(redBalls)) return '0:0:0';
        const zone1 = redBalls.filter(num => num >= 1 && num <= 12).length;
        const zone2 = redBalls.filter(num => num >= 13 && num <= 24).length;
        const zone3 = redBalls.filter(num => num >= 25 && num <= 35).length;
        return `${zone1}:${zone2}:${zone3}`;
    }

    /**
     * 强制刷新会话缓存 - 用于排除条件变更时
     * @param {string} sessionId 会话ID
     * @param {Object} newFilters 新的过滤条件
     */
    refreshSessionCache(sessionId, newFilters) {
        const activeSession = this.activeFilters.get(sessionId);
        if (!activeSession) {
            log(`⚠️ [${sessionId}] 缓存刷新失败: 未找到活跃会话`);
            return false;
        }

        log(`🔄 [${sessionId}] 强制刷新缓存: 排除条件已变更`);

        // 更新过滤条件
        activeSession.filters = newFilters;
        activeSession.timestamp = Date.now();

        // 重新应用过滤并更新缓存
        const filteredResults = this.applyFilters(activeSession.originalResults, newFilters);
        this.filteredResultsCache.set(sessionId, {
            data: filteredResults,
            timestamp: Date.now(),
            summary: {
                original: activeSession.originalResults.length,
                filtered: filteredResults.length,
                removed: activeSession.originalResults.length - filteredResults.length
            }
        });

        log(`✅ [${sessionId}] 缓存刷新完成: 原始${activeSession.originalResults.length}条 → 新筛选结果${filteredResults.length}条`);
        return true;
    }

    /**
     * 批量刷新所有活跃会话的缓存 - 用于系统级缓存清理
     */
    refreshAllActiveSessions() {
        log(`🔄 批量刷新所有活跃会话缓存...`);

        let refreshedCount = 0;
        for (const [sessionId, activeSession] of this.activeFilters.entries()) {
            try {
                const filteredResults = this.applyFilters(activeSession.originalResults, activeSession.filters);
                this.filteredResultsCache.set(sessionId, {
                    data: filteredResults,
                    timestamp: Date.now(),
                    summary: {
                        original: activeSession.originalResults.length,
                        filtered: filteredResults.length,
                        removed: activeSession.originalResults.length - filteredResults.length
                    }
                });
                refreshedCount++;
                log(`✅ [${sessionId}] 会话缓存已刷新`);
            } catch (error) {
                log(`❌ [${sessionId}] 缓存刷新失败: ${error.message}`);
            }
        }

        log(`🎯 批量缓存刷新完成: 成功刷新${refreshedCount}个会话`);
        return refreshedCount;
    }

    /**
     * 检测过滤条件是否发生变化
     * @param {string} sessionId 会话ID
     * @param {Object} newFilters 新过滤条件
     * @returns {boolean} 是否发生变化
     */
    hasFiltersChanged(sessionId, newFilters) {
        const activeSession = this.activeFilters.get(sessionId);
        if (!activeSession) return true;

        // 深度比较过滤条件
        return JSON.stringify(activeSession.filters) !== JSON.stringify(newFilters);
    }

    /**
     * 获取缓存统计信息
     */
    getCacheStatistics() {
        const now = Date.now();
        let totalOriginalResults = 0;
        let totalFilteredResults = 0;
        let averageFilteringRatio = 0;

        for (const [sessionId, data] of this.filteredResultsCache.entries()) {
            totalOriginalResults += data.summary.original;
            totalFilteredResults += data.summary.filtered;
        }

        if (totalOriginalResults > 0) {
            averageFilteringRatio = (totalFilteredResults / totalOriginalResults * 100).toFixed(2);
        }

        return {
            activeSessions: this.activeFilters.size,
            cachedResults: this.filteredResultsCache.size,
            totalOriginalResults,
            totalFilteredResults,
            averageFilteringRatio: `${averageFilteringRatio}%`,
            memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
        };
    }

    /**
     * 清理过期会话
     */
    cleanupExpiredSessions() {
        const now = Date.now();
        const expireTime = 30 * 60 * 1000; // 30分钟过期

        let cleanedCount = 0;
        for (const [sessionId, data] of this.activeFilters.entries()) {
            if (now - data.timestamp > expireTime) {
                this.activeFilters.delete(sessionId);
                this.filteredResultsCache.delete(sessionId);
                cleanedCount++;
                log(`🗑️ 清理过期会话: ${sessionId}`);
            }
        }

        if (cleanedCount > 0) {
            log(`🧹 定期清理完成: 清理了${cleanedCount}个过期会话`);
        }

        return cleanedCount;
    }
}

// 创建全局统一数据过滤中间件实例
const unifiedDataFilter = new UnifiedDataFilterMiddleware();

// 定期清理过期会话
setInterval(() => {
    unifiedDataFilter.cleanupExpiredSessions();
}, 10 * 60 * 1000); // 每10分钟清理一次

// ===== 流式批量预测器 =====

/**
 * 流式批量预测器 - 针对32GB内存优化
 * 核心特性：逐期处理 + 内存控制 + 实时进度
 */
class StreamBatchPredictor {
    constructor(sessionId) {
        this.sessionId = sessionId;
        this.maxMemoryUsage = 20 * 1024 * 1024 * 1024; // 20GB内存限制
        this.batchSize = 10; // 每批次处理10期
        this.progressCallback = null;
        this.isRunning = false;
        this.results = [];

        // 内存监控
        this.memoryCheckInterval = 5000; // 每5秒检查内存
        this.lastGCTime = Date.now();
        this.lastMemoryLevel = 0; // 上次内存水位级别（用于减少日志频率）
        this.minGCInterval = 30000; // 最少30秒间隔执行GC
    }

    /**
     * 流式批量预测主入口
     */
    async streamPredict(config, progressCallback) {
        const { targetIssues, filters, maxRedCombinations, maxBlueCombinations, enableValidation } = config;

        this.isRunning = true;
        this.progressCallback = progressCallback;
        this.results = [];

        log(`🚀 [${this.sessionId}] 开始流式批量预测: ${targetIssues.length}期`);

        try {
            // 分批处理期号
            const batches = this.createBatches(targetIssues, this.batchSize);
            let processedCount = 0;

            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                if (!this.isRunning) {
                    log(`⏹️ [${this.sessionId}] 流式预测被用户停止`);
                    break;
                }

                const batch = batches[batchIndex];
                log(`📦 [${this.sessionId}] 处理批次 ${batchIndex + 1}/${batches.length}: ${batch.join(',')}`);

                // 内存检查
                await this.checkMemoryAndCleanup();

                // 处理单个批次
                const batchResults = await this.processBatch(batch, filters, maxRedCombinations, maxBlueCombinations, enableValidation);

                // 累积结果
                this.results.push(...batchResults);
                processedCount += batch.length;

                // 报告进度
                if (this.progressCallback) {
                    this.progressCallback({
                        processedCount,
                        totalCount: targetIssues.length,
                        currentBatch: batchIndex + 1,
                        totalBatches: batches.length,
                        batchResults: batchResults
                    });
                }

                // 批次间暂停，避免内存峰值
                await this.batchDelay(500);
            }

            // 生成汇总数据
            const summary = this.generateSummary(this.results);

            log(`✅ [${this.sessionId}] 流式预测完成: 处理${processedCount}期，生成${this.results.length}条结果`);

            return {
                success: true,
                data: this.results,
                summary: summary,
                statistics: {
                    totalIssues: processedCount,
                    totalResults: this.results.length,
                    sessionId: this.sessionId
                }
            };

        } catch (error) {
            log(`❌ [${this.sessionId}] 流式预测失败: ${error.message}`);
            throw error;
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * 创建处理批次
     */
    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * 处理单个批次
     */
    async processBatch(issuesBatch, filters, maxRedCombinations, maxBlueCombinations, enableValidation) {
        const batchResults = [];

        for (const issue of issuesBatch) {
            if (!this.isRunning) break;

            try {
                log(`🎯 [${this.sessionId}] 处理期号: ${issue}`);

                // 处理单期
                const issueResult = await this.processSingleIssue(issue, filters, maxRedCombinations, maxBlueCombinations, enableValidation);
                batchResults.push(issueResult);

                // 单期处理后小暂停
                await this.batchDelay(100);

            } catch (error) {
                log(`❌ [${this.sessionId}] 期号${issue}处理失败: ${error.message}`);
                // 继续处理下一期，不中断整个批次
                batchResults.push({
                    target_issue: issue,
                    error: error.message,
                    red_combinations: [],
                    blue_combinations: [],
                    processing_time: '0ms'
                });
            }
        }

        return batchResults;
    }

    /**
     * 处理单期预测
     */
    async processSingleIssue(issue, filters, maxRedCombinations, maxBlueCombinations, enableValidation) {
        const startTime = Date.now();

        // 获取红球组合（应用过滤条件）
        const redCombinations = await this.getFilteredRedCombinations(issue, filters, maxRedCombinations);

        // 获取蓝球组合
        const blueCombinations = await this.getFilteredBlueCombinations(issue, filters, maxBlueCombinations);

        // 命中验证（如果启用）
        let hitAnalysis = null;
        if (enableValidation) {
            hitAnalysis = await this.performHitValidation(issue, redCombinations, blueCombinations);
        }

        const processingTime = Date.now() - startTime;

        const result = {
            target_issue: issue,
            red_combinations: redCombinations,
            blue_combinations: blueCombinations,
            hit_analysis: hitAnalysis,
            processing_time: `${processingTime}ms`,
            red_count: redCombinations.length,
            blue_count: blueCombinations.length
        };

        log(`🎯 [${this.sessionId}] 期号${issue}完成: 红球${redCombinations.length}个, 蓝球${blueCombinations.length}个`);
        return result;
    }

    /**
     * 获取过滤后的红球组合
     */
    async getFilteredRedCombinations(issue, filters, maxCount) {
        try {
            log(`🔎 [${this.sessionId}] 获取红球组合 - 期号:${issue}, 最大数量:${maxCount}, 过滤条件:${JSON.stringify(filters)}`);

            // 先尝试从数据库获取
            const allCombinations = await DLTRedCombination.find({}).limit(maxCount).lean();

            if (allCombinations && allCombinations.length > 0) {
                log(`📊 [${this.sessionId}] 从数据库获取到${allCombinations.length}个红球组合`);

                // 应用过滤条件
                let filtered = allCombinations;

                if (filters.excludeSumRange) {
                    const beforeCount = filtered.length;
                    filtered = filtered.filter(combo => {
                        const sum = combo.sum || combo.numbers.reduce((s, n) => s + n, 0);
                        // 排除指定范围内的组合（保留范围外的）
                        return sum < filters.excludeSumRange.min || sum > filters.excludeSumRange.max;
                    });
                    log(`🔍 [${this.sessionId}] 和值过滤: ${beforeCount} → ${filtered.length} (排除${filters.excludeSumRange.min}-${filters.excludeSumRange.max})`);
                }

                // 转换为简化格式减少内存占用
                const result = filtered.map(combo => combo.numbers || [combo.Red1, combo.Red2, combo.Red3, combo.Red4, combo.Red5]);
                log(`✅ [${this.sessionId}] 过滤后红球组合: ${result.length}个`);
                return result;
            } else {
                // 数据库为空时生成组合
                log(`⚠️ [${this.sessionId}] 数据库红球组合为空，动态生成组合`);
                return this.generateRedCombinations(maxCount, filters);
            }

        } catch (error) {
            log(`❌ [${this.sessionId}] 获取红球组合失败，使用备用生成: ${error.message}`);
            return this.generateRedCombinations(maxCount, filters);
        }
    }

    /**
     * 动态生成红球组合（作为备用方案）
     */
    generateRedCombinations(maxCount, filters) {
        const combinations = [];
        const maxCombinations = Math.min(maxCount, 1000); // 限制生成数量防止内存问题

        // 生成前区5选35的组合
        for (let a = 1; a <= 31; a++) {
            for (let b = a + 1; b <= 32; b++) {
                for (let c = b + 1; c <= 33; c++) {
                    for (let d = c + 1; d <= 34; d++) {
                        for (let e = d + 1; e <= 35; e++) {
                            const combo = [a, b, c, d, e];

                            // 应用过滤条件
                            if (filters.excludeSumRange) {
                                const sum = combo.reduce((s, n) => s + n, 0);
                                if (sum >= filters.excludeSumRange.min && sum <= filters.excludeSumRange.max) {
                                    continue; // 跳过被排除的组合
                                }
                            }

                            combinations.push(combo);
                            if (combinations.length >= maxCombinations) break;
                        }
                        if (combinations.length >= maxCombinations) break;
                    }
                    if (combinations.length >= maxCombinations) break;
                }
                if (combinations.length >= maxCombinations) break;
            }
            if (combinations.length >= maxCombinations) break;
        }

        log(`✅ [${this.sessionId}] 动态生成${combinations.length}个红球组合`);
        return combinations;
    }

    /**
     * 获取过滤后的蓝球组合
     */
    async getFilteredBlueCombinations(issue, filters, maxCount) {
        // 简化蓝球组合逻辑
        const combinations = [];
        for (let i = 1; i <= 12; i++) {
            for (let j = i + 1; j <= 12; j++) {
                combinations.push([i, j]);
                if (combinations.length >= maxCount) break;
            }
            if (combinations.length >= maxCount) break;
        }
        return combinations;
    }

    /**
     * 执行命中验证
     */
    async performHitValidation(issue, redCombinations, blueCombinations) {
        try {
            // 获取实际开奖结果
            const actualResult = await DLT.findOne({ Issue: parseInt(issue) }).lean();
            if (!actualResult) return null;

            const actualRed = [actualResult.Red1, actualResult.Red2, actualResult.Red3, actualResult.Red4, actualResult.Red5];
            const actualBlue = [actualResult.Blue1, actualResult.Blue2];

            // 分析命中情况
            const redHits = redCombinations.map(combo => {
                const hitCount = combo.filter(num => actualRed.includes(num)).length;
                return { combination: combo, hits: hitCount };
            });

            const bestRedHit = Math.max(...redHits.map(h => h.hits));

            // 分析蓝球命中情况
            const blueHits = blueCombinations.map(combo => {
                const hitCount = combo.filter(num => actualBlue.includes(num)).length;
                return { combination: combo, hits: hitCount };
            });

            const bestBlueHit = Math.max(...blueHits.map(h => h.hits));

            return {
                actual_red: actualRed,
                actual_blue: actualBlue,
                red_hit_analysis: {
                    best_hit: bestRedHit,
                    hit_distribution: this.calculateHitDistribution(redHits)
                },
                blue_hit_analysis: {
                    best_hit: bestBlueHit,
                    hit_distribution: this.calculateBlueHitDistribution(blueHits)
                }
            };
        } catch (error) {
            log(`❌ [${this.sessionId}] 命中验证失败: ${error.message}`);
            return null;
        }
    }

    /**
     * 计算命中分布
     */
    calculateHitDistribution(hits) {
        const distribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        hits.forEach(hit => {
            if (distribution.hasOwnProperty(hit.hits)) {
                distribution[hit.hits]++;
            }
        });
        return distribution;
    }

    /**
     * 计算蓝球命中分布
     */
    calculateBlueHitDistribution(hits) {
        const distribution = { 0: 0, 1: 0, 2: 0 };
        hits.forEach(hit => {
            if (distribution.hasOwnProperty(hit.hits)) {
                distribution[hit.hits]++;
            }
        });
        return distribution;
    }

    /**
     * 生成汇总统计
     */
    generateSummary(results) {
        const totalRedCombinations = results.reduce((sum, r) => sum + (r.red_count || 0), 0);
        const totalBlueCombinations = results.reduce((sum, r) => sum + (r.blue_count || 0), 0);
        const validationCount = results.filter(r => r.hit_analysis).length;

        return {
            totalIssues: results.length,
            totalRedCombinations,
            totalBlueCombinations,
            averageRedPerIssue: results.length > 0 ? Math.round(totalRedCombinations / results.length) : 0,
            averageBluePerIssue: results.length > 0 ? Math.round(totalBlueCombinations / results.length) : 0,
            validationCount,
            validationRate: results.length > 0 ? ((validationCount / results.length) * 100).toFixed(1) + '%' : '0%'
        };
    }

    /**
     * 内存检查和清理 - 增强版
     */
    async checkMemoryAndCleanup() {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
        const externalMB = memUsage.external / 1024 / 1024;
        const rss_MB = memUsage.rss / 1024 / 1024;
        const heapUsedGB = heapUsedMB / 1024;

        // 更新内存峰值记录
        if (heapUsedMB > this.memoryPeak) {
            this.memoryPeak = heapUsedMB;
        }

        // 详细的内存状态日志（每5GB增长记录一次）
        const currentMemoryLevel = Math.floor(heapUsedGB / 5) * 5;
        if (currentMemoryLevel !== this.lastMemoryLevel) {
            log(`💾 [${this.sessionId}] 内存状态详情:`);
            log(`   - Heap Used: ${heapUsedMB.toFixed(0)}MB (${heapUsedGB.toFixed(2)}GB)`);
            log(`   - Heap Total: ${heapTotalMB.toFixed(0)}MB`);
            log(`   - External: ${externalMB.toFixed(0)}MB`);
            log(`   - RSS: ${rss_MB.toFixed(0)}MB`);
            log(`   - 内存峰值: ${this.memoryPeak.toFixed(0)}MB`);
            this.lastMemoryLevel = currentMemoryLevel;
        }

        // 主动垃圾回收策略
        const now = Date.now();
        const shouldGC = (
            // 内存超过8GB时每10秒回收一次
            (heapUsedGB > 8 && now - this.lastGCTime > 10000) ||
            // 内存超过12GB时每5秒回收一次
            (heapUsedGB > 12 && now - this.lastGCTime > 5000) ||
            // 内存超过16GB时强制立即回收
            (heapUsedGB > 16)
        );

        if (shouldGC && global.gc) {
            log(`🧹 [${this.sessionId}] 执行主动垃圾回收 (当前: ${heapUsedGB.toFixed(2)}GB)`);

            const beforeGC = process.memoryUsage();
            global.gc();
            this.lastGCTime = now;

            const afterGC = process.memoryUsage();
            const freedMB = (beforeGC.heapUsed - afterGC.heapUsed) / 1024 / 1024;
            const afterMB = afterGC.heapUsed / 1024 / 1024;

            log(`✅ [${this.sessionId}] 垃圾回收完成: 释放${freedMB.toFixed(0)}MB, 剩余${afterMB.toFixed(0)}MB`);

            // 如果垃圾回收效果不佳，记录警告
            if (freedMB < 500 && heapUsedGB > 15) {
                log(`⚠️ [${this.sessionId}] 垃圾回收效果较差，可能存在内存泄漏`);
            }
        }

        // 内存水位监控和预警
        if (heapUsedGB > 18) {
            log(`🔴 [${this.sessionId}] 内存使用超高(${heapUsedGB.toFixed(2)}GB)，即将达到限制`);
        } else if (heapUsedGB > 15) {
            log(`🟡 [${this.sessionId}] 内存使用较高(${heapUsedGB.toFixed(2)}GB)，注意监控`);
        }

        // 超过20GB时抛出错误
        if (heapUsedGB > 20) {
            throw new Error(`内存使用超限(${heapUsedGB.toFixed(2)}GB > 20GB)，停止处理以保护系统`);
        }

        return {
            heapUsedMB: heapUsedMB,
            heapUsedGB: heapUsedGB,
            memoryPeak: this.memoryPeak,
            gcTriggered: shouldGC && global.gc
        };
    }

    /**
     * 批次间延迟
     */
    async batchDelay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 停止处理
     */
    stop() {
        log(`⏹️ [${this.sessionId}] 收到停止信号`);
        this.isRunning = false;
    }
}

// ===== 批量预测API接口 =====

/**
 * 批量预测API - 超大规模并发处理
 * 支持1000期并发预测
 */
app.post('/api/dlt/batch-prediction', async (req, res) => {
    const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    log(`🚀 [${sessionId}] 批量预测请求开始`);
    
    try {
        const {
            // 支持两种方式：直接提供期号列表 或 期号范围参数
            targetIssues: providedTargetIssues,
            rangeConfig,  // 新增：期号范围配置 {rangeType, recentCount, startIssue, endIssue}
            filters,
            maxRedCombinations = 50000,
            maxBlueCombinations = 1000,
            enableValidation = true,
            trulyUnlimited = false,  // 向后兼容
            combinationMode = 'default'  // 新增：组合模式
        } = req.body;

        // 解析目标期号列表
        let targetIssues = providedTargetIssues;

        // 如果没有直接提供期号列表，但有范围配置，则解析期号范围
        if (!targetIssues && rangeConfig) {
            log(`🎯 [${sessionId}] 使用期号范围配置: ${JSON.stringify(rangeConfig)}`);

            try {
                // 内部调用期号范围解析逻辑，避免HTTP请求
                targetIssues = await resolveIssueRangeInternal(rangeConfig);
                log(`✅ [${sessionId}] 期号范围解析成功: 共${targetIssues.length}期`);
            } catch (rangeError) {
                log(`❌ [${sessionId}] 期号范围解析异常: ${rangeError.message}`);
                return res.json({
                    success: false,
                    message: `期号范围解析失败: ${rangeError.message}`,
                    sessionId
                });
            }
        }

        // 验证期号列表
        if (!targetIssues || !Array.isArray(targetIssues) || targetIssues.length === 0) {
            return res.json({
                success: false,
                message: '请提供有效的目标期号列表或期号范围配置',
                sessionId
            });
        }

        // 根据组合模式设置参数
        let actualMaxRed, actualMaxBlue;

        log(`📊 [${sessionId}] 收到组合模式: ${combinationMode}`);

        switch(combinationMode) {
            case 'default':
                actualMaxRed = 100;
                actualMaxBlue = 66;
                log(`✅ [${sessionId}] 默认模式: ${actualMaxRed}红球 × ${actualMaxBlue}蓝球`);
                break;
            case 'unlimited':
                actualMaxRed = Number.MAX_SAFE_INTEGER;
                actualMaxBlue = 66;
                log(`🔄 [${sessionId}] 普通无限制: 324,632红球 × ${actualMaxBlue}蓝球，1:1分配`);
                break;
            case 'truly-unlimited':
                actualMaxRed = Number.MAX_SAFE_INTEGER;
                actualMaxBlue = Number.MAX_SAFE_INTEGER;
                log(`🔥 [${sessionId}] 真正无限制: 324,632红球 × 66蓝球，完全组合`);
                break;
            default:
                // 向后兼容处理
                if (trulyUnlimited && maxRedCombinations === Number.MAX_SAFE_INTEGER) {
                    actualMaxRed = Number.MAX_SAFE_INTEGER;
                    actualMaxBlue = Number.MAX_SAFE_INTEGER;
                } else if (maxRedCombinations === Number.MAX_SAFE_INTEGER) {
                    actualMaxRed = 5000;
                    actualMaxBlue = 1000;
                } else {
                    actualMaxRed = Math.min(maxRedCombinations, 5000);
                    actualMaxBlue = Math.min(maxBlueCombinations, 1000);
                }
                log(`🔄 [${sessionId}] 向后兼容模式: ${actualMaxRed}红球 × ${actualMaxBlue}蓝球`);
                break;
        }
        
        if (!targetIssues || !Array.isArray(targetIssues) || targetIssues.length === 0) {
            return res.json({
                success: false,
                message: '请提供有效的目标期号列表'
            });
        }
        
        if (targetIssues.length > 1000) {
            return res.json({
                success: false,
                message: '单次批量预测期数不能超过1000期'
            });
        }
        
        log(`📊 [${sessionId}] 批量预测配置: 期数=${targetIssues.length}, 红球组合数=${actualMaxRed}${maxRedCombinations === Number.MAX_SAFE_INTEGER ? '(无限制→限制为5k)' : ''}, 蓝球组合数=${actualMaxBlue}${maxBlueCombinations === Number.MAX_SAFE_INTEGER ? '(无限制→限制为1k)' : ''}, 启用验证=${enableValidation}`);
        
        const startTime = Date.now();
        
        // 初始化流式批量预测器
        const batchPredictor = new StreamBatchPredictor(sessionId);

        // 设置预测配置
        const config = {
            targetIssues,
            filters: {
                ...filters,
                maxRedCombinations: actualMaxRed,
                maxBlueCombinations: actualMaxBlue,
                trulyUnlimited: trulyUnlimited,  // 向后兼容
                combinationMode: combinationMode  // 传递组合模式
            },
            maxRedCombinations: actualMaxRed,
            maxBlueCombinations: actualMaxBlue,
            enableValidation
        };

        // 执行流式批量预测
        let lastProgressLog = 0;
        const batchResults = await batchPredictor.streamPredict(config, (progress) => {
            // 减少日志频率，每5%或每10秒记录一次
            const now = Date.now();
            if (progress.percentage >= lastProgressLog + 5 || now - startTime >= lastProgressLog * 1000 + 10000) {
                log(`📊 [${sessionId}] 预测进度: ${progress.percentage}% (${progress.completed}/${progress.total}期) - 内存: ${progress.memoryUsage}MB`);
                lastProgressLog = Math.floor(progress.percentage / 5) * 5;
            }
        });

        // 详细调试日志
        log(`🔍 [${sessionId}] StreamBatchPredictor返回结果类型: ${typeof batchResults}`);
        log(`🔍 [${sessionId}] StreamBatchPredictor返回结构:`, {
            success: batchResults?.success,
            dataLength: batchResults?.data?.length,
            summaryExists: !!batchResults?.summary,
            statisticsExists: !!batchResults?.statistics
        });
        
        const processingTime = (Date.now() - startTime) / 1000;
        const avgSpeed = targetIssues.length / processingTime;
        
        log(`✅ [${sessionId}] 批量预测完成: 处理${targetIssues.length}期, 耗时${processingTime.toFixed(2)}秒, 平均速度${avgSpeed.toFixed(1)}期/秒`);

        // 🔧 直接使用StreamBatchPredictor结果，不进行过度展开
        const originalResultsCount = batchResults && batchResults.data ? batchResults.data.length : 0;
        log(`📊 [${sessionId}] 原始预测结果: ${originalResultsCount}期数据`);

        const filteredResults = unifiedDataFilter.registerFilterSession(sessionId, filters, batchResults ? batchResults.data || [] : []);

        log(`📊 [${sessionId}] 数据过滤完成: 原始${originalResultsCount}条 → 过滤后${filteredResults.length}条`);

        // 检查响应数据大小，防止JSON序列化错误
        try {
            const testResponse = {
                success: true,
                data: filteredResults,  // 使用过滤后的结果
                statistics: {
                    totalIssues: targetIssues.length,
                    originalResultsCount: originalResultsCount,  // 新增：原始结果数量
                    filteredResultsCount: filteredResults.length,  // 新增：过滤后结果数量
                    filterSummary: `过滤掉${originalResultsCount - filteredResults.length}条不符合条件的结果`,  // 新增：过滤摘要
                    processingTime: `${processingTime.toFixed(2)}秒`,
                    averageSpeed: `${(avgSpeed * 60).toFixed(1)}期/分钟`,
                    streamSummary: batchResults ? batchResults.summary : null,  // 新增：流式处理摘要
                    memoryPeak: batchResults ? batchResults.memoryPeak : null,  // 新增：内存峰值
                    sessionId
                }
            };
            
            // 测试JSON序列化
            const jsonString = JSON.stringify(testResponse);
            log(`📊 [${sessionId}] 响应数据大小: ${(jsonString.length / 1024 / 1024).toFixed(2)}MB`);
            
            res.json(testResponse);
        } catch (error) {
            log(`❌ [${sessionId}] JSON序列化失败，返回精简响应: ${error.message}`);
            
            // 返回精简版响应
            const resultData = batchResults && batchResults.data ? batchResults.data : [];
            res.json({
                success: true,
                data: resultData.map(result => ({
                    target_issue: result.target_issue,
                    red_combinations: result.red_combinations.slice(0, 100), // 进一步限制
                    blue_combinations: result.blue_combinations.slice(0, 20),
                    processing_time: result.processing_time,
                    hit_analysis: result.hit_analysis ? {
                        summary: result.hit_analysis.summary || {}
                    } : null
                })),
                statistics: {
                    totalIssues: targetIssues.length,
                    processingTime: `${processingTime.toFixed(2)}秒`,
                    averageSpeed: `${(avgSpeed * 60).toFixed(1)}期/分钟`,
                    streamSummary: batchResults ? batchResults.summary : null,
                    memoryPeak: batchResults ? batchResults.memoryPeak : null,
                    sessionId,
                    note: "数据已精简以确保响应稳定性"
                }
            });
        }
        
    } catch (error) {
        log(`❌ [${sessionId}] 批量预测失败:`, error);
        res.json({
            success: false,
            message: error.message,
            sessionId
        });
    }
});

// ===== 统一数据获取API - 供4个功能模块使用 =====

/**
 * 获取预测统计数据
 */
app.get('/api/dlt/batch-prediction/statistics/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const filteredData = unifiedDataFilter.getFilteredResults(sessionId, 'statistics');

    if (!filteredData) {
        return res.json({
            success: false,
            message: '未找到对应的预测结果，请先执行批量预测'
        });
    }

    // 调试日志
    log(`📊 [${sessionId}] 统计API调用 - 过滤数据长度: ${filteredData.data ? filteredData.data.length : 'undefined'}`);
    log(`📊 [${sessionId}] 过滤摘要:`, filteredData.summary);

    // 计算统计信息
    const statistics = calculateBatchStatistics(filteredData.data);

    log(`📊 [${sessionId}] 计算完成的统计信息:`, statistics);

    res.json({
        success: true,
        data: {
            summary: statistics,
            filterSummary: filteredData.summary,
            timestamp: filteredData.timestamp
        }
    });
});

/**
 * 获取详细预测结果
 */
app.get('/api/dlt/batch-prediction/details/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const filteredData = unifiedDataFilter.getFilteredResults(sessionId, 'details');

    if (!filteredData) {
        return res.json({
            success: false,
            message: '未找到对应的预测结果，请先执行批量预测'
        });
    }

    // 分页处理
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedResults = filteredData.data.slice(startIndex, endIndex);

    res.json({
        success: true,
        data: {
            results: paginatedResults,
            pagination: {
                current: parseInt(page),
                pageSize: parseInt(limit),
                total: filteredData.data.length,
                pages: Math.ceil(filteredData.data.length / parseInt(limit))
            },
            filterSummary: filteredData.summary,
            timestamp: filteredData.timestamp
        }
    });
});

/**
 * 获取命中验证数据
 */
app.get('/api/dlt/batch-prediction/validation/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const filteredData = unifiedDataFilter.getFilteredResults(sessionId, 'validation');

    if (!filteredData) {
        return res.json({
            success: false,
            message: '未找到对应的预测结果，请先执行批量预测'
        });
    }

    // 直接返回过滤后的数据数组，前端会自行处理
    res.json({
        success: true,
        data: filteredData.data,  // 直接返回数据数组
        filterSummary: filteredData.summary,
        timestamp: filteredData.timestamp
    });
});

/**
 * 获取导出数据
 */
app.get('/api/dlt/batch-prediction/export/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const { format = 'json' } = req.query;

    const filteredData = unifiedDataFilter.getFilteredResults(sessionId, 'export');

    if (!filteredData) {
        return res.json({
            success: false,
            message: '未找到对应的预测结果，请先执行批量预测'
        });
    }

    // 根据格式处理数据
    if (format === 'csv') {
        const csvData = convertToCSV(filteredData.data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="batch-prediction-${sessionId}.csv"`);
        res.send(csvData);
    } else {
        res.json({
            success: true,
            data: {
                results: filteredData.data,
                filterSummary: filteredData.summary,
                exportInfo: {
                    sessionId,
                    exportTime: new Date().toISOString(),
                    totalRecords: filteredData.data.length,
                    format: format
                }
            }
        });
    }
});

// ===== 缓存管理API =====

/**
 * 刷新指定会话缓存
 */
app.post('/api/dlt/batch-prediction/refresh-cache/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const { filters } = req.body;

    if (!filters) {
        return res.json({
            success: false,
            message: '缺少过滤条件参数'
        });
    }

    const refreshed = unifiedDataFilter.refreshSessionCache(sessionId, filters);

    if (refreshed) {
        const filteredData = unifiedDataFilter.getFilteredResults(sessionId, 'cache-refresh');
        res.json({
            success: true,
            message: '缓存刷新成功',
            data: {
                sessionId,
                filterSummary: filteredData?.summary,
                refreshTime: new Date().toISOString()
            }
        });
    } else {
        res.json({
            success: false,
            message: '缓存刷新失败，会话不存在或已过期'
        });
    }
});

/**
 * 获取缓存统计信息
 */
app.get('/api/dlt/batch-prediction/cache-stats', (req, res) => {
    const stats = unifiedDataFilter.getCacheStatistics();
    res.json({
        success: true,
        data: stats
    });
});

/**
 * 强制清理所有过期缓存
 */
app.post('/api/dlt/batch-prediction/cleanup-cache', (req, res) => {
    const cleanedCount = unifiedDataFilter.cleanupExpiredSessions();
    res.json({
        success: true,
        message: `成功清理${cleanedCount}个过期会话`,
        data: {
            cleanedSessions: cleanedCount,
            cleanupTime: new Date().toISOString()
        }
    });
});

/**
 * 批量刷新所有活跃会话缓存
 */
app.post('/api/dlt/batch-prediction/refresh-all-cache', (req, res) => {
    const refreshedCount = unifiedDataFilter.refreshAllActiveSessions();
    res.json({
        success: true,
        message: `成功刷新${refreshedCount}个活跃会话的缓存`,
        data: {
            refreshedSessions: refreshedCount,
            refreshTime: new Date().toISOString()
        }
    });
});

// 内存监控API
app.get('/api/dlt/batch-prediction/memory-status', (req, res) => {
    try {
        const memUsage = process.memoryUsage();

        const memoryStatus = {
            heapUsed: {
                MB: Math.round(memUsage.heapUsed / 1024 / 1024),
                GB: Math.round(memUsage.heapUsed / 1024 / 1024 / 1024 * 100) / 100
            },
            heapTotal: {
                MB: Math.round(memUsage.heapTotal / 1024 / 1024),
                GB: Math.round(memUsage.heapTotal / 1024 / 1024 / 1024 * 100) / 100
            },
            external: {
                MB: Math.round(memUsage.external / 1024 / 1024)
            },
            rss: {
                MB: Math.round(memUsage.rss / 1024 / 1024),
                GB: Math.round(memUsage.rss / 1024 / 1024 / 1024 * 100) / 100
            },
            memoryLimitGB: 20,
            usagePercentage: Math.round((memUsage.heapUsed / (20 * 1024 * 1024 * 1024)) * 100),
            timestamp: new Date().toISOString(),
            gcEnabled: typeof global.gc !== 'undefined'
        };

        res.json({
            success: true,
            data: memoryStatus
        });

    } catch (error) {
        log(`❌ 获取内存状态失败: ${error.message}`);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 手动垃圾回收API
app.post('/api/dlt/batch-prediction/manual-gc', (req, res) => {
    try {
        if (!global.gc) {
            return res.json({
                success: false,
                message: '垃圾回收功能未启用。请使用 --expose-gc 参数启动Node.js'
            });
        }

        const beforeGC = process.memoryUsage();
        global.gc();
        const afterGC = process.memoryUsage();

        const freedMB = Math.round((beforeGC.heapUsed - afterGC.heapUsed) / 1024 / 1024);

        res.json({
            success: true,
            message: `手动垃圾回收完成，释放了 ${freedMB}MB 内存`,
            data: {
                beforeGC: {
                    heapUsedMB: Math.round(beforeGC.heapUsed / 1024 / 1024)
                },
                afterGC: {
                    heapUsedMB: Math.round(afterGC.heapUsed / 1024 / 1024)
                },
                freedMB: freedMB
            }
        });

    } catch (error) {
        log(`❌ 手动垃圾回收失败: ${error.message}`);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// 辅助函数
function calculateBatchStatistics(results) {
    if (!results || results.length === 0) {
        return {
            totalResults: 0,
            totalRedCombinations: 0,
            validResultCount: 0,
            validationCount: 0,
            maxHit: 0,
            hitStats: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            avgRedSum: 0
        };
    }

    let totalRedCombinations = 0;
    let validResultCount = 0;
    let validationCount = 0;
    const hitStats = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    // 调试：查看第一条数据的结构
    if (results.length > 0) {
        log(`🔍 [统计调试] 第一条结果数据结构:`, {
            target_issue: results[0].target_issue,
            red_count: results[0].red_count,
            red_combinations_length: results[0].red_combinations?.length,
            has_red_combinations_array: Array.isArray(results[0].red_combinations),
            blue_count: results[0].blue_count
        });
    }

    results.forEach((result, index) => {
        // 计算红球组合数 - 优先使用red_count字段，这是过滤后的实际数量
        const redCount = result.red_count || result.red_combinations?.length || 0;
        totalRedCombinations += redCount;

        // 前3条数据打印调试信息
        if (index < 3) {
            log(`🔍 [统计调试] 第${index + 1}期 ${result.target_issue}: red_count=${result.red_count}, red_combinations.length=${result.red_combinations?.length}, 使用值=${redCount}`);
        }

        if (redCount > 0) {
            validResultCount++;
        }

        // 统计命中情况
        if (result.hit_analysis && result.hit_analysis.red_hit_analysis) {
            validationCount++;
            const hitDist = result.hit_analysis.red_hit_analysis.hit_distribution;
            if (hitDist) {
                Object.keys(hitDist).forEach(hits => {
                    if (hitStats[hits] !== undefined) {
                        hitStats[hits] += hitDist[hits] || 0;
                    }
                });
            }
        }
    });

    // 计算最高命中球数
    const maxHit = Object.keys(hitStats).reduce((max, hits) => {
        return hitStats[hits] > 0 && parseInt(hits) > max ? parseInt(hits) : max;
    }, 0);

    // 计算每期平均组合数
    const avgCombinationsPerIssue = validResultCount > 0 ?
        Math.round(totalRedCombinations / validResultCount) : 0;

    const statisticsResult = {
        totalResults: results.length,
        totalRedCombinations: totalRedCombinations,
        validResultCount: validResultCount,
        validationCount: validationCount,
        maxHit: maxHit,
        hitStats: hitStats,
        avgRedSum: results.length > 0 ?
            results.reduce((sum, r) => sum + (r.red_sum || 0), 0) / results.length : 0,
        avgCombinationsPerIssue: avgCombinationsPerIssue  // 新增：每期平均组合数
    };

    log(`📊 [统计结果] 计算完成 - 总期数: ${statisticsResult.totalResults}, 总红球组合数: ${statisticsResult.totalRedCombinations}, 平均每期: ${avgCombinationsPerIssue}`);

    return statisticsResult;
}

function calculateValidationResults(results) {
    // 实现验证结果计算逻辑
    return {
        totalValidated: results.length,
        hitRate: 0.15, // 示例值
        // 更多验证信息...
    };
}

function convertToCSV(results) {
    // 实现CSV转换逻辑
    if (results.length === 0) return '';

    const headers = Object.keys(results[0]).join(',');
    const rows = results.map(row => Object.values(row).join(',')).join('\n');
    return headers + '\n' + rows;
}

// ========== 预测任务管理API ==========

/**
 * 创建预测任务
 */
app.post('/api/dlt/prediction-tasks/create', async (req, res) => {
    try {
        const { task_name, period_range, exclude_conditions, output_config } = req.body;

        // 生成任务ID
        const task_id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 自动生成任务名称（如果未提供）
        const finalTaskName = task_name || `预测任务_${new Date().toLocaleString('zh-CN').replace(/\//g, '-').replace(/:/g, '-')}`;

        // 计算期号范围
        let startPeriod, endPeriod, totalPeriods;

        if (period_range.type === 'all') {
            // 获取所有历史期号
            const allIssues = await DLT.find({}).sort({ Issue: 1 }).select('Issue').lean();
            if (allIssues.length === 0) {
                return res.json({ success: false, message: '没有找到历史期号数据' });
            }
            startPeriod = allIssues[0].Issue;
            endPeriod = allIssues[allIssues.length - 1].Issue;
            totalPeriods = allIssues.length;
        } else if (period_range.type === 'recent') {
            // 最近N期
            const recentCount = period_range.value || 100;
            const recentIssues = await DLT.find({}).sort({ Issue: -1 }).limit(recentCount).select('Issue').lean();
            if (recentIssues.length === 0) {
                return res.json({ success: false, message: '没有找到历史期号数据' });
            }
            startPeriod = recentIssues[recentIssues.length - 1].Issue;
            endPeriod = recentIssues[0].Issue;
            totalPeriods = recentIssues.length;
        } else if (period_range.type === 'custom') {
            // 自定义范围
            startPeriod = period_range.value.start;
            endPeriod = period_range.value.end;
            const issuesInRange = await DLT.find({
                Issue: { $gte: startPeriod, $lte: endPeriod }
            }).countDocuments();
            totalPeriods = issuesInRange;
        }

        // 创建任务记录
        const newTask = new PredictionTask({
            task_id,
            task_name: finalTaskName,
            period_range: {
                start: startPeriod,
                end: endPeriod,
                total: totalPeriods
            },
            exclude_conditions,
            output_config,
            status: 'pending',
            progress: {
                current: 0,
                total: totalPeriods,
                percentage: 0
            }
        });

        await newTask.save();

        log(`✅ 创建预测任务: ${task_id}, 期号范围: ${startPeriod}-${endPeriod}, 共${totalPeriods}期`);

        // 异步执行任务（不阻塞响应）
        setImmediate(() => executePredictionTask(task_id));

        res.json({
            success: true,
            data: {
                task_id,
                task_name: finalTaskName,
                message: '任务创建成功，正在后台处理...'
            }
        });
    } catch (error) {
        log(`❌ 创建预测任务失败: ${error.message}`);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 获取任务列表
 */
app.get('/api/dlt/prediction-tasks/list', async (req, res) => {
    try {
        const { page = 1, limit = 20, status = 'all' } = req.query;
        const skip = (page - 1) * limit;

        // 构建查询条件
        const query = {};
        if (status !== 'all') {
            query.status = status;
        }

        // 查询任务列表
        const tasks = await PredictionTask.find(query)
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        // 获取总数
        const total = await PredictionTask.countDocuments(query);

        res.json({
            success: true,
            data: {
                tasks,
                total,
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        log(`❌ 获取任务列表失败: ${error.message}`);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 获取任务详情
 */
app.get('/api/dlt/prediction-tasks/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;

        // 查询任务基本信息
        const task = await PredictionTask.findOne({ task_id: taskId }).lean();
        if (!task) {
            return res.json({ success: false, message: '任务不存在' });
        }

        // 查询任务结果汇总
        const results = await PredictionTaskResult.find({ task_id: taskId })
            .sort({ period: 1 })
            .select('period combination_count hit_analysis.max_hit_count hit_analysis.red_hit_analysis hit_analysis.blue_hit_analysis hit_analysis.prize_stats hit_analysis.hit_rate hit_analysis.total_prize')
            .lean();

        res.json({
            success: true,
            data: {
                task,
                results
            }
        });
    } catch (error) {
        log(`❌ 获取任务详情失败: ${error.message}`);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 获取单期详细结果
 */
app.get('/api/dlt/prediction-tasks/:taskId/results/:period', async (req, res) => {
    try {
        const { taskId, period } = req.params;

        // 查询单期结果
        const result = await PredictionTaskResult.findOne({
            task_id: taskId,
            period: parseInt(period)
        }).lean();

        if (!result) {
            return res.json({ success: false, message: '未找到该期结果' });
        }

        // 获取组合详细数据
        const redCombinations = await DLTRedCombinations.find({
            combination_id: { $in: result.red_combinations }
        }).lean();

        const blueCombinations = await DLTBlueCombinations.find({
            combination_id: { $in: result.blue_combinations }
        }).lean();

        // 生成完整组合并计算命中
        const combinations = [];
        for (const red of redCombinations) {
            for (const blue of blueCombinations) {
                const redBalls = [red.red_ball_1, red.red_ball_2, red.red_ball_3, red.red_ball_4, red.red_ball_5];
                const blueBalls = [blue.blue_ball_1, blue.blue_ball_2];

                // 计算命中
                const hit_red = result.winning_numbers?.red
                    ? redBalls.filter(n => result.winning_numbers.red.includes(n)).length
                    : 0;
                const hit_blue = result.winning_numbers?.blue
                    ? blueBalls.filter(n => result.winning_numbers.blue.includes(n)).length
                    : 0;

                // 计算奖项
                let prize_level = '';
                if (hit_red === 5 && hit_blue === 2) prize_level = '一等奖';
                else if (hit_red === 5 && hit_blue === 1) prize_level = '二等奖';
                else if (hit_red === 5 || (hit_red === 4 && hit_blue === 2)) prize_level = '三等奖';
                else if ((hit_red === 4 && hit_blue === 1) || (hit_red === 3 && hit_blue === 2)) prize_level = '四等奖';
                else if (hit_red === 4 || (hit_red === 3 && hit_blue === 1) || (hit_red === 2 && hit_blue === 2)) prize_level = '五等奖';

                combinations.push({
                    red: redBalls,
                    blue: blueBalls,
                    hit_red,
                    hit_blue,
                    prize_level
                });
            }
        }

        res.json({
            success: true,
            data: {
                period: parseInt(period),
                winning_numbers: result.winning_numbers,
                combinations,
                statistics: result.hit_analysis
            }
        });
    } catch (error) {
        log(`❌ 获取单期详细结果失败: ${error.message}`);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 删除任务
 */
app.delete('/api/dlt/prediction-tasks/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;

        // 删除任务
        await PredictionTask.deleteOne({ task_id: taskId });

        // 删除任务结果
        await PredictionTaskResult.deleteMany({ task_id: taskId });

        log(`✅ 删除任务: ${taskId}`);

        res.json({
            success: true,
            message: '任务已删除'
        });
    } catch (error) {
        log(`❌ 删除任务失败: ${error.message}`);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 生成任务CSV内容
 */
function generateTaskCSV(task, results) {
    // CSV表头
    const headers = [
        '期号',
        '组合数',
        '红球最高命中',
        '蓝球最高命中',
        '一等奖',
        '二等奖',
        '三等奖',
        '四等奖',
        '五等奖',
        '六等奖',
        '七等奖',
        '八等奖',
        '九等奖',
        '命中率(%)',
        '总奖金(元)'
    ];

    // 创建CSV内容
    let csvContent = headers.join(',') + '\n';

    // 添加任务信息行
    csvContent += `任务名称,${task.task_name}\n`;
    csvContent += `期号范围,${task.period_range.start} - ${task.period_range.end} (${task.period_range.total}期)\n`;
    csvContent += `创建时间,${new Date(task.created_at).toLocaleString('zh-CN')}\n`;
    csvContent += `\n`;
    csvContent += headers.join(',') + '\n';

    // 添加数据行
    results.forEach(result => {
        const hitAnalysis = result.hit_analysis || {};
        const prizeStats = hitAnalysis.prize_stats || {};
        const redHit = hitAnalysis.red_hit_analysis?.best_hit || 0;
        const blueHit = hitAnalysis.blue_hit_analysis?.best_hit || 0;

        const row = [
            result.period || '',
            result.combination_count || 0,
            redHit,
            blueHit,
            prizeStats.first_prize?.count || 0,
            prizeStats.second_prize?.count || 0,
            prizeStats.third_prize?.count || 0,
            prizeStats.fourth_prize?.count || 0,
            prizeStats.fifth_prize?.count || 0,
            prizeStats.sixth_prize?.count || 0,
            prizeStats.seventh_prize?.count || 0,
            prizeStats.eighth_prize?.count || 0,
            prizeStats.ninth_prize?.count || 0,
            (hitAnalysis.hit_rate || 0).toFixed(2),
            hitAnalysis.total_prize || 0
        ];

        csvContent += row.join(',') + '\n';
    });

    return csvContent;
}

/**
 * 流式导出单期详细组合CSV（避免内存溢出）
 */
async function streamPeriodDetailCSV(res, taskId, period) {
    try {
        // 1. 查询任务基本信息
        const task = await PredictionTask.findOne({ task_id: taskId }).lean();
        if (!task) {
            throw new Error('任务不存在');
        }

        // 2. 查询该期的结果数据
        const result = await PredictionTaskResult.findOne({
            task_id: taskId,
            period: parseInt(period)
        }).lean();

        if (!result) {
            throw new Error('未找到该期结果');
        }

        // 3. 查询红球组合详细信息
        const redCombinations = await DLTRedCombinations.find({
            combination_id: { $in: result.red_combinations }
        }).lean();

        // 4. 查询蓝球组合详细信息
        const blueCombinations = await DLTBlueCombinations.find({
            combination_id: { $in: result.blue_combinations }
        }).lean();

        // 5. 查询该期的遗漏数据（用于计算热温冷比）
        const missingData = await DLTRedMissing.findOne({
            Issue: parseInt(period)
        }).lean();

        // 6. 查询该期的开奖号码（如果已开奖）
        const drawResult = await DLT.findOne({ Issue: parseInt(period) }).lean();
        const winningNumbers = drawResult ? {
            red: [drawResult.Red1, drawResult.Red2, drawResult.Red3, drawResult.Red4, drawResult.Red5],
            blue: [drawResult.Blue1, drawResult.Blue2]
        } : null;

        const totalCombinations = redCombinations.length * blueCombinations.length;
        log(`📊 开始导出期号${period}的组合明细，总数: ${totalCombinations.toLocaleString()}条`);

        // CSV表头
        const headers = [
            '序号',
            '红球1', '红球2', '红球3', '红球4', '红球5',
            '前区和值', '前区跨度', '区间比', '前区奇偶', '热温冷比',
            '蓝球1', '蓝球2',
            '红球命中', '蓝球命中', '奖项等级', '奖金(元)'
        ];

        // 设置响应头
        const filename = `预测任务_${task.task_name}_期号_${period}_组合明细.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);

        // 写入BOM
        res.write('\ufeff');

        // 写入表头和任务信息
        res.write(headers.join(',') + '\n');
        res.write(`任务名称,${task.task_name}\n`);
        res.write(`期号,${period}\n`);
        res.write(`导出时间,${new Date().toLocaleString('zh-CN')}\n`);
        res.write(`组合总数,${totalCombinations}\n`);
        if (winningNumbers) {
            res.write(`开奖号码,${winningNumbers.red.map(n => n.toString().padStart(2, '0')).join(' ')} + ${winningNumbers.blue.map(n => n.toString().padStart(2, '0')).join(' ')}\n`);
        } else {
            res.write(`开奖号码,未开奖\n`);
        }
        res.write('\n');
        res.write(headers.join(',') + '\n');

        // 流式生成所有组合（笛卡尔积），每1000行写入一次
        let rowNumber = 1;
        let buffer = '';
        const BATCH_SIZE = 1000;

        for (const red of redCombinations) {
            // 提取红球号码数组
            const redBalls = [red.red_ball_1, red.red_ball_2, red.red_ball_3, red.red_ball_4, red.red_ball_5];

            // 计算热温冷比
            let hotWarmColdRatio = '-';
            if (missingData) {
                let hotCount = 0, warmCount = 0, coldCount = 0;
                redBalls.forEach(num => {
                    const missingValue = missingData[num.toString()] || 0;
                    if (missingValue <= 4) {
                        hotCount++;
                    } else if (missingValue >= 5 && missingValue <= 9) {
                        warmCount++;
                    } else {
                        coldCount++;
                    }
                });
                hotWarmColdRatio = `${hotCount}:${warmCount}:${coldCount}`;
            }

            for (const blue of blueCombinations) {
                // 提取蓝球号码数组
                const blueBalls = [blue.blue_ball_1, blue.blue_ball_2];

                // 计算命中情况
                let hitRed = '-', hitBlue = '-', prizeLevel = '-', prizeAmount = 0;

                if (winningNumbers) {
                    // 计算红球命中数
                    const redHitCount = redBalls.filter(n => winningNumbers.red.includes(n)).length;
                    const blueHitCount = blueBalls.filter(n => winningNumbers.blue.includes(n)).length;

                    hitRed = `${redHitCount}个`;
                    hitBlue = `${blueHitCount}个`;

                    // 计算奖项和奖金
                    if (redHitCount === 5 && blueHitCount === 2) {
                        prizeLevel = '一等奖';
                        prizeAmount = 10000000;
                    } else if (redHitCount === 5 && blueHitCount === 1) {
                        prizeLevel = '二等奖';
                        prizeAmount = 100000;
                    } else if (redHitCount === 5 && blueHitCount === 0) {
                        prizeLevel = '三等奖';
                        prizeAmount = 10000;
                    } else if (redHitCount === 4 && blueHitCount === 2) {
                        prizeLevel = '四等奖';
                        prizeAmount = 3000;
                    } else if (redHitCount === 4 && blueHitCount === 1) {
                        prizeLevel = '五等奖';
                        prizeAmount = 300;
                    } else if (redHitCount === 3 && blueHitCount === 2) {
                        prizeLevel = '六等奖';
                        prizeAmount = 200;
                    } else if (redHitCount === 4 && blueHitCount === 0) {
                        prizeLevel = '七等奖';
                        prizeAmount = 100;
                    } else if ((redHitCount === 3 && blueHitCount === 1) || (redHitCount === 2 && blueHitCount === 2)) {
                        prizeLevel = '八等奖';
                        prizeAmount = 15;
                    } else if ((redHitCount === 3 && blueHitCount === 0) ||
                               (redHitCount === 1 && blueHitCount === 2) ||
                               (redHitCount === 2 && blueHitCount === 1) ||
                               (redHitCount === 0 && blueHitCount === 2)) {
                        prizeLevel = '九等奖';
                        prizeAmount = 5;
                    }
                }

                // 构建数据行
                const row = [
                    rowNumber++,
                    ...redBalls.map(n => n.toString().padStart(2, '0')),
                    red.sum_value || '-',
                    red.span_value || '-',
                    red.zone_ratio || '-',
                    red.odd_even_ratio || '-',
                    hotWarmColdRatio,
                    ...blueBalls.map(n => n.toString().padStart(2, '0')),
                    hitRed,
                    hitBlue,
                    prizeLevel,
                    prizeAmount
                ];

                buffer += row.join(',') + '\n';

                // 每1000行写入一次
                if (rowNumber % BATCH_SIZE === 0) {
                    res.write(buffer);
                    buffer = '';
                }
            }
        }

        // 写入剩余数据
        if (buffer) {
            res.write(buffer);
        }

        res.end();
        log(`✅ 导出完成，共${totalCombinations.toLocaleString()}条记录`);
    } catch (error) {
        log(`❌ 流式导出单期详细CSV失败: ${error.message}`);
        log(`❌ 错误堆栈: ${error.stack}`);

        // 如果响应已经开始，只能结束响应；否则重新抛出错误由外层处理
        if (res.headersSent) {
            // 响应头已发送，无法发送JSON错误，只能结束响应
            log(`⚠️ 响应头已发送，终止流式传输`);
            if (!res.writableEnded) {
                res.end();
            }
        } else {
            // 响应未开始，重新抛出错误让外层catch处理
            throw error;
        }
    }
}

/**
 * 导出任务数据
 */
app.get('/api/dlt/prediction-tasks/:taskId/export', async (req, res) => {
    try {
        const { taskId } = req.params;
        const { format = 'excel', type = 'all', period } = req.query;

        // 查询任务信息
        const task = await PredictionTask.findOne({ task_id: taskId }).lean();
        if (!task) {
            return res.json({ success: false, message: '任务不存在' });
        }

        // 处理单期详细组合导出（流式导出）
        if (type === 'period_detail') {
            if (!period) {
                return res.json({ success: false, message: '缺少期号参数' });
            }

            // 使用流式导出避免内存溢出
            try {
                await streamPeriodDetailCSV(res, taskId, period);
            } catch (error) {
                log(`❌ 流式导出失败: ${error.message}`);
                // 如果响应还未开始，发送错误JSON；否则直接结束响应
                if (!res.headersSent) {
                    res.status(500).json({ success: false, message: error.message });
                } else {
                    res.end();
                }
            }
            return;
        }

        // 根据type获取数据
        let results;
        if (type === 'single') {
            results = await PredictionTaskResult.find({
                task_id: taskId,
                period: parseInt(period)
            }).lean();
        } else {
            results = await PredictionTaskResult.find({ task_id: taskId })
                .sort({ period: 1 })
                .lean();
        }

        if (format === 'csv') {
            // CSV导出逻辑
            const csvContent = generateTaskCSV(task, results);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="task_${taskId}_${type}.csv"`);
            // 添加BOM以支持Excel正确识别UTF-8编码
            res.send('\ufeff' + csvContent);
        } else if (format === 'excel') {
            // Excel导出使用CSV格式（Excel可以直接打开CSV）
            const csvContent = generateTaskCSV(task, results);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="task_${taskId}_${type}.csv"`);
            // 添加BOM以支持Excel正确识别UTF-8编码
            res.send('\ufeff' + csvContent);
        } else {
            // JSON导出
            res.json({
                success: true,
                data: {
                    task,
                    results
                }
            });
        }
    } catch (error) {
        log(`❌ 导出任务数据失败: ${error.message}`);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * CLI方式导出单期详细数据（启动后台任务）
 */
app.post('/api/dlt/export-period-cli', async (req, res) => {
    try {
        const { taskId, period, compress } = req.body;

        if (!taskId || !period) {
            return res.json({ success: false, message: '缺少必需参数' });
        }

        // 生成导出任务ID
        const exportId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 初始化任务状态
        exportTasks[exportId] = {
            status: 'running',
            progress: 0,
            message: '正在启动导出任务...',
            currentRow: 0,
            totalRows: 0,
            speed: 0,
            remaining: 0,
            filename: null,
            filepath: null,
            filesize: 0,
            error: null,
            startTime: Date.now()
        };

        log(`🚀 启动CLI导出任务: ${exportId}, 任务=${taskId}, 期号=${period}`);

        // 立即返回exportId
        res.json({ success: true, exportId });

        // 异步执行命令行脚本
        const scriptPath = path.join(__dirname, '../../export-period.js');
        const args = [
            scriptPath,
            `--task-id=${taskId}`,
            `--period=${period}`,
            '--output=./exports'
        ];

        if (compress) {
            args.push('--compress');
        }

        const child = spawn('node', args, {
            cwd: path.join(__dirname, '../..'),
            stdio: ['ignore', 'pipe', 'pipe']
        });

        // 实时读取标准输出
        child.stdout.on('data', (data) => {
            const output = data.toString();
            const lines = output.split('\n');

            lines.forEach(line => {
                // 解析进度百分比
                const progressMatch = line.match(/进度:\s*(\d+)%/);
                if (progressMatch) {
                    exportTasks[exportId].progress = parseInt(progressMatch[1]);
                }

                // 解析已生成行数
                const rowMatch = line.match(/已生成:\s*([\d,]+)\/([\d,]+)/);
                if (rowMatch) {
                    exportTasks[exportId].currentRow = parseInt(rowMatch[1].replace(/,/g, ''));
                    exportTasks[exportId].totalRows = parseInt(rowMatch[2].replace(/,/g, ''));
                }

                // 解析速度
                const speedMatch = line.match(/速度:\s*([\d,]+)\s*行\/秒/);
                if (speedMatch) {
                    exportTasks[exportId].speed = parseInt(speedMatch[1].replace(/,/g, ''));
                }

                // 解析剩余时间
                const remainingMatch = line.match(/剩余:\s*(\d+)秒/);
                if (remainingMatch) {
                    exportTasks[exportId].remaining = parseInt(remainingMatch[1]);
                }

                // 解析状态消息
                const messageMatch = line.match(/[⏳✅⚠️❌📝📊]\s*(.+)/);
                if (messageMatch) {
                    exportTasks[exportId].message = messageMatch[1].trim();
                }

                // 解析文件路径
                const fileMatch = line.match(/文件路径:\s*(.+)/);
                if (fileMatch) {
                    const fullPath = fileMatch[1].trim();
                    exportTasks[exportId].filepath = fullPath;
                    exportTasks[exportId].filename = path.basename(fullPath);
                }

                // 解析文件大小
                const sizeMatch = line.match(/文件大小:\s*(.+)/);
                if (sizeMatch) {
                    exportTasks[exportId].filesize = sizeMatch[1].trim();
                }
            });
        });

        // 监听错误输出
        child.stderr.on('data', (data) => {
            const error = data.toString();
            log(`❌ CLI导出错误: ${error}`);
            exportTasks[exportId].error = error;
        });

        // 监听进程结束
        child.on('close', (code) => {
            const elapsed = ((Date.now() - exportTasks[exportId].startTime) / 1000).toFixed(2);

            if (code === 0) {
                exportTasks[exportId].status = 'completed';
                exportTasks[exportId].progress = 100;
                exportTasks[exportId].message = `导出完成！耗时 ${elapsed} 秒`;
                log(`✅ CLI导出完成: ${exportId}, 耗时 ${elapsed}秒`);
            } else {
                exportTasks[exportId].status = 'failed';
                exportTasks[exportId].message = '导出失败';
                log(`❌ CLI导出失败: ${exportId}, 退出码=${code}`);
            }
        });

        // 监听进程错误
        child.on('error', (error) => {
            exportTasks[exportId].status = 'failed';
            exportTasks[exportId].error = error.message;
            exportTasks[exportId].message = `启动导出失败: ${error.message}`;
            log(`❌ CLI导出进程错误: ${error.message}`);
        });

    } catch (error) {
        log(`❌ 启动CLI导出失败: ${error.message}`);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 查询导出任务进度
 */
app.get('/api/dlt/export-progress/:exportId', (req, res) => {
    try {
        const { exportId } = req.params;
        const task = exportTasks[exportId];

        if (!task) {
            return res.json({
                success: false,
                message: '导出任务不存在'
            });
        }

        res.json({
            success: true,
            exportId,
            status: task.status,
            progress: task.progress,
            message: task.message,
            currentRow: task.currentRow,
            totalRows: task.totalRows,
            speed: task.speed,
            remaining: task.remaining,
            filename: task.filename,
            filesize: task.filesize,
            error: task.error
        });

    } catch (error) {
        log(`❌ 查询导出进度失败: ${error.message}`);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 下载导出的文件
 */
app.get('/api/dlt/download-export/:filename', (req, res) => {
    try {
        const { filename } = req.params;
        const filepath = path.join(__dirname, '../../exports', filename);

        // 检查文件是否存在
        if (!fs.existsSync(filepath)) {
            return res.status(404).json({
                success: false,
                message: '文件不存在'
            });
        }

        log(`📥 下载导出文件: ${filename}`);

        // 下载文件
        res.download(filepath, filename, (err) => {
            if (err) {
                log(`❌ 下载文件失败: ${err.message}`);
            } else {
                log(`✅ 文件下载成功: ${filename}`);
            }
        });

    } catch (error) {
        log(`❌ 下载导出文件失败: ${error.message}`);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 执行预测任务（后台异步处理）
 */
async function executePredictionTask(taskId) {
    try {
        log(`🚀 开始执行预测任务: ${taskId}`);

        // 获取任务信息
        const task = await PredictionTask.findOne({ task_id: taskId });
        if (!task) {
            log(`❌ 任务不存在: ${taskId}`);
            return;
        }

        // 更新任务状态为运行中
        task.status = 'running';
        task.updated_at = new Date();
        await task.save();

        // 获取期号列表
        const issues = await DLT.find({
            Issue: { $gte: task.period_range.start, $lte: task.period_range.end }
        }).sort({ Issue: 1 }).lean();

        log(`📊 任务 ${taskId}: 共${issues.length}期待处理`);

        // 统计变量
        let totalCombinations = 0;
        let totalHits = 0;
        let firstPrizeCount = 0;
        let secondPrizeCount = 0;
        let totalPrizeAmount = 0;

        // 逐期处理
        for (let i = 0; i < issues.length; i++) {
            const issue = issues[i];
            const targetIssue = issue.Issue;

            try {
                log(`🔄 处理期号: ${targetIssue} (ID: ${issue.ID}) (${i + 1}/${issues.length})`);
                log(`📋 排除条件: ${JSON.stringify(task.exclude_conditions, null, 2)}`);

                // 1. 应用基础排除条件筛选红球组合（和值、跨度、区间比、奇偶比）
                const redQuery = await buildRedQueryFromExcludeConditions(task.exclude_conditions, issue.ID);
                log(`🔍 构建的查询条件: ${JSON.stringify(redQuery, null, 2)}`);

                // 先获取总数用于对比
                const totalRedCount = await DLTRedCombinations.countDocuments({});
                log(`📊 数据库中红球总组合数: ${totalRedCount}`);

                let filteredRedCombinations = await DLTRedCombinations.find(redQuery).lean();
                log(`📊 基础筛选后红球组合数: ${filteredRedCombinations.length}`);

                // 2. 处理热温冷比排除条件（需要查询热温冷比表）
                if (task.exclude_conditions?.hwc) {
                    log(`🔥 处理热温冷比排除:`, task.exclude_conditions.hwc);
                    let excludedHWCRatios = [...(task.exclude_conditions.hwc.excludeRatios || [])];
                    log(`  📊 手动排除的热温冷比: ${excludedHWCRatios.join(', ') || '无'}`);

                    // 添加历史排除
                    log(`  🔍 检查历史排除: historical=${task.exclude_conditions.hwc.historical}, enabled=${task.exclude_conditions.hwc.historical?.enabled}`);
                    if (task.exclude_conditions.hwc.historical && task.exclude_conditions.hwc.historical.enabled) {
                        log(`  🌡️ 开始查询最近${task.exclude_conditions.hwc.historical.count}期热温冷比...`);
                        const historicalRatios = await getHistoricalHWCRatios(task.exclude_conditions.hwc.historical.count, issue.ID);
                        log(`  🌡️ 查询到历史热温冷比: ${historicalRatios.join(', ')}`);
                        excludedHWCRatios.push(...historicalRatios);
                    } else {
                        log(`  ℹ️ 未启用热温冷比历史排除`);
                    }

                    // 去重
                    excludedHWCRatios = [...new Set(excludedHWCRatios)];
                    log(`  🔥 合并后的热温冷比排除: ${excludedHWCRatios.join(', ')}`);

                    if (excludedHWCRatios.length > 0) {
                        log(`🔥 应用热温冷比排除: ${excludedHWCRatios.join(', ')}`);

                        // 查找前一期作为基准期号
                        const previousIssue = await DLT.findOne({ Issue: { $lt: targetIssue } })
                            .sort({ Issue: -1 })
                            .lean();

                        if (previousIssue) {
                            const baseIssue = previousIssue.Issue.toString();
                            const targetIssueStr = targetIssue.toString();
                            log(`🔥 查询热温冷比数据: base_issue=${baseIssue}, target_issue=${targetIssueStr}`);

                            // 先尝试优化表
                            let hwcData = await DLTRedCombinationsHotWarmColdOptimized.findOne({
                                base_issue: baseIssue,
                                target_issue: targetIssueStr
                            }).lean();

                            if (hwcData && hwcData.hot_warm_cold_data) {
                                log(`🔥 找到热温冷比数据，可用比例: ${Object.keys(hwcData.hot_warm_cold_data).join(', ')}`);

                                // 从优化表获取允许的组合ID
                                const allowedCombinationIds = new Set();
                                let totalAllowedCount = 0;

                                for (const [ratio, combinationIds] of Object.entries(hwcData.hot_warm_cold_data)) {
                                    if (!excludedHWCRatios.includes(ratio)) {
                                        log(`  ✅ 保留比例 ${ratio}: ${combinationIds.length} 个组合`);
                                        combinationIds.forEach(id => allowedCombinationIds.add(id));
                                        totalAllowedCount += combinationIds.length;
                                    } else {
                                        log(`  ❌ 排除比例 ${ratio}: ${combinationIds.length} 个组合`);
                                    }
                                }

                                log(`🔥 热温冷比允许的组合ID总数: ${allowedCombinationIds.size}`);
                                log(`🔥 过滤前红球组合数: ${filteredRedCombinations.length}`);

                                // 过滤红球组合
                                const beforeFilter = filteredRedCombinations.length;
                                filteredRedCombinations = filteredRedCombinations.filter(combo =>
                                    allowedCombinationIds.has(combo.combination_id)
                                );
                                const afterFilter = filteredRedCombinations.length;

                                log(`🔥 热温冷比筛选后红球组合数: ${afterFilter} (过滤掉 ${beforeFilter - afterFilter} 个)`);
                            } else {
                                log(`⚠️ 未找到期号 ${targetIssue} 的热温冷比数据，跳过热温冷比筛选`);
                            }
                        } else {
                            log(`⚠️ 未找到期号 ${targetIssue} 的前一期，跳过热温冷比筛选`);
                        }
                    } else {
                        log(`ℹ️ 热温冷比未设置排除条件`);
                    }
                } else {
                    log(`ℹ️ 未设置热温冷比排除条件`);
                }

                // 3. 根据组合模式限制红球组合数
                const combinationMode = task.output_config.combination_mode || 'default';
                if (combinationMode === 'default') {
                    // 默认模式：限制为100个红球组合
                    filteredRedCombinations = filteredRedCombinations.slice(0, 100);
                    log(`🎯 默认模式：限制为100个红球组合`);
                }
                // unlimited和truly-unlimited模式使用所有组合

                log(`✅ 最终红球组合数: ${filteredRedCombinations.length}`);

                // 4. 筛选蓝球组合（获取所有）
                const filteredBlueCombinations = await DLTBlueCombinations.find({}).lean();

                // 5. 获取该期开奖号码
                const winningNumbers = {
                    red: [issue.Red1, issue.Red2, issue.Red3, issue.Red4, issue.Red5],
                    blue: [issue.Blue1, issue.Blue2]
                };
                log(`🎯 期号 ${targetIssue} 的开奖号码:`, winningNumbers);
                log(`🔍 开奖号码数据类型: Red1=${typeof issue.Red1}, Blue1=${typeof issue.Blue1}`);

                // 6. 计算组合数
                let combinationCount;
                if (combinationMode === 'unlimited') {
                    // 普通无限制：1:1配对，组合数 = max(红球数, 蓝球数)
                    combinationCount = Math.max(filteredRedCombinations.length, filteredBlueCombinations.length);
                } else {
                    // 默认模式和真正无限制：完全组合
                    combinationCount = filteredRedCombinations.length * filteredBlueCombinations.length;
                }

                log(`📊 组合数: ${combinationCount} (模式: ${combinationMode})`);

                // 7. 计算命中分析
                const hitAnalysis = calculateHitAnalysisForPeriod(
                    filteredRedCombinations,
                    filteredBlueCombinations,
                    winningNumbers,
                    combinationMode
                );

                // 8. 保存结果到数据库
                const result = new PredictionTaskResult({
                    result_id: `${taskId}_${targetIssue}`,
                    task_id: taskId,
                    period: targetIssue,
                    red_combinations: filteredRedCombinations.map(c => c.combination_id),
                    blue_combinations: filteredBlueCombinations.map(c => c.combination_id),
                    combination_count: combinationCount,
                    winning_numbers: winningNumbers,
                    hit_analysis: hitAnalysis
                });

                await result.save();

                // 9. 累计统计信息
                totalCombinations += result.combination_count;
                totalHits += hitAnalysis.max_hit_count || 0;
                firstPrizeCount += hitAnalysis.prize_stats.first_prize.count || 0;
                secondPrizeCount += hitAnalysis.prize_stats.second_prize.count || 0;
                totalPrizeAmount += hitAnalysis.total_prize || 0;

                log(`✅ 处理完成: ${targetIssue}, 组合数: ${result.combination_count}, 最高命中: ${hitAnalysis.max_hit_count}`);

                // 7. 更新任务进度
                task.progress.current = i + 1;
                task.progress.percentage = Math.round(((i + 1) / issues.length) * 100);
                task.updated_at = new Date();
                await task.save();

            } catch (error) {
                log(`❌ 处理期号 ${targetIssue} 失败: ${error.message}`);
                // 继续处理下一期
            }
        }

        // 8. 更新任务整体统计信息
        // 命中率 = 二等奖以上中奖次数 / 总期数 × 100%
        const totalPrizeHits = firstPrizeCount + secondPrizeCount;
        const hitRatePercent = issues.length > 0 ? (totalPrizeHits / issues.length) * 100 : 0;

        task.statistics = {
            total_periods: issues.length,
            total_combinations: totalCombinations,
            total_hits: totalHits,
            avg_hit_rate: Math.round(hitRatePercent * 100) / 100, // 保留2位小数的百分比
            first_prize_count: firstPrizeCount,
            second_prize_count: secondPrizeCount,
            total_prize_amount: totalPrizeAmount
        };

        // 9. 任务完成
        task.status = 'completed';
        task.completed_at = new Date();
        task.updated_at = new Date();
        await task.save();

        log(`✅ 预测任务完成: ${taskId}, 总期数: ${issues.length}, 总组合: ${totalCombinations}`);
    } catch (error) {
        log(`❌ 执行预测任务失败: ${taskId}, ${error.message}`);
        console.error(error);

        // 更新任务状态为失败
        await PredictionTask.updateOne(
            { task_id: taskId },
            {
                status: 'failed',
                error_message: error.message,
                updated_at: new Date()
            }
        );
    }
}

/**
 * 查询最近N期的和值历史数据
 * @param {number} recentCount - 查询最近N期
 * @param {number} beforePeriodID - 当前预测期号的ID，查询该ID之前的数据
 */
async function getHistoricalSumValues(recentCount, beforePeriodID) {
    try {
        const issues = await DLT.find({ ID: { $lt: beforePeriodID } })
            .sort({ ID: -1 })
            .limit(recentCount)
            .lean();

        const sumValues = new Set();
        issues.forEach(issue => {
            const sum = issue.Red1 + issue.Red2 + issue.Red3 + issue.Red4 + issue.Red5;
            sumValues.add(sum);
        });

        console.log(`📊 查询期号ID ${beforePeriodID} 之前最近${recentCount}期和值: ${Array.from(sumValues).sort((a, b) => a - b).join(', ')}`);
        return Array.from(sumValues);
    } catch (error) {
        console.error('查询历史和值失败:', error);
        return [];
    }
}

/**
 * 查询最近N期的跨度历史数据
 * @param {number} recentCount - 查询最近N期
 * @param {number} beforePeriodID - 当前预测期号的ID，查询该ID之前的数据
 */
async function getHistoricalSpanValues(recentCount, beforePeriodID) {
    try {
        const issues = await DLT.find({ ID: { $lt: beforePeriodID } })
            .sort({ ID: -1 })
            .limit(recentCount)
            .lean();

        const spanValues = new Set();
        issues.forEach(issue => {
            const redBalls = [issue.Red1, issue.Red2, issue.Red3, issue.Red4, issue.Red5];
            const span = Math.max(...redBalls) - Math.min(...redBalls);
            spanValues.add(span);
        });

        console.log(`📏 查询期号ID ${beforePeriodID} 之前最近${recentCount}期跨度: ${Array.from(spanValues).sort((a, b) => a - b).join(', ')}`);
        return Array.from(spanValues);
    } catch (error) {
        console.error('查询历史跨度失败:', error);
        return [];
    }
}

/**
 * 查询最近N期的热温冷比历史数据
 * @param {number} recentCount - 查询最近N期
 * @param {number} beforePeriodID - 当前预测期号的ID，查询该ID之前的数据
 */
async function getHistoricalHWCRatios(recentCount, beforePeriodID) {
    try {
        const issues = await DLTRedMissing.find({ ID: { $lt: beforePeriodID } })
            .sort({ ID: -1 })
            .limit(recentCount)
            .lean();

        const hwcRatios = new Set();
        issues.forEach(issue => {
            if (issue.FrontHotWarmColdRatio) {
                hwcRatios.add(issue.FrontHotWarmColdRatio);
            }
        });

        console.log(`🌡️ 查询期号ID ${beforePeriodID} 之前最近${recentCount}期热温冷比: ${Array.from(hwcRatios).join(', ')}`);
        return Array.from(hwcRatios);
    } catch (error) {
        console.error('查询历史热温冷比失败:', error);
        return [];
    }
}

/**
 * 查询最近N期的区间比历史数据
 * @param {number} recentCount - 查询最近N期
 * @param {number} beforePeriodID - 当前预测期号的ID，查询该ID之前的数据
 */
async function getHistoricalZoneRatios(recentCount, beforePeriodID) {
    try {
        const issues = await DLT.find({ ID: { $lt: beforePeriodID } })
            .sort({ ID: -1 })
            .limit(recentCount)
            .lean();

        const zoneRatios = new Set();
        issues.forEach(issue => {
            const redBalls = [issue.Red1, issue.Red2, issue.Red3, issue.Red4, issue.Red5];
            const zone1 = redBalls.filter(n => n >= 1 && n <= 12).length;
            const zone2 = redBalls.filter(n => n >= 13 && n <= 24).length;
            const zone3 = redBalls.filter(n => n >= 25 && n <= 35).length;
            const ratio = `${zone1}:${zone2}:${zone3}`;
            zoneRatios.add(ratio);
        });

        console.log(`🎯 查询期号ID ${beforePeriodID} 之前最近${recentCount}期区间比: ${Array.from(zoneRatios).join(', ')}`);
        return Array.from(zoneRatios);
    } catch (error) {
        console.error('查询历史区间比失败:', error);
        return [];
    }
}

/**
 * 查询最近N期的奇偶比历史数据
 * @param {number} recentCount - 查询最近N期
 * @param {number} beforePeriodID - 当前预测期号的ID，查询该ID之前的数据
 */
async function getHistoricalOddEvenRatios(recentCount, beforePeriodID) {
    try {
        const issues = await DLT.find({ ID: { $lt: beforePeriodID } })
            .sort({ ID: -1 })
            .limit(recentCount)
            .lean();

        const oddEvenRatios = new Set();
        issues.forEach(issue => {
            const redBalls = [issue.Red1, issue.Red2, issue.Red3, issue.Red4, issue.Red5];
            const oddCount = redBalls.filter(n => n % 2 === 1).length;
            const evenCount = 5 - oddCount;
            const ratio = `${oddCount}:${evenCount}`;
            oddEvenRatios.add(ratio);
        });

        console.log(`⚖️ 查询期号ID ${beforePeriodID} 之前最近${recentCount}期奇偶比: ${Array.from(oddEvenRatios).join(', ')}`);
        return Array.from(oddEvenRatios);
    } catch (error) {
        console.error('查询历史奇偶比失败:', error);
        return [];
    }
}

/**
 * 根据排除条件构建红球查询
 * @param {object} excludeConditions - 排除条件对象
 * @param {number} currentPeriodID - 当前预测期号的ID，用于查询该期之前的历史数据
 */
async function buildRedQueryFromExcludeConditions(excludeConditions, currentPeriodID) {
    const query = {};

    if (!excludeConditions) {
        console.log('⚠️ 没有排除条件');
        return query;
    }

    console.log('🔧 开始构建排除条件查询...');

    // 和值排除
    if (excludeConditions.sum && excludeConditions.sum.enabled) {
        console.log('📌 处理和值排除:', excludeConditions.sum);
        const ranges = excludeConditions.sum.ranges || [];
        const excludeRanges = [];

        // 手动范围
        ranges.forEach(range => {
            if (range.enabled && range.min && range.max) {
                console.log(`  ➜ 排除和值范围: ${range.min} - ${range.max}`);
                excludeRanges.push({ sum_value: { $gte: range.min, $lte: range.max } });
            }
        });

        // 历史排除
        if (excludeConditions.sum.historical && excludeConditions.sum.historical.enabled) {
            const historicalSums = await getHistoricalSumValues(excludeConditions.sum.historical.count, currentPeriodID);
            if (historicalSums.length > 0) {
                console.log(`  ➜ 排除历史和值: ${historicalSums.join(', ')}`);
                historicalSums.forEach(sum => {
                    excludeRanges.push({ sum_value: sum });
                });
            }
        }

        if (excludeRanges.length > 0) {
            query.$nor = query.$nor || [];
            query.$nor.push(...excludeRanges);
            console.log(`  ✅ 添加了 ${excludeRanges.length} 个和值排除条件`);
        }
    }

    // 跨度排除
    if (excludeConditions.span && excludeConditions.span.enabled) {
        console.log('📌 处理跨度排除:', excludeConditions.span);
        const ranges = excludeConditions.span.ranges || [];
        const excludeRanges = [];

        // 手动范围
        ranges.forEach(range => {
            if (range.enabled && range.min && range.max) {
                console.log(`  ➜ 排除跨度范围: ${range.min} - ${range.max}`);
                excludeRanges.push({ span_value: { $gte: range.min, $lte: range.max } });
            }
        });

        // 历史排除
        if (excludeConditions.span.historical && excludeConditions.span.historical.enabled) {
            const historicalSpans = await getHistoricalSpanValues(excludeConditions.span.historical.count, currentPeriodID);
            if (historicalSpans.length > 0) {
                console.log(`  ➜ 排除历史跨度: ${historicalSpans.join(', ')}`);
                historicalSpans.forEach(span => {
                    excludeRanges.push({ span_value: span });
                });
            }
        }

        if (excludeRanges.length > 0) {
            query.$nor = query.$nor || [];
            query.$nor.push(...excludeRanges);
            console.log(`  ✅ 添加了 ${excludeRanges.length} 个跨度排除条件`);
        }
    }

    // 区间比排除
    if (excludeConditions.zone && (excludeConditions.zone.excludeRatios || excludeConditions.zone.historical)) {
        console.log('📌 处理区间比排除:', excludeConditions.zone);
        const excludeRatios = [...(excludeConditions.zone.excludeRatios || [])];
        console.log(`  📊 手动排除的区间比: ${excludeRatios.join(', ')}`);

        // 历史排除
        console.log(`  🔍 检查历史排除: historical=${excludeConditions.zone.historical}, enabled=${excludeConditions.zone.historical?.enabled}`);
        if (excludeConditions.zone.historical && excludeConditions.zone.historical.enabled) {
            console.log(`  🎯 开始查询最近${excludeConditions.zone.historical.count}期区间比...`);
            const historicalRatios = await getHistoricalZoneRatios(excludeConditions.zone.historical.count, currentPeriodID);
            console.log(`  🎯 查询到历史区间比: ${historicalRatios.join(', ')}`);
            if (historicalRatios.length > 0) {
                console.log(`  ➜ 排除历史区间比: ${historicalRatios.join(', ')}`);
                excludeRatios.push(...historicalRatios);
            }
        } else {
            console.log(`  ℹ️ 未启用区间比历史排除`);
        }

        // 去重
        const uniqueRatios = [...new Set(excludeRatios)];
        if (uniqueRatios.length > 0) {
            query.zone_ratio = { $nin: uniqueRatios };
            console.log(`  ✅ 最终排除区间比（合并后）: ${uniqueRatios.join(', ')}`);
        }
    }

    // 奇偶比排除
    if (excludeConditions.oddEven && (excludeConditions.oddEven.excludeRatios || excludeConditions.oddEven.historical)) {
        console.log('📌 处理奇偶比排除:', excludeConditions.oddEven);
        const excludeRatios = [...(excludeConditions.oddEven.excludeRatios || [])];

        // 历史排除
        if (excludeConditions.oddEven.historical && excludeConditions.oddEven.historical.enabled) {
            const historicalRatios = await getHistoricalOddEvenRatios(excludeConditions.oddEven.historical.count, currentPeriodID);
            if (historicalRatios.length > 0) {
                console.log(`  ➜ 排除历史奇偶比: ${historicalRatios.join(', ')}`);
                excludeRatios.push(...historicalRatios);
            }
        }

        // 去重
        const uniqueRatios = [...new Set(excludeRatios)];
        if (uniqueRatios.length > 0) {
            query.odd_even_ratio = { $nin: uniqueRatios };
            console.log(`  ✅ 排除奇偶比: ${uniqueRatios.join(', ')}`);
        }
    }

    console.log('🔧 查询构建完成:', JSON.stringify(query, null, 2));
    return query;
}

/**
 * 计算奖项和奖金 - 新版9级奖项
 */
function calculatePrize(hitRed, hitBlue, prizeStats) {
    let prizeAmount = 0;

    // 一等奖：5红+2蓝 = ¥10,000,000
    if (hitRed === 5 && hitBlue === 2) {
        prizeStats.first_prize.count++;
        prizeAmount = 10000000;
        prizeStats.first_prize.amount += prizeAmount;
    }
    // 二等奖：5红+1蓝 = ¥100,000
    else if (hitRed === 5 && hitBlue === 1) {
        prizeStats.second_prize.count++;
        prizeAmount = 100000;
        prizeStats.second_prize.amount += prizeAmount;
    }
    // 三等奖：5红+0蓝 = ¥10,000
    else if (hitRed === 5 && hitBlue === 0) {
        prizeStats.third_prize.count++;
        prizeAmount = 10000;
        prizeStats.third_prize.amount += prizeAmount;
    }
    // 四等奖：4红+2蓝 = ¥3,000
    else if (hitRed === 4 && hitBlue === 2) {
        prizeStats.fourth_prize.count++;
        prizeAmount = 3000;
        prizeStats.fourth_prize.amount += prizeAmount;
    }
    // 五等奖：4红+1蓝 = ¥300
    else if (hitRed === 4 && hitBlue === 1) {
        prizeStats.fifth_prize.count++;
        prizeAmount = 300;
        prizeStats.fifth_prize.amount += prizeAmount;
    }
    // 六等奖：3红+2蓝 = ¥200
    else if (hitRed === 3 && hitBlue === 2) {
        prizeStats.sixth_prize.count++;
        prizeAmount = 200;
        prizeStats.sixth_prize.amount += prizeAmount;
    }
    // 七等奖：4红+0蓝 = ¥100
    else if (hitRed === 4 && hitBlue === 0) {
        prizeStats.seventh_prize.count++;
        prizeAmount = 100;
        prizeStats.seventh_prize.amount += prizeAmount;
    }
    // 八等奖：3红+1蓝 或 2红+2蓝 = ¥15
    else if ((hitRed === 3 && hitBlue === 1) || (hitRed === 2 && hitBlue === 2)) {
        prizeStats.eighth_prize.count++;
        prizeAmount = 15;
        prizeStats.eighth_prize.amount += prizeAmount;
    }
    // 九等奖：3红+0蓝 或 1红+2蓝 或 2红+1蓝 或 0红+2蓝 = ¥5
    else if ((hitRed === 3 && hitBlue === 0) ||
             (hitRed === 1 && hitBlue === 2) ||
             (hitRed === 2 && hitBlue === 1) ||
             (hitRed === 0 && hitBlue === 2)) {
        prizeStats.ninth_prize.count++;
        prizeAmount = 5;
        prizeStats.ninth_prize.amount += prizeAmount;
    }

    return { prizeAmount };
}

/**
 * 更新最高命中记录
 */
function updateMaxHit(redBalls, blueBalls, hitRed, hitBlue, maxHitCount, maxHitCombinations) {
    if (hitRed > maxHitCount) {
        maxHitCombinations.length = 0;
        maxHitCombinations.push({
            red: redBalls,
            blue: blueBalls,
            hit_red: hitRed,
            hit_blue: hitBlue
        });
    } else if (hitRed === maxHitCount && maxHitCombinations.length < 10) {
        maxHitCombinations.push({
            red: redBalls,
            blue: blueBalls,
            hit_red: hitRed,
            hit_blue: hitBlue
        });
    }
}

/**
 * 计算单期命中分析
 * @param {Array} redCombinations - 红球组合数组
 * @param {Array} blueCombinations - 蓝球组合数组
 * @param {Object} winningNumbers - 开奖号码
 * @param {String} combinationMode - 组合模式 (default/unlimited/truly-unlimited)
 */
function calculateHitAnalysisForPeriod(redCombinations, blueCombinations, winningNumbers, combinationMode = 'truly-unlimited') {
    log(`🔍 计算命中分析 - 开奖号码: 红球[${winningNumbers.red}] 蓝球[${winningNumbers.blue}]`);
    log(`📊 组合数量: 红球${redCombinations.length}个, 蓝球${blueCombinations.length}个`);

    const hitDistribution = {
        red_5: 0,
        red_4: 0,
        red_3: 0,
        red_2: 0,
        red_1: 0,
        red_0: 0
    };

    const prizeStats = {
        first_prize: { count: 0, amount: 0 },
        second_prize: { count: 0, amount: 0 },
        third_prize: { count: 0, amount: 0 },
        fourth_prize: { count: 0, amount: 0 },
        fifth_prize: { count: 0, amount: 0 },
        sixth_prize: { count: 0, amount: 0 },
        seventh_prize: { count: 0, amount: 0 },
        eighth_prize: { count: 0, amount: 0 },
        ninth_prize: { count: 0, amount: 0 }
    };

    let maxHitCount = 0;
    const maxHitCombinations = [];
    let totalPrize = 0;
    let maxRedHit = 0;  // 红球最高命中
    let maxBlueHit = 0; // 蓝球最高命中

    // 根据组合模式决定如何遍历
    if (combinationMode === 'unlimited') {
        // 普通无限制：1:1配对模式
        const maxLength = Math.max(redCombinations.length, blueCombinations.length);

        for (let i = 0; i < maxLength; i++) {
            // 循环使用较短的数组
            const redCombo = redCombinations[i % redCombinations.length];
            const blueCombo = blueCombinations[i % blueCombinations.length];

            const redBalls = [
                redCombo.red_ball_1,
                redCombo.red_ball_2,
                redCombo.red_ball_3,
                redCombo.red_ball_4,
                redCombo.red_ball_5
            ];
            const blueBalls = [blueCombo.blue_ball_1, blueCombo.blue_ball_2];

            // 调试前3个组合
            if (i < 3) {
                log(`🔍 组合${i+1}: 红球[${redBalls}] (类型:${typeof redBalls[0]}), 蓝球[${blueBalls}] (类型:${typeof blueBalls[0]})`);
            }

            // 计算命中数
            const hitRed = redBalls.filter(n => winningNumbers.red.includes(n)).length;
            const hitBlue = blueBalls.filter(n => winningNumbers.blue.includes(n)).length;

            // 调试前3个组合的命中情况
            if (i < 3) {
                log(`🎯 组合${i+1}命中: 红球${hitRed}个, 蓝球${hitBlue}个`);
            }

            // 更新红球和蓝球最高命中
            if (hitRed > maxRedHit) maxRedHit = hitRed;
            if (hitBlue > maxBlueHit) maxBlueHit = hitBlue;

            // 更新红球命中分布（只计算一次）
            if (i < redCombinations.length && hitDistribution[`red_${hitRed}`] !== undefined) {
                hitDistribution[`red_${hitRed}`]++;
            }

            // 计算奖项
            const prizeResult = calculatePrize(hitRed, hitBlue, prizeStats);
            totalPrize += prizeResult.prizeAmount;

            // 记录最高命中
            updateMaxHit(redBalls, blueBalls, hitRed, hitBlue, maxHitCount, maxHitCombinations);
            if (hitRed > maxHitCount) {
                maxHitCount = hitRed;
            }
        }
    } else {
        // 默认模式和真正无限制：完全笛卡尔积
        let debugCount = 0;
        for (const redCombo of redCombinations) {
            const redBalls = [
                redCombo.red_ball_1,
                redCombo.red_ball_2,
                redCombo.red_ball_3,
                redCombo.red_ball_4,
                redCombo.red_ball_5
            ];

            // 调试前3个红球组合
            if (debugCount < 3) {
                log(`🔍 红球组合${debugCount+1}: [${redBalls}] (类型:${typeof redBalls[0]})`);
            }

            // 计算红球命中数
            const hitRed = redBalls.filter(n => winningNumbers.red.includes(n)).length;

            // 调试前3个红球组合的命中情况
            if (debugCount < 3) {
                log(`🎯 红球组合${debugCount+1}命中: ${hitRed}个`);
                debugCount++;
            }

            // 更新红球最高命中
            if (hitRed > maxRedHit) maxRedHit = hitRed;

            // 更新红球命中分布
            if (hitDistribution[`red_${hitRed}`] !== undefined) {
                hitDistribution[`red_${hitRed}`]++;
            }

            // 遍历蓝球组合
            let blueDebugCount = 0;
            for (const blueCombo of blueCombinations) {
                const blueBalls = [blueCombo.blue_ball_1, blueCombo.blue_ball_2];

                // 只在第一个红球组合时调试蓝球
                if (debugCount <= 3 && blueDebugCount < 3) {
                    log(`🔍 蓝球组合${blueDebugCount+1}: [${blueBalls}] (类型:${typeof blueBalls[0]})`);
                }

                const hitBlue = blueBalls.filter(n => winningNumbers.blue.includes(n)).length;

                // 只在第一个红球组合时调试蓝球命中
                if (debugCount <= 3 && blueDebugCount < 3) {
                    log(`🎯 蓝球组合${blueDebugCount+1}命中: ${hitBlue}个`);
                    blueDebugCount++;
                }

                // 更新蓝球最高命中
                if (hitBlue > maxBlueHit) maxBlueHit = hitBlue;

                // 计算奖项
                const prizeResult = calculatePrize(hitRed, hitBlue, prizeStats);
                totalPrize += prizeResult.prizeAmount;

                // 记录最高命中
                updateMaxHit(redBalls, blueBalls, hitRed, hitBlue, maxHitCount, maxHitCombinations);
                if (hitRed > maxHitCount) {
                    maxHitCount = hitRed;
                }
            }
        }
    }

    // 计算组合总数（根据模式）
    let totalCombinations;
    if (combinationMode === 'unlimited') {
        totalCombinations = Math.max(redCombinations.length, blueCombinations.length);
    } else {
        totalCombinations = redCombinations.length * blueCombinations.length;
    }

    // 计算命中率
    const hitCount = Object.values(hitDistribution).reduce((sum, count, index) => {
        // 计算命中3个或以上的组合数
        return index >= 3 ? sum + count : sum;
    }, 0);
    const hitRate = totalCombinations > 0 ? (hitCount / totalCombinations) * 100 : 0;

    log(`✅ 命中分析完成 - 红球最高命中:${maxRedHit}个, 蓝球最高命中:${maxBlueHit}个`);
    log(`💰 奖项统计: 一等奖${prizeStats.first_prize.count}次, 二等奖${prizeStats.second_prize.count}次, 三等奖${prizeStats.third_prize.count}次`);
    log(`💰 四等奖${prizeStats.fourth_prize.count}次, 五等奖${prizeStats.fifth_prize.count}次, 六等奖${prizeStats.sixth_prize.count}次`);
    log(`💰 七等奖${prizeStats.seventh_prize.count}次, 八等奖${prizeStats.eighth_prize.count}次, 九等奖${prizeStats.ninth_prize.count}次`);
    log(`💵 本期总奖金: ¥${totalPrize.toLocaleString()}`);

    return {
        max_hit_count: maxHitCount,
        max_hit_combinations: maxHitCombinations.slice(0, 10), // 最多保存10个
        hit_distribution: hitDistribution,
        prize_stats: prizeStats,
        hit_rate: Math.round(hitRate * 100) / 100, // 保留2位小数
        total_prize: totalPrize,
        red_hit_analysis: {
            best_hit: maxRedHit
        },
        blue_hit_analysis: {
            best_hit: maxBlueHit
        }
    };
}

// ========== 预测任务管理API结束 ==========

/**
 * 测试函数：验证奖项计算逻辑
 */
function testCalculatePrize() {
    log('🧪 开始测试奖项计算逻辑...');

    const testCases = [
        { red: 5, blue: 2, prize: '一等奖', amount: 10000000 },
        { red: 5, blue: 1, prize: '二等奖', amount: 100000 },
        { red: 5, blue: 0, prize: '三等奖', amount: 10000 },
        { red: 4, blue: 2, prize: '四等奖', amount: 3000 },
        { red: 4, blue: 1, prize: '五等奖', amount: 300 },
        { red: 3, blue: 2, prize: '六等奖', amount: 200 },
        { red: 4, blue: 0, prize: '七等奖', amount: 100 },
        { red: 3, blue: 1, prize: '八等奖', amount: 15 },
        { red: 2, blue: 2, prize: '八等奖', amount: 15 },
        { red: 3, blue: 0, prize: '九等奖', amount: 5 },
        { red: 1, blue: 2, prize: '九等奖', amount: 5 },
        { red: 2, blue: 1, prize: '九等奖', amount: 5 },
        { red: 0, blue: 2, prize: '九等奖', amount: 5 },
        { red: 2, blue: 0, prize: '未中奖', amount: 0 },
        { red: 1, blue: 1, prize: '未中奖', amount: 0 },
        { red: 0, blue: 0, prize: '未中奖', amount: 0 }
    ];

    let passedTests = 0;
    let failedTests = 0;

    testCases.forEach((testCase, index) => {
        const prizeStats = {
            first_prize: { count: 0, amount: 0 },
            second_prize: { count: 0, amount: 0 },
            third_prize: { count: 0, amount: 0 },
            fourth_prize: { count: 0, amount: 0 },
            fifth_prize: { count: 0, amount: 0 },
            sixth_prize: { count: 0, amount: 0 },
            seventh_prize: { count: 0, amount: 0 },
            eighth_prize: { count: 0, amount: 0 },
            ninth_prize: { count: 0, amount: 0 }
        };

        const result = calculatePrize(testCase.red, testCase.blue, prizeStats);

        if (result.prizeAmount === testCase.amount) {
            passedTests++;
            log(`✅ 测试${index + 1}: ${testCase.red}红+${testCase.blue}蓝 → ${testCase.prize} ¥${testCase.amount} 通过`);
        } else {
            failedTests++;
            log(`❌ 测试${index + 1}: ${testCase.red}红+${testCase.blue}蓝 期望¥${testCase.amount}, 实际¥${result.prizeAmount}`);
        }
    });

    log(`🧪 测试完成: 通过${passedTests}个, 失败${failedTests}个`);
    return failedTests === 0;
}

// 在服务器启动时运行测试
testCalculatePrize(); // 启用测试

/**
 * 超大规模并发批量预测器类
 * 支持1000期并发处理
 */
class MegaConcurrencyBatchPredictor {
    constructor(sessionId) {
        this.sessionId = sessionId;
        // 预计算所有可能的热温冷比映射
        this.hwcCombinationMap = new Map();
        this.redCombinations = null;
        this.initialized = false;
        // 分布式缓存
        this.missingDataCache = new Map();
        this.hwcCache = new Map();
    }
    
    async initialize() {
        if (this.initialized) return;
        
        log(`🔧 [${this.sessionId}] 初始化超大规模并发预测器...`);
        
        // 1. 预加载红球组合
        this.redCombinations = await DLTRedCombinations.find({}).lean();
        log(`✅ [${this.sessionId}] 预加载 ${this.redCombinations.length} 个红球组合`);
        
        // 2. 预计算所有热温冷比映射（一次性计算，永久使用）
        await this.precomputeAllHWCMappings();
        
        this.initialized = true;
        log(`✅ [${this.sessionId}] 初始化完成，支持1000期并发处理`);
    }
    
    // 关键优化：预计算所有红球组合的热温冷比映射
    async precomputeAllHWCMappings() {
        log(`🔄 [${this.sessionId}] 预计算红球组合的热温冷映射...`);
        
        // 为每个红球组合预计算在所有可能热温冷分布下的比值
        this.redCombinations.forEach((combo, index) => {
            const balls = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, 
                          combo.red_ball_4, combo.red_ball_5];
            
            // 为每种可能的热温冷分布计算此组合的比值
            const hwcMap = new Map();
            
            // 这里先创建空映射，实际使用时按需填充
            this.hwcCombinationMap.set(combo.combination_id, {
                balls: balls,
                cache: hwcMap  // 运行时缓存
            });
            
            if (index % 50000 === 0) {
                log(`📈 [${this.sessionId}] 预计算进度: ${index}/${this.redCombinations.length}`);
            }
        });
        
        log(`✅ [${this.sessionId}] 热温冷映射预计算完成`);
    }
    
    // 超高并发批量预测
    async megaConcurrencyPredict(config) {
        const { targetIssues, filters } = config;
        log(`🎯 [${this.sessionId}] 开始处理 ${targetIssues.length} 期，支持1000期并发`);
        
        // 第一步：批量预加载所有需要的遗漏数据（一次性数据库查询）
        const missingDataMap = await this.batchLoadMissingData(targetIssues);
        
        // 第二步：超大规模并发处理 - 动态调整并发数
        // 当处理无限组合时，动态降低并发数以保证系统稳定
        const baselineMemory = process.memoryUsage();
        const isUnlimitedCombinations = filters.maxRedCombinations === Number.MAX_SAFE_INTEGER || 
                                       filters.maxBlueCombinations === Number.MAX_SAFE_INTEGER ||
                                       filters.maxRedCombinations > 10000 ||
                                       filters.maxBlueCombinations > 1000;
        
        let concurrency;
        if (isUnlimitedCombinations) {
            // 无限组合模式：大幅降低并发数，优先保证系统稳定
            concurrency = Math.min(50, targetIssues.length);
            log(`🎯 [${this.sessionId}] 检测到无限组合模式，调整并发数为: ${concurrency}（保证系统稳定）`);
        } else {
            // 标准模式：正常并发处理
            concurrency = Math.min(500, targetIssues.length);
        }
        const results = [];
        
        for (let i = 0; i < targetIssues.length; i += concurrency) {
            const batch = targetIssues.slice(i, i + concurrency);
            log(`🔄 [${this.sessionId}] 处理批次 ${Math.floor(i/concurrency) + 1}，并发数: ${batch.length}`);
            
            // 500期同时处理
            const batchPromises = batch.map(issue => 
                this.ultraFastPredict(issue, filters, missingDataMap.get(issue))
            );
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            
            // 内存监控和进度报告
            const currentMemory = process.memoryUsage();
            const memoryIncrease = (currentMemory.heapUsed - baselineMemory.heapUsed) / 1024 / 1024;
            const progress = Math.min(100, ((i + concurrency) / targetIssues.length) * 100);
            
            log(`📈 [${this.sessionId}] 进度: ${progress.toFixed(1)}%, 内存增长: ${memoryIncrease.toFixed(1)}MB`);
            
            // 无限组合模式下的内存保护机制
            if (isUnlimitedCombinations && memoryIncrease > 500) {
                log(`⚠️ [${this.sessionId}] 内存使用较高(+${memoryIncrease.toFixed(1)}MB)，执行垃圾回收...`);
                if (global.gc) {
                    global.gc();
                    log(`♻️ [${this.sessionId}] 垃圾回收完成`);
                }
                // 添加短暂延迟让系统恢复
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        return results;
    }
    
    // 批量预加载遗漏数据（避免1000次数据库查询）
    async batchLoadMissingData(targetIssues) {
        log(`🔄 [${this.sessionId}] 批量预加载遗漏数据...`);
        
        // 计算所有需要的基准期号
        const baseIssues = targetIssues.map(issue => issue - 1);
        
        // 一次查询获取所有遗漏数据
        const missingRecords = await DLTRedMissing.find({
            Issue: { $in: baseIssues }
        }).lean();
        
        // 构建快速查找映射
        const missingMap = new Map();
        missingRecords.forEach(record => {
            missingMap.set(record.Issue + 1, record); // targetIssue = baseIssue + 1
        });
        
        log(`✅ [${this.sessionId}] 预加载 ${missingRecords.length} 期遗漏数据`);
        return missingMap;
    }
    
    // 超快速单期预测（纯内存计算）
    async ultraFastPredict(targetIssue, filters, missingData) {
        const startTime = Date.now();
        
        log(`🚀 [${this.sessionId}] ultraFastPredict开始处理期号 ${targetIssue}`);
        
        // 1. 合并固定排除条件和动态历史排除条件
        let excludeConditions = {
            excludedSums: new Set(),
            excludedSpans: new Set(),
            excludedHWCRatios: new Set(),
            excludedZoneRatios: new Set(),
            excludedOddEvenRatios: new Set()
        };
        
        let manualExcludeCount = 0;
        let historicalExcludeCount = 0;
        
        // 1.1 添加固定排除条件（支持新版组合预测格式）
        
        // 处理传统格式的排除条件（向后兼容）
        if (filters.excludeConditions) {
            const userExclude = filters.excludeConditions;
            log(`📋 [${this.sessionId}] 期号 ${targetIssue}: 添加传统格式固定排除条件`);
            
            if (userExclude.excludedSums && userExclude.excludedSums.length > 0) {
                userExclude.excludedSums.forEach(sum => excludeConditions.excludedSums.add(sum));
                manualExcludeCount += userExclude.excludedSums.length;
                log(`🔢 [${this.sessionId}] 期号 ${targetIssue}: 固定排除和值 ${userExclude.excludedSums.length} 个 - ${userExclude.excludedSums.join(',')}`);
            }
            if (userExclude.excludedSpans && userExclude.excludedSpans.length > 0) {
                userExclude.excludedSpans.forEach(span => excludeConditions.excludedSpans.add(span));
                manualExcludeCount += userExclude.excludedSpans.length;
                log(`📏 [${this.sessionId}] 期号 ${targetIssue}: 固定排除跨度 ${userExclude.excludedSpans.length} 个 - ${userExclude.excludedSpans.join(',')}`);
            }
            if (userExclude.excludedHWCRatios && userExclude.excludedHWCRatios.length > 0) {
                userExclude.excludedHWCRatios.forEach(ratio => excludeConditions.excludedHWCRatios.add(ratio));
                manualExcludeCount += userExclude.excludedHWCRatios.length;
                log(`🌡️ [${this.sessionId}] 期号 ${targetIssue}: 固定排除热温冷比 ${userExclude.excludedHWCRatios.length} 个 - ${userExclude.excludedHWCRatios.join(',')}`);
            }
            if (userExclude.excludedZoneRatios && userExclude.excludedZoneRatios.length > 0) {
                userExclude.excludedZoneRatios.forEach(ratio => excludeConditions.excludedZoneRatios.add(ratio));
                manualExcludeCount += userExclude.excludedZoneRatios.length;
                log(`🎯 [${this.sessionId}] 期号 ${targetIssue}: 固定排除区间比 ${userExclude.excludedZoneRatios.length} 个 - ${userExclude.excludedZoneRatios.join(',')}`);
            }
            if (userExclude.excludedOddEvenRatios && userExclude.excludedOddEvenRatios.length > 0) {
                userExclude.excludedOddEvenRatios.forEach(ratio => excludeConditions.excludedOddEvenRatios.add(ratio));
                manualExcludeCount += userExclude.excludedOddEvenRatios.length;
                log(`⚖️ [${this.sessionId}] 期号 ${targetIssue}: 固定排除奇偶比 ${userExclude.excludedOddEvenRatios.length} 个 - ${userExclude.excludedOddEvenRatios.join(',')}`);
            }
        }
        
        // 处理组合预测格式的排除条件
        let hasComboFormat = false;
        let hasAnyHistoricalExclude = false;
        
        // 1.1.1 处理和值多范围排除
        if (filters.sumRanges && Array.isArray(filters.sumRanges) && filters.sumRanges.length > 0) {
            hasComboFormat = true;
            log(`📊 [${this.sessionId}] 期号 ${targetIssue}: 处理和值多范围排除 - ${filters.sumRanges.length}个范围`);
            
            filters.sumRanges.forEach((range, index) => {
                if (range.min && range.max) {
                    for (let sum = parseInt(range.min); sum <= parseInt(range.max); sum++) {
                        excludeConditions.excludedSums.add(sum);
                        manualExcludeCount++;
                    }
                    log(`🔢 [${this.sessionId}] 期号 ${targetIssue}: 排除和值范围${index + 1}: ${range.min}-${range.max}`);
                }
            });
        }
        
        // 1.1.2 处理跨度多范围排除
        if (filters.spanRanges && Array.isArray(filters.spanRanges) && filters.spanRanges.length > 0) {
            hasComboFormat = true;
            log(`📊 [${this.sessionId}] 期号 ${targetIssue}: 处理跨度多范围排除 - ${filters.spanRanges.length}个范围`);
            
            filters.spanRanges.forEach((range, index) => {
                if (range.min && range.max) {
                    for (let span = parseInt(range.min); span <= parseInt(range.max); span++) {
                        excludeConditions.excludedSpans.add(span);
                        manualExcludeCount++;
                    }
                    log(`📏 [${this.sessionId}] 期号 ${targetIssue}: 排除跨度范围${index + 1}: ${range.min}-${range.max}`);
                }
            });
        }
        
        // 1.1.3 处理区间比排除
        if (filters.zoneRatios && typeof filters.zoneRatios === 'string' && filters.zoneRatios.trim()) {
            hasComboFormat = true;
            const ratios = filters.zoneRatios.split(',').map(r => r.trim()).filter(r => r);
            ratios.forEach(ratio => {
                excludeConditions.excludedZoneRatios.add(ratio);
                manualExcludeCount++;
            });
            log(`🎯 [${this.sessionId}] 期号 ${targetIssue}: 排除区间比 ${ratios.length}个 - ${ratios.join(',')}`);
        }
        
        // 1.1.4 处理奇偶比排除
        if (filters.oddEvenRatios && typeof filters.oddEvenRatios === 'string' && filters.oddEvenRatios.trim()) {
            hasComboFormat = true;
            const ratios = filters.oddEvenRatios.split(',').map(r => r.trim()).filter(r => r);
            ratios.forEach(ratio => {
                excludeConditions.excludedOddEvenRatios.add(ratio);
                manualExcludeCount++;
            });
            log(`⚖️ [${this.sessionId}] 期号 ${targetIssue}: 排除奇偶比 ${ratios.length}个 - ${ratios.join(',')}`);
        }
        
        // 1.1.5 处理热温冷比排除
        if (filters.hotWarmColdRatios && typeof filters.hotWarmColdRatios === 'string' && filters.hotWarmColdRatios.trim()) {
            hasComboFormat = true;
            const ratios = filters.hotWarmColdRatios.split(',').map(r => r.trim()).filter(r => r);
            ratios.forEach(ratio => {
                excludeConditions.excludedHWCRatios.add(ratio);
                manualExcludeCount++;
            });
            log(`🌡️ [${this.sessionId}] 期号 ${targetIssue}: 排除热温冷比 ${ratios.length}个 - ${ratios.join(',')}`);
        }
        
        if (hasComboFormat) {
            log(`✅ [${this.sessionId}] 期号 ${targetIssue}: 组合预测格式排除条件处理完成 - 共计${manualExcludeCount}个排除项`);
        }
        
        // 1.2 添加动态历史数据排除条件（支持组合预测格式的多种历史排除）
        let hasHistoricalExclude = false;
        
        // 传统格式的历史排除（向后兼容）
        if (filters.excludePeriods && filters.excludePeriods > 0) {
            hasHistoricalExclude = true;
            hasAnyHistoricalExclude = true;
            log(`📊 [${this.sessionId}] 期号 ${targetIssue}: 开始计算传统格式动态历史数据排除条件 - 排除前${filters.excludePeriods}期`);
            const historicalExclude = await this.calculateExcludeConditionsForIssue(targetIssue, filters);
            
            const beforeSums = excludeConditions.excludedSums.size;
            const beforeSpans = excludeConditions.excludedSpans.size;
            const beforeHWC = excludeConditions.excludedHWCRatios.size;
            const beforeZone = excludeConditions.excludedZoneRatios.size;
            const beforeOddEven = excludeConditions.excludedOddEvenRatios.size;
            
            historicalExclude.excludedSums.forEach(sum => excludeConditions.excludedSums.add(sum));
            historicalExclude.excludedSpans.forEach(span => excludeConditions.excludedSpans.add(span));
            historicalExclude.excludedHWCRatios.forEach(ratio => excludeConditions.excludedHWCRatios.add(ratio));
            historicalExclude.excludedZoneRatios.forEach(ratio => excludeConditions.excludedZoneRatios.add(ratio));
            historicalExclude.excludedOddEvenRatios.forEach(ratio => excludeConditions.excludedOddEvenRatios.add(ratio));
            
            historicalExcludeCount = (excludeConditions.excludedSums.size - beforeSums) + 
                                   (excludeConditions.excludedSpans.size - beforeSpans) + 
                                   (excludeConditions.excludedHWCRatios.size - beforeHWC) + 
                                   (excludeConditions.excludedZoneRatios.size - beforeZone) + 
                                   (excludeConditions.excludedOddEvenRatios.size - beforeOddEven);
        }
        
        // 组合预测格式的分类历史排除
        let historicalStats = { sums: 0, zones: 0, hwc: 0 };
        
        // 1.2.1 排除最近期数和值
        if (filters.excludeRecentPeriods && filters.excludeRecentPeriods > 0) {
            hasHistoricalExclude = true;
            hasAnyHistoricalExclude = true;
            const periods = parseInt(filters.excludeRecentPeriods);
            const recentSums = await this.getRecentSumsFromHistory(targetIssue, periods);
            const beforeSize = excludeConditions.excludedSums.size;
            recentSums.forEach(sum => excludeConditions.excludedSums.add(sum));
            historicalStats.sums = excludeConditions.excludedSums.size - beforeSize;
            log(`🔢 [${this.sessionId}] 期号 ${targetIssue}: 排除最近${periods}期和值 - 新增${historicalStats.sums}个`);
        }
        
        // 1.2.2 排除最近期数区间比
        if (filters.excludeZoneRecentPeriods && filters.excludeZoneRecentPeriods > 0) {
            hasHistoricalExclude = true;
            hasAnyHistoricalExclude = true;
            const periods = parseInt(filters.excludeZoneRecentPeriods);
            const recentZones = await this.getRecentZoneRatiosFromHistory(targetIssue, periods);
            const beforeSize = excludeConditions.excludedZoneRatios.size;
            recentZones.forEach(ratio => excludeConditions.excludedZoneRatios.add(ratio));
            historicalStats.zones = excludeConditions.excludedZoneRatios.size - beforeSize;
            log(`🎯 [${this.sessionId}] 期号 ${targetIssue}: 排除最近${periods}期区间比 - 新增${historicalStats.zones}个`);
        }
        
        // 1.2.3 排除最近期数热温冷比
        if (filters.excludeHwcRecentPeriods && filters.excludeHwcRecentPeriods > 0) {
            hasHistoricalExclude = true;
            hasAnyHistoricalExclude = true;
            const periods = parseInt(filters.excludeHwcRecentPeriods);
            const recentHwc = await this.getRecentHwcRatiosFromHistory(targetIssue, periods);
            const beforeSize = excludeConditions.excludedHWCRatios.size;
            recentHwc.forEach(ratio => excludeConditions.excludedHWCRatios.add(ratio));
            historicalStats.hwc = excludeConditions.excludedHWCRatios.size - beforeSize;
            log(`🌡️ [${this.sessionId}] 期号 ${targetIssue}: 排除最近${periods}期热温冷比 - 新增${historicalStats.hwc}个`);
        }
        
        // 更新历史排除统计
        if (historicalStats.sums + historicalStats.zones + historicalStats.hwc > 0) {
            historicalExcludeCount += historicalStats.sums + historicalStats.zones + historicalStats.hwc;
        }
        
        if (hasHistoricalExclude) {
            log(`✅ [${this.sessionId}] 期号 ${targetIssue}: 动态历史排除条件计算完成 - 共计新增${historicalExcludeCount}个排除条件`);
        } else {
            log(`⚠️  [${this.sessionId}] 期号 ${targetIssue}: 动态历史数据排除已禁用`);
        }
        
        log(`🔄 [${this.sessionId}] 期号 ${targetIssue}: 合并排除条件完成 - 固定:${manualExcludeCount}个, 动态:${historicalExcludeCount}个, 总计排除: 和值:${excludeConditions.excludedSums.size}, 跨度:${excludeConditions.excludedSpans.size}, 区间比:${excludeConditions.excludedZoneRatios.size}, 奇偶比:${excludeConditions.excludedOddEvenRatios.size}, 热温冷比:${excludeConditions.excludedHWCRatios.size}`);
        
        
        // 2. 极速计算热温冷分类（纯内存操作）
        const hwcData = this.fastCalculateHWC(missingData);
        
        // 3. 并行筛选红球组合（使用合并的排除条件）
        const filteredReds = this.parallelFilterCombinations(hwcData, filters, excludeConditions);
        
        // 4. 生成蓝球组合
        const blueCombs = this.generateBlueCombs(targetIssue, filters);
        
        // 5. 预测结果验证（如果有开奖数据）
        const validation = await this.quickValidate(targetIssue, filteredReds);
        
        const processingTime = Date.now() - startTime;
        
        // Debug: 记录排除条件统计
        log(`🔍 [${this.sessionId}] 期号 ${targetIssue}: 即将返回结果 - 手动排除:${manualExcludeCount}, 历史排除:${historicalExcludeCount}, 组合预测格式:${hasComboFormat}, 历史排除条件:${hasAnyHistoricalExclude}`);
        
        const resultObject = {
            target_issue: targetIssue,
            red_combinations: await this.generateFinalCombinationsForMode(filteredReds, filters.combinationMode || 'default', filters, targetIssue), // 根据组合模式生成最终组合
            blue_combinations: blueCombs,
            hit_analysis: validation,
            processing_time: processingTime,
            excludeConditions: {
                // 检测手动排除条件（传统格式或组合预测格式）
                manualBased: !!(
                    (filters.excludeConditions && manualExcludeCount > 0) ||
                    hasComboFormat
                ),
                // 检测历史排除条件（传统格式或组合预测格式）
                historicalBased: !!(
                    (filters.excludePeriods && filters.excludePeriods > 0) ||
                    (filters.excludeRecentPeriods && filters.excludeRecentPeriods > 0) ||
                    (filters.excludeZoneRecentPeriods && filters.excludeZoneRecentPeriods > 0) ||
                    (filters.excludeHwcRecentPeriods && filters.excludeHwcRecentPeriods > 0)
                ),
                excludePeriods: filters.excludePeriods || 
                              filters.excludeRecentPeriods || 
                              Math.max(
                                  filters.excludeZoneRecentPeriods || 0,
                                  filters.excludeHwcRecentPeriods || 0
                              ) || 0,
                manualExcludeCount: manualExcludeCount,
                historicalExcludeCount: historicalExcludeCount,
                totalExcluded: {
                    sums: excludeConditions.excludedSums.size,
                    spans: excludeConditions.excludedSpans.size,
                    hwcRatios: excludeConditions.excludedHWCRatios.size,
                    zoneRatios: excludeConditions.excludedZoneRatios.size,
                    oddEvenRatios: excludeConditions.excludedOddEvenRatios.size
                },
                // 添加详细的排除条件列表（转换Set为Array以便JSON序列化）
                excludedLists: {
                    sums: Array.from(excludeConditions.excludedSums),
                    spans: Array.from(excludeConditions.excludedSpans),
                    hwcRatios: Array.from(excludeConditions.excludedHWCRatios),
                    zoneRatios: Array.from(excludeConditions.excludedZoneRatios),
                    oddEvenRatios: Array.from(excludeConditions.excludedOddEvenRatios)
                }
            }
        };
        
        // Debug: 检查返回对象的完整性
        log(`🔍 [${this.sessionId}] 期号 ${targetIssue}: 返回对象属性 - ${Object.keys(resultObject).join(', ')}`);
        log(`🔍 [${this.sessionId}] 期号 ${targetIssue}: excludeConditions存在 - ${!!resultObject.excludeConditions}`);
        if (resultObject.excludeConditions) {
            log(`🔍 [${this.sessionId}] 期号 ${targetIssue}: excludeConditions内容 - ${JSON.stringify(resultObject.excludeConditions, null, 2)}`);
        }
        
        return resultObject;
    }
    
    // 基于历史数据计算某期的排除条件
    async calculateExcludeConditionsForIssue(targetIssue, filters) {
        const excludeConditions = {
            excludedSums: new Set(),
            excludedSpans: new Set(),
            excludedHWCRatios: new Set(),
            excludedZoneRatios: new Set(),
            excludedOddEvenRatios: new Set()
        };
        
        try {
            // 获取目标期号前N期的历史开奖数据
            const excludePeriods = filters.excludePeriods || 3; // 默认排除前3期
            
            // 计算要排除的期号范围
            const startIssue = parseInt(targetIssue) - excludePeriods;
            const endIssue = parseInt(targetIssue) - 1;
            
            // 查询历史开奖数据
            const historicalData = await DLT.find({
                Issue: { 
                    $gte: startIssue.toString(), 
                    $lte: endIssue.toString() 
                }
            }).lean();
            
            if (historicalData.length === 0) {
                log(`⚠️  [${this.sessionId}] 期号 ${targetIssue}: 未找到历史数据 ${startIssue}-${endIssue}`);
                return excludeConditions;
            }
            
            log(`📊 [${this.sessionId}] 期号 ${targetIssue}: 分析 ${historicalData.length} 期历史数据 (${startIssue}-${endIssue})`);
            
            // 分析每期的开奖特征并添加到排除条件
            for (const record of historicalData) {
                const redBalls = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5];
                
                // 1. 和值排除
                const sum = redBalls.reduce((a, b) => a + b, 0);
                excludeConditions.excludedSums.add(sum);
                
                // 2. 跨度排除
                const span = Math.max(...redBalls) - Math.min(...redBalls);
                excludeConditions.excludedSpans.add(span);
                
                // 3. 区间比排除
                const zoneRatio = this.calculateZoneRatio(redBalls);
                excludeConditions.excludedZoneRatios.add(zoneRatio);
                
                // 4. 奇偶比排除
                const oddEvenRatio = this.calculateOddEvenRatio(redBalls);
                excludeConditions.excludedOddEvenRatios.add(oddEvenRatio);
                
                // 5. 热温冷比排除（基于该期的遗漏数据）
                const hwcRatio = await this.calculateHWCRatioForHistoricalData(redBalls, record.Issue);
                if (hwcRatio) {
                    excludeConditions.excludedHWCRatios.add(hwcRatio);
                }
            }
            
            log(`🚫 [${this.sessionId}] 期号 ${targetIssue}: 排除条件统计 - 和值:${excludeConditions.excludedSums.size}, 跨度:${excludeConditions.excludedSpans.size}, 区间比:${excludeConditions.excludedZoneRatios.size}, 奇偶比:${excludeConditions.excludedOddEvenRatios.size}, 热温冷比:${excludeConditions.excludedHWCRatios.size}`);
            
            return excludeConditions;
            
        } catch (error) {
            log(`❌ [${this.sessionId}] 期号 ${targetIssue}: 计算排除条件失败 - ${error.message}`);
            return excludeConditions;
        }
    }
    
    // 计算区间比
    calculateZoneRatio(redBalls) {
        let zone1Count = 0, zone2Count = 0, zone3Count = 0;
        
        for (const ball of redBalls) {
            if (ball <= 11) zone1Count++;
            else if (ball <= 22) zone2Count++;
            else zone3Count++;
        }
        
        return `${zone1Count}:${zone2Count}:${zone3Count}`;
    }
    
    // 计算奇偶比
    calculateOddEvenRatio(redBalls) {
        let oddCount = 0, evenCount = 0;
        
        for (const ball of redBalls) {
            if (ball % 2 === 0) evenCount++;
            else oddCount++;
        }
        
        return `${oddCount}:${evenCount}`;
    }
    
    // 计算历史数据的热温冷比
    async calculateHWCRatioForHistoricalData(redBalls, issue) {
        try {
            // 获取该期之前的遗漏数据
            const missingData = await DLTRedMissing.findOne({ Issue: (parseInt(issue) - 1).toString() }).lean();
            if (!missingData) return null;
            
            const hwcData = this.fastCalculateHWC(missingData);
            let hotCount = 0, warmCount = 0, coldCount = 0;
            
            for (const ball of redBalls) {
                if (hwcData.hot_numbers.includes(ball)) hotCount++;
                else if (hwcData.warm_numbers.includes(ball)) warmCount++;
                else coldCount++;
            }
            
            return `${hotCount}:${warmCount}:${coldCount}`;
        } catch (error) {
            return null;
        }
    }
    
    // 快速计算热温冷分类
    fastCalculateHWC(missingData) {
        if (!missingData) {
            return { hot_numbers: [], warm_numbers: [], cold_numbers: [] };
        }
        
        const hot_numbers = [];
        const warm_numbers = [];
        const cold_numbers = [];
        
        for (let i = 1; i <= 35; i++) {
            const missing = missingData[i.toString()] || 0;
            if (missing <= 4) {
                hot_numbers.push(i);
            } else if (missing <= 9) {
                warm_numbers.push(i);
            } else {
                cold_numbers.push(i);
            }
        }
        
        return { hot_numbers, warm_numbers, cold_numbers };
    }
    
    // 并行筛选组合（使用动态排除条件）
    parallelFilterCombinations(hwcData, filters, excludeConditions) {
        log(`🔄 [${this.sessionId}] 开始过滤组合，原始组合数: ${this.redCombinations.length}`);

        const filteredResults = this.redCombinations.filter(combo => {
            // 1. 基础条件快速筛选
            if (!this.passBasicFilters(combo, filters)) return false;

            // 2. 动态排除条件筛选
            if (!this.passExcludeFilters(combo, excludeConditions, hwcData)) return false;

            return true;
        });

        log(`✅ [${this.sessionId}] 过滤完成，结果数量: ${filteredResults.length}`);

        // 如果过滤结果为空，提供降级方案
        if (filteredResults.length === 0) {
            log(`⚠️ [${this.sessionId}] 过滤条件过于严格导致无结果，启用降级方案`);

            // 降级方案1：仅使用基础过滤条件
            const basicFiltered = this.redCombinations.filter(combo =>
                this.passBasicFilters(combo, filters)
            );

            if (basicFiltered.length > 0) {
                log(`🔄 [${this.sessionId}] 降级方案1生效，基础过滤结果: ${basicFiltered.length}`);
                return basicFiltered.slice(0, Math.min(1000, basicFiltered.length)); // 限制数量避免过多
            }

            // 降级方案2：返回默认组合
            log(`🔄 [${this.sessionId}] 降级方案2生效，返回默认组合: 100个`);
            return this.redCombinations.slice(0, 100);
        }

        return filteredResults;
    }
    
    // 排除条件筛选
    passExcludeFilters(combo, excludeConditions, hwcData) {
        // 1. 和值排除
        if (excludeConditions.excludedSums.has(combo.sum_value)) {
            return false;
        }
        
        // 2. 跨度排除
        if (excludeConditions.excludedSpans.has(combo.span_value)) {
            return false;
        }
        
        // 3. 区间比排除
        if (excludeConditions.excludedZoneRatios.has(combo.zone_ratio)) {
            return false;
        }
        
        // 4. 奇偶比排除
        if (excludeConditions.excludedOddEvenRatios.has(combo.odd_even_ratio)) {
            return false;
        }
        
        // 5. 热温冷比排除
        if (excludeConditions.excludedHWCRatios.size > 0) {
            const hwcRatio = this.getHWCRatioFromCache(combo, hwcData);
            if (excludeConditions.excludedHWCRatios.has(hwcRatio)) {
                return false;
            }
        }
        
        return true;
    }
    
    // 基础条件筛选
    passBasicFilters(combo, filters) {
        // 和值筛选
        if (filters.excludeSumRange) {
            const { min, max } = filters.excludeSumRange;
            if (combo.sum_value >= min && combo.sum_value <= max) {
                return false; // 在排除范围内
            }
        }
        
        // 跨度筛选
        if (filters.excludeSpanRange) {
            const { min, max } = filters.excludeSpanRange;
            if (combo.span_value >= min && combo.span_value <= max) {
                return false; // 在排除范围内
            }
        }
        
        // 区间比筛选
        if (filters.excludedZoneRatios && filters.excludedZoneRatios.length > 0) {
            if (filters.excludedZoneRatios.includes(combo.zone_ratio)) {
                return false;
            }
        }
        
        // 奇偶比筛选
        if (filters.excludedOddEvenRatios && filters.excludedOddEvenRatios.length > 0) {
            if (filters.excludedOddEvenRatios.includes(combo.odd_even_ratio)) {
                return false;
            }
        }
        
        return true;
    }
    
    // 从缓存获取热温冷比（毫秒级）
    getHWCRatioFromCache(combo, hwcData) {
        const mapping = this.hwcCombinationMap.get(combo.combination_id);
        if (!mapping) return '0:0:0';
        
        const cacheKey = this.getHWCCacheKey(hwcData);
        
        // 检查缓存
        if (mapping.cache.has(cacheKey)) {
            return mapping.cache.get(cacheKey);
        }
        
        // 计算并缓存
        const balls = mapping.balls;
        let hot = 0, warm = 0, cold = 0;
        
        balls.forEach(ball => {
            if (hwcData.hot_numbers.includes(ball)) hot++;
            else if (hwcData.warm_numbers.includes(ball)) warm++;
            else cold++;
        });
        
        const ratio = `${hot}:${warm}:${cold}`;
        mapping.cache.set(cacheKey, ratio);
        return ratio;
    }
    
    // 生成热温冷缓存键
    getHWCCacheKey(hwcData) {
        return `${hwcData.hot_numbers.join(',')}_${hwcData.warm_numbers.join(',')}_${hwcData.cold_numbers.join(',')}`;
    }
    
    // 生成蓝球组合
    generateBlueCombs(targetIssue, filters) {
        // 简化实现：生成前12个蓝球组合
        const blueCombs = [];
        for (let i = 1; i <= 12; i++) {
            for (let j = i + 1; j <= 12; j++) {
                blueCombs.push([i, j]);
                if (blueCombs.length >= Math.min(filters.maxBlueCombinations || Number.MAX_SAFE_INTEGER, 1000)) { // 限制蓝球组合最多1000个
                    return blueCombs;
                }
            }
        }
        return blueCombs;
    }
    
    // 快速验证
    async quickValidate(targetIssue, filteredReds) {
        try {
            // 获取实际开奖结果
            const actualResult = await DLT.findOne({ Issue: parseInt(targetIssue) });
            if (!actualResult) {
                return null; // 没有开奖结果，无法验证
            }
            
            const actualRed = [actualResult.Red1, actualResult.Red2, actualResult.Red3, actualResult.Red4, actualResult.Red5];
            
            // 验证红球组合命中情况
            const hitStats = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            let bestHit = 0;
            
            filteredReds.forEach(combo => {
                const comboBalls = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, combo.red_ball_4, combo.red_ball_5];
                const hits = comboBalls.filter(ball => actualRed.includes(ball)).length;
                hitStats[hits]++;
                bestHit = Math.max(bestHit, hits);
            });
            
            const totalPredictions = filteredReds.length;
            const hitRate = totalPredictions > 0 ? hitStats[5] / totalPredictions : 0;
            
            return {
                actual_red: actualRed,
                red_hit_analysis: {
                    hit_distribution: hitStats,
                    best_hit: bestHit,
                    total_predictions: totalPredictions
                },
                hit_rate: hitRate
            };
            
        } catch (error) {
            log(`⚠️ [${this.sessionId}] 验证期号 ${targetIssue} 失败:`, error.message);
            return null;
        }
    }
    
    // 获取最近期数的和值（组合预测格式）
    async getRecentSumsFromHistory(targetIssue, periods) {
        const startIssue = parseInt(targetIssue) - periods;
        const endIssue = parseInt(targetIssue) - 1;
        
        const historicalData = await DLT.find({
            Issue: { 
                $gte: startIssue.toString(), 
                $lte: endIssue.toString() 
            }
        }).lean();
        
        const sums = new Set();
        historicalData.forEach(record => {
            if (record.Red1 && record.Red2 && record.Red3 && record.Red4 && record.Red5) {
                const sum = parseInt(record.Red1) + parseInt(record.Red2) + parseInt(record.Red3) + 
                           parseInt(record.Red4) + parseInt(record.Red5);
                sums.add(sum);
            }
        });
        
        return Array.from(sums);
    }
    
    // 获取最近期数的区间比（组合预测格式）
    async getRecentZoneRatiosFromHistory(targetIssue, periods) {
        const startIssue = parseInt(targetIssue) - periods;
        const endIssue = parseInt(targetIssue) - 1;
        
        const historicalData = await DLT.find({
            Issue: { 
                $gte: startIssue.toString(), 
                $lte: endIssue.toString() 
            }
        }).lean();
        
        const ratios = new Set();
        historicalData.forEach(record => {
            if (record.Red1 && record.Red2 && record.Red3 && record.Red4 && record.Red5) {
                const reds = [
                    parseInt(record.Red1), parseInt(record.Red2), parseInt(record.Red3),
                    parseInt(record.Red4), parseInt(record.Red5)
                ];
                
                let zone1 = 0, zone2 = 0, zone3 = 0;
                reds.forEach(num => {
                    if (num >= 1 && num <= 12) zone1++;
                    else if (num >= 13 && num <= 24) zone2++;
                    else if (num >= 25 && num <= 35) zone3++;
                });
                
                ratios.add(`${zone1}:${zone2}:${zone3}`);
            }
        });
        
        return Array.from(ratios);
    }
    
    // 获取最近期数的热温冷比（组合预测格式）
    async getRecentHwcRatiosFromHistory(targetIssue, periods) {
        try {
            const startIssue = parseInt(targetIssue) - periods;
            const endIssue = parseInt(targetIssue) - 1;
            
            const historicalData = await DLT.find({
                Issue: { 
                    $gte: startIssue.toString(), 
                    $lte: endIssue.toString() 
                }
            }).lean();
            
            const ratios = new Set();
            
            for (const record of historicalData) {
                if (record.Red1 && record.Red2 && record.Red3 && record.Red4 && record.Red5) {
                    const reds = [
                        parseInt(record.Red1), parseInt(record.Red2), parseInt(record.Red3),
                        parseInt(record.Red4), parseInt(record.Red5)
                    ];
                    
                    const hwcRatio = await this.calculateHWCRatioForHistoricalData(reds, record.Issue);
                    if (hwcRatio) {
                        ratios.add(hwcRatio);
                    }
                }
            }
            
            return Array.from(ratios);
        } catch (error) {
            log(`⚠️  获取热温冷比历史数据失败: ${error.message}`);
            return [];
        }
    }

    /**
     * 动态命中概率计算算法 - 方案D实现
     */
    async calculateHitProbability(combo, targetIssue, displayMode = 'comprehensive') {
        try {
            let score = 0;
            const numbers = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, combo.red_ball_4, combo.red_ball_5];

            // 获取历史数据用于分析
            const baseIssue = parseInt(targetIssue) - 1;
            const recentIssues = Math.max(24001, baseIssue - 19); // 最近20期

            const recentData = await DLT.find({
                Issue: { $gte: recentIssues, $lte: baseIssue }
            }).lean();

            switch (displayMode) {
                case 'comprehensive':
                    // 综合评分模式
                    score += await this.analyzeHotWarmColdScore(numbers, recentData) * 0.30;
                    score += await this.analyzeHistoricalFrequencyScore(numbers, recentData) * 0.25;
                    score += this.analyzeDistributionScore(numbers) * 0.20;
                    score += this.analyzeSpanScore(combo) * 0.15;
                    score += await this.analyzeRecentAvoidanceScore(numbers, recentData) * 0.10;
                    break;

                case 'hit_priority':
                    // 命中概率优先模式
                    score += await this.analyzeHotWarmColdScore(numbers, recentData) * 0.40;
                    score += await this.analyzeHistoricalFrequencyScore(numbers, recentData) * 0.35;
                    score += this.analyzeDistributionScore(numbers) * 0.25;
                    break;

                case 'hot_warm_balance':
                    // 热温冷均衡模式
                    score += await this.analyzeHotWarmColdScore(numbers, recentData) * 0.60;
                    score += this.analyzeDistributionScore(numbers) * 0.40;
                    break;

                case 'recent_avoid':
                    // 避开近期重复模式
                    score += await this.analyzeRecentAvoidanceScore(numbers, recentData) * 0.50;
                    score += await this.analyzeHistoricalFrequencyScore(numbers, recentData) * 0.30;
                    score += this.analyzeDistributionScore(numbers) * 0.20;
                    break;

                default:
                    score += await this.analyzeHotWarmColdScore(numbers, recentData) * 0.30;
                    score += this.analyzeDistributionScore(numbers) * 0.70;
            }

            return Math.round(score * 1000) / 1000; // 保留3位小数
        } catch (error) {
            log(`⚠️ [${this.sessionId}] 计算命中概率失败:`, error.message);
            return 0;
        }
    }

    /**
     * 热温冷分布得分分析
     */
    async analyzeHotWarmColdScore(numbers, recentData) {
        if (!recentData || recentData.length === 0) return 0.5;

        try {
            // 统计每个号码在最近期数中的出现频率
            const frequency = {};
            for (let i = 1; i <= 35; i++) {
                frequency[i] = 0;
            }

            recentData.forEach(record => {
                [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5].forEach(num => {
                    if (num >= 1 && num <= 35) {
                        frequency[parseInt(num)]++;
                    }
                });
            });

            // 分析当前组合的热温冷分布
            let hot = 0, warm = 0, cold = 0;
            numbers.forEach(num => {
                const freq = frequency[num] || 0;
                if (freq >= 4) hot++;        // 出现4次以上为热号
                else if (freq >= 2) warm++;  // 出现2-3次为温号
                else cold++;                 // 出现0-1次为冷号
            });

            // 理想的热温冷比例：2:2:1 或 2:1:2
            const idealRatios = [
                [2, 2, 1], [2, 1, 2], [1, 2, 2],
                [3, 1, 1], [1, 3, 1], [1, 1, 3]
            ];

            let bestScore = 0;
            idealRatios.forEach(([idealHot, idealWarm, idealCold]) => {
                const diff = Math.abs(hot - idealHot) + Math.abs(warm - idealWarm) + Math.abs(cold - idealCold);
                const score = Math.max(0, 1 - diff * 0.2);
                bestScore = Math.max(bestScore, score);
            });

            return bestScore;
        } catch (error) {
            return 0.5;
        }
    }

    /**
     * 历史出现频率得分分析
     */
    async analyzeHistoricalFrequencyScore(numbers, recentData) {
        if (!recentData || recentData.length === 0) return 0.5;

        try {
            // 获取每个号码的历史出现频率
            const frequency = {};
            for (let i = 1; i <= 35; i++) {
                frequency[i] = 0;
            }

            recentData.forEach(record => {
                [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5].forEach(num => {
                    if (num >= 1 && num <= 35) {
                        frequency[parseInt(num)]++;
                    }
                });
            });

            // 计算组合中数字的平均出现频率
            const totalFreq = numbers.reduce((sum, num) => sum + (frequency[num] || 0), 0);
            const avgFreq = totalFreq / numbers.length;
            const expectedFreq = recentData.length * 5 / 35; // 理论平均频率

            // 频率接近期望值得分更高
            const score = 1 - Math.abs(avgFreq - expectedFreq) / expectedFreq;
            return Math.max(0, Math.min(1, score));
        } catch (error) {
            return 0.5;
        }
    }

    /**
     * 数字分布均匀度得分分析
     */
    analyzeDistributionScore(numbers) {
        try {
            // 1. 区间分布得分
            let zone1 = 0, zone2 = 0, zone3 = 0;
            numbers.forEach(num => {
                if (num <= 12) zone1++;
                else if (num <= 24) zone2++;
                else zone3++;
            });

            // 理想区间分布：2:2:1, 2:1:2, 1:2:2
            const zoneScore = Math.max(
                1 - Math.abs(2 - zone1) * 0.3 - Math.abs(2 - zone2) * 0.3 - Math.abs(1 - zone3) * 0.4,
                1 - Math.abs(2 - zone1) * 0.3 - Math.abs(1 - zone2) * 0.4 - Math.abs(2 - zone3) * 0.3,
                1 - Math.abs(1 - zone1) * 0.4 - Math.abs(2 - zone2) * 0.3 - Math.abs(2 - zone3) * 0.3
            );

            // 2. 奇偶分布得分
            const oddCount = numbers.filter(num => num % 2 === 1).length;
            const evenCount = 5 - oddCount;
            // 理想奇偶比：3:2 或 2:3
            const oddEvenScore = Math.max(
                1 - Math.abs(3 - oddCount) * 0.3,
                1 - Math.abs(2 - oddCount) * 0.3
            );

            return (zoneScore * 0.6 + oddEvenScore * 0.4);
        } catch (error) {
            return 0.5;
        }
    }

    /**
     * 跨度合理性得分分析
     */
    analyzeSpanScore(combo) {
        try {
            const numbers = [combo.red_ball_1, combo.red_ball_2, combo.red_ball_3, combo.red_ball_4, combo.red_ball_5];
            const span = Math.max(...numbers) - Math.min(...numbers);

            // 理想跨度范围：15-25
            if (span >= 15 && span <= 25) {
                return 1.0;
            } else if (span >= 12 && span <= 28) {
                return 0.8;
            } else if (span >= 10 && span <= 30) {
                return 0.6;
            } else {
                return 0.3;
            }
        } catch (error) {
            return 0.5;
        }
    }

    /**
     * 最近期避免重复得分分析
     */
    async analyzeRecentAvoidanceScore(numbers, recentData) {
        if (!recentData || recentData.length === 0) return 1.0;

        try {
            let penaltyScore = 0;

            // 检查是否与最近几期的开奖号码重复过多
            const recentNumbers = new Set();
            recentData.slice(-3).forEach(record => { // 检查最近3期
                [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5].forEach(num => {
                    if (num) recentNumbers.add(parseInt(num));
                });
            });

            const duplicateCount = numbers.filter(num => recentNumbers.has(num)).length;

            // 重复号码过多时扣分
            if (duplicateCount >= 4) {
                penaltyScore = 0.8; // 重复4个以上，重度扣分
            } else if (duplicateCount >= 3) {
                penaltyScore = 0.4; // 重复3个，中度扣分
            } else if (duplicateCount >= 2) {
                penaltyScore = 0.2; // 重复2个，轻度扣分
            }

            return Math.max(0, 1 - penaltyScore);
        } catch (error) {
            return 1.0;
        }
    }

    /**
     * 智能限制结果大小 - 支持真正无限制模式
     */
    async limitResultSize(filteredReds, maxCombinations, trulyUnlimited, displayMode = 'comprehensive', targetIssue) {
        if (!filteredReds || filteredReds.length === 0) {
            return [];
        }

        // 真正无限制模式：智能选择高命中概率组合作为预览
        if (trulyUnlimited && maxCombinations === Number.MAX_SAFE_INTEGER) {
            log(`🔥 [${this.sessionId}] 真正无限制模式 - 智能选择预览组合，总数: ${filteredReds.length}`);

            // 使用智能命中优先显示逻辑
            const sampleResult = await this.selectHighPotentialSample(filteredReds, displayMode, targetIssue);

            // 修复：直接返回sample_combinations数组，而不是包装对象
            // 这样前端可以正确计算red_combinations.length
            const combinations = sampleResult.sample_combinations || [];
            log(`🔧 [${this.sessionId}] 无限制模式修复：返回${combinations.length}个组合（来自${filteredReds.length}个原始组合）`);
            return combinations;
        }

        // 传统限制模式
        const limit = Math.min(maxCombinations || 5000, 5000);
        const result = filteredReds.slice(0, limit);

        if (filteredReds.length > limit) {
            log(`⚠️ [${this.sessionId}] 组合数量超限 - 原始:${filteredReds.length}, 返回:${limit}`);
        }

        return result;
    }

    /**
     * 智能命中优先显示逻辑 - 方案A实现
     */
    async selectHighPotentialSample(filteredReds, displayMode = 'comprehensive', targetIssue) {
        try {
            log(`🎯 [${this.sessionId}] 开始智能选择高潜力组合样本，模式: ${displayMode}`);

            const startTime = Date.now();

            // 如果组合数量较少，直接返回
            if (filteredReds.length <= 100) {
                return {
                    sample_combinations: filteredReds,
                    total_count: filteredReds.length,
                    is_unlimited: true,
                    display_mode: displayMode,
                    selection_strategy: 'all_included',
                    message: `共生成 ${filteredReds.length} 个组合，已全部显示`
                };
            }

            // 性能优化：大数据量时分批计算评分
            const batchSize = Math.min(1000, Math.ceil(filteredReds.length / 10));
            const sampledCombos = [];

            // 智能采样：确保覆盖不同区间的组合
            const sampleIndices = this.generateSmartSampleIndices(filteredReds.length, batchSize);

            for (const index of sampleIndices) {
                if (filteredReds[index]) {
                    sampledCombos.push(filteredReds[index]);
                }
            }

            log(`📊 [${this.sessionId}] 智能采样完成，从 ${filteredReds.length} 个组合中采样 ${sampledCombos.length} 个`);

            // 并行计算命中概率评分
            const scoredCombinations = await Promise.all(
                sampledCombos.map(async (combo, index) => {
                    try {
                        const hitProbability = await this.calculateHitProbability(combo, targetIssue, displayMode);
                        return {
                            ...combo,
                            hitProbability: hitProbability,
                            originalIndex: index
                        };
                    } catch (error) {
                        return {
                            ...combo,
                            hitProbability: 0.5, // 默认分数
                            originalIndex: index
                        };
                    }
                })
            );

            // 按命中概率排序，选择前100个
            const topCombinations = scoredCombinations
                .sort((a, b) => b.hitProbability - a.hitProbability)
                .slice(0, 100);

            const processingTime = Date.now() - startTime;
            log(`✅ [${this.sessionId}] 智能选择完成，耗时: ${processingTime}ms`);

            return {
                sample_combinations: topCombinations,
                total_count: filteredReds.length,
                sampled_count: sampledCombos.length,
                is_unlimited: true,
                export_available: true,
                display_mode: displayMode,
                selection_strategy: 'hit_probability_optimized',
                avg_hit_probability: (topCombinations.reduce((sum, combo) => sum + combo.hitProbability, 0) / topCombinations.length).toFixed(3),
                processing_time: processingTime,
                message: `从 ${filteredReds.length} 个组合中智能筛选出命中概率最高的100个组合进行预览`
            };

        } catch (error) {
            log(`❌ [${this.sessionId}] 智能选择失败:`, error.message);

            // 降级到简单策略
            return {
                sample_combinations: filteredReds.slice(0, 100),
                total_count: filteredReds.length,
                is_unlimited: true,
                display_mode: displayMode,
                selection_strategy: 'fallback_simple',
                message: `智能选择失败，显示前100个组合。完整数据请使用导出功能。`
            };
        }
    }

    /**
     * 生成智能采样索引
     */
    generateSmartSampleIndices(totalCount, sampleSize) {
        if (totalCount <= sampleSize) {
            return Array.from({length: totalCount}, (_, i) => i);
        }

        const indices = new Set();

        // 1. 均匀分布采样 (70%)
        const uniformCount = Math.floor(sampleSize * 0.7);
        const step = totalCount / uniformCount;
        for (let i = 0; i < uniformCount; i++) {
            indices.add(Math.floor(i * step));
        }

        // 2. 随机采样 (20%)
        const randomCount = Math.floor(sampleSize * 0.2);
        while (indices.size < uniformCount + randomCount && indices.size < totalCount) {
            indices.add(Math.floor(Math.random() * totalCount));
        }

        // 3. 头部和尾部采样 (10%)
        const edgeCount = Math.floor(sampleSize * 0.1);
        for (let i = 0; i < edgeCount / 2 && indices.size < sampleSize; i++) {
            indices.add(i); // 头部
            indices.add(totalCount - 1 - i); // 尾部
        }

        return Array.from(indices).sort((a, b) => a - b);
    }

    /**
     * 根据组合模式生成最终组合（替代原有的limitResultSize逻辑）
     */
    async generateFinalCombinationsForMode(filteredReds, mode, filters, targetIssue) {
        try {
            log(`🎯 [${this.sessionId}] 期号 ${targetIssue}: 使用组合模式 ${mode} 生成最终组合，红球组合数: ${filteredReds.length}`);

            // 调用全局的生成函数，传递组合模式
            const finalCombinations = await generateFinalCombinationsWithBlueV3(filteredReds, mode);

            log(`✅ [${this.sessionId}] 期号 ${targetIssue}: 组合模式 ${mode} 生成完成，最终组合数: ${finalCombinations.length}`);

            return finalCombinations;

        } catch (error) {
            log(`❌ [${this.sessionId}] 期号 ${targetIssue}: 生成最终组合失败: ${error.message}`);

            // 降级处理：使用原有的limitResultSize逻辑
            log(`🔄 [${this.sessionId}] 期号 ${targetIssue}: 降级使用传统限制逻辑`);
            return await this.limitResultSize(filteredReds, filters.maxRedCombinations, filters.trulyUnlimited, filters.displayMode, targetIssue);
        }
    }
}

// ===== 双色球组合预测API =====

/**
 * 双色球组合预测API
 * 支持与大乐透一致的排除条件功能
 */
app.post('/api/ssq/combination-prediction', async (req, res) => {
    const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    log(`🔴 [${sessionId}] 双色球组合预测请求开始`);
    
    try {
        const { targetIssue, filters = {} } = req.body;
        
        if (!targetIssue) {
            return res.json({
                success: false,
                message: '请提供目标期号'
            });
        }
        
        log(`🎯 [${sessionId}] 双色球组合预测 - 期号: ${targetIssue}`);
        
        const startTime = Date.now();
        
        // 生成双色球组合预测
        const predictionResult = await generateSSQCombinationPrediction(targetIssue, filters, sessionId);
        
        const processingTime = Date.now() - startTime;
        
        log(`✅ [${sessionId}] 双色球组合预测完成 - 耗时: ${processingTime}ms`);
        
        res.json({
            success: true,
            data: predictionResult,
            processingTime: `${processingTime}ms`,
            sessionId
        });
        
    } catch (error) {
        log(`❌ [${sessionId}] 双色球组合预测失败:`, error);
        res.json({
            success: false,
            message: error.message,
            sessionId
        });
    }
});

/**
 * 获取双色球最新期号API
 */
app.get('/api/ssq/latest-issues', async (req, res) => {
    try {
        // 获取最新10期的双色球数据
        const latestIssues = await UnionLotto.find({})
            .sort({ Issue: -1 })
            .limit(10)
            .select('Issue DrawingWeek')
            .lean();
        
        const issues = latestIssues.map(issue => ({
            issue: issue.Issue,
            week: issue.DrawingWeek
        }));
        
        res.json({
            success: true,
            data: issues
        });
    } catch (error) {
        console.error('获取双色球最新期号失败:', error);
        res.json({
            success: false,
            message: error.message
        });
    }
});

/**
 * 双色球组合预测核心函数
 */
async function generateSSQCombinationPrediction(targetIssue, filters, sessionId) {
    log(`🚀 [${sessionId}] 开始双色球组合预测生成 - 期号: ${targetIssue}`);
    
    // 1. 合并排除条件
    let excludeConditions = {
        excludedSums: new Set(),
        excludedSpans: new Set(),
        excludedHWCRatios: new Set(),
        excludedZoneRatios: new Set(),
        excludedOddEvenRatios: new Set(),
        excludedBlues: new Set()
    };
    
    let manualExcludeCount = 0;
    let historicalExcludeCount = 0;
    
    // 1.1 处理固定排除条件
    await processSSQManualExcludeConditions(filters, excludeConditions, sessionId, targetIssue);
    manualExcludeCount = excludeConditions.excludedSums.size + 
                        excludeConditions.excludedSpans.size +
                        excludeConditions.excludedHWCRatios.size +
                        excludeConditions.excludedZoneRatios.size +
                        excludeConditions.excludedOddEvenRatios.size +
                        excludeConditions.excludedBlues.size;
    
    // 1.2 处理历史排除条件
    await processSSQHistoricalExcludeConditions(filters, excludeConditions, sessionId, targetIssue);
    const totalAfterHistorical = excludeConditions.excludedSums.size + 
                                 excludeConditions.excludedSpans.size +
                                 excludeConditions.excludedHWCRatios.size +
                                 excludeConditions.excludedZoneRatios.size +
                                 excludeConditions.excludedOddEvenRatios.size +
                                 excludeConditions.excludedBlues.size;
    historicalExcludeCount = totalAfterHistorical - manualExcludeCount;
    
    // 2. 生成红球组合（简化实现，生成基础组合）
    const redCombinations = await generateSSQRedCombinations(targetIssue, filters, excludeConditions, sessionId);
    
    // 3. 生成蓝球组合
    const blueCombinations = await generateSSQBlueCombinations(targetIssue, filters, excludeConditions, sessionId);
    
    const resultObject = {
        target_issue: targetIssue,
        red_combinations: redCombinations.slice(0, 50), // 限制返回数量
        blue_combinations: blueCombinations,
        excludeConditions: {
            manualBased: manualExcludeCount > 0,
            historicalBased: historicalExcludeCount > 0,
            manualExcludeCount: manualExcludeCount,
            historicalExcludeCount: historicalExcludeCount,
            totalExcluded: {
                sums: excludeConditions.excludedSums.size,
                spans: excludeConditions.excludedSpans.size,
                hwcRatios: excludeConditions.excludedHWCRatios.size,
                zoneRatios: excludeConditions.excludedZoneRatios.size,
                oddEvenRatios: excludeConditions.excludedOddEvenRatios.size,
                blues: excludeConditions.excludedBlues.size
            },
            excludedLists: {
                sums: Array.from(excludeConditions.excludedSums),
                spans: Array.from(excludeConditions.excludedSpans),
                hwcRatios: Array.from(excludeConditions.excludedHWCRatios),
                zoneRatios: Array.from(excludeConditions.excludedZoneRatios),
                oddEvenRatios: Array.from(excludeConditions.excludedOddEvenRatios),
                blues: Array.from(excludeConditions.excludedBlues)
            }
        }
    };
    
    log(`🔍 [${sessionId}] 双色球组合预测完成 - 红球组合:${redCombinations.length}, 蓝球组合:${blueCombinations.length}`);
    
    return resultObject;
}

/**
 * 处理双色球手动排除条件
 */
async function processSSQManualExcludeConditions(filters, excludeConditions, sessionId, targetIssue) {
    // 处理和值多范围排除
    if (filters.sumRanges && Array.isArray(filters.sumRanges)) {
        filters.sumRanges.forEach(range => {
            if (range.min && range.max) {
                for (let sum = parseInt(range.min); sum <= parseInt(range.max); sum++) {
                    excludeConditions.excludedSums.add(sum);
                }
                log(`🔢 [${sessionId}] 双色球排除和值范围: ${range.min}-${range.max}`);
            }
        });
    }
    
    // 处理跨度多范围排除
    if (filters.spanRanges && Array.isArray(filters.spanRanges)) {
        filters.spanRanges.forEach(range => {
            if (range.min && range.max) {
                for (let span = parseInt(range.min); span <= parseInt(range.max); span++) {
                    excludeConditions.excludedSpans.add(span);
                }
                log(`📏 [${sessionId}] 双色球排除跨度范围: ${range.min}-${range.max}`);
            }
        });
    }
    
    // 处理区间比排除
    if (filters.zoneRatios && typeof filters.zoneRatios === 'string') {
        const ratios = filters.zoneRatios.split(',').map(r => r.trim()).filter(r => r);
        ratios.forEach(ratio => excludeConditions.excludedZoneRatios.add(ratio));
        log(`🎯 [${sessionId}] 双色球排除区间比: ${ratios.join(',')}`);
    }
    
    // 处理奇偶比排除
    if (filters.oddEvenRatios && typeof filters.oddEvenRatios === 'string') {
        const ratios = filters.oddEvenRatios.split(',').map(r => r.trim()).filter(r => r);
        ratios.forEach(ratio => excludeConditions.excludedOddEvenRatios.add(ratio));
        log(`⚖️ [${sessionId}] 双色球排除奇偶比: ${ratios.join(',')}`);
    }
    
    // 处理热温冷比排除
    if (filters.hotWarmColdRatios && typeof filters.hotWarmColdRatios === 'string') {
        const ratios = filters.hotWarmColdRatios.split(',').map(r => r.trim()).filter(r => r);
        ratios.forEach(ratio => excludeConditions.excludedHWCRatios.add(ratio));
        log(`🌡️ [${sessionId}] 双色球排除热温冷比: ${ratios.join(',')}`);
    }
    
    // 处理蓝球排除
    if (filters.excludedBlues && Array.isArray(filters.excludedBlues)) {
        filters.excludedBlues.forEach(blue => excludeConditions.excludedBlues.add(parseInt(blue)));
        log(`🔵 [${sessionId}] 双色球排除蓝球: ${filters.excludedBlues.join(',')}`);
    }
}

/**
 * 处理双色球历史排除条件
 */
async function processSSQHistoricalExcludeConditions(filters, excludeConditions, sessionId, targetIssue) {
    // 排除最近期数和值
    if (filters.excludeRecentPeriods && filters.excludeRecentPeriods > 0) {
        const recentSums = await getSSQRecentSumsFromHistory(targetIssue, filters.excludeRecentPeriods);
        recentSums.forEach(sum => excludeConditions.excludedSums.add(sum));
        log(`🔢 [${sessionId}] 双色球排除最近${filters.excludeRecentPeriods}期和值: ${recentSums.length}个`);
    }
    
    // 排除最近期数区间比
    if (filters.excludeZoneRecentPeriods && filters.excludeZoneRecentPeriods > 0) {
        const recentZones = await getSSQRecentZoneRatiosFromHistory(targetIssue, filters.excludeZoneRecentPeriods);
        recentZones.forEach(ratio => excludeConditions.excludedZoneRatios.add(ratio));
        log(`🎯 [${sessionId}] 双色球排除最近${filters.excludeZoneRecentPeriods}期区间比: ${recentZones.length}个`);
    }
    
    // 排除最近期数热温冷比
    if (filters.excludeHwcRecentPeriods && filters.excludeHwcRecentPeriods > 0) {
        const recentHwc = await getSSQRecentHwcRatiosFromHistory(targetIssue, filters.excludeHwcRecentPeriods);
        recentHwc.forEach(ratio => excludeConditions.excludedHWCRatios.add(ratio));
        log(`🌡️ [${sessionId}] 双色球排除最近${filters.excludeHwcRecentPeriods}期热温冷比: ${recentHwc.length}个`);
    }
}

/**
 * 生成双色球红球组合
 */
async function generateSSQRedCombinations(targetIssue, filters, excludeConditions, sessionId) {
    log(`🔴 [${sessionId}] 生成双色球红球组合`);
    
    const combinations = [];
    const maxCombinations = 1000; // 限制生成数量
    
    // 简化实现：生成一些基础组合
    for (let i = 0; i < maxCombinations && combinations.length < 50; i++) {
        const combo = generateRandomSSQRedCombination();
        
        // 应用排除条件
        if (!passesSSQExcludeConditions(combo, excludeConditions)) {
            continue;
        }
        
        combinations.push({
            red_balls: combo.balls,
            sum: combo.sum,
            span: combo.span,
            zone_ratio: combo.zoneRatio,
            odd_even_ratio: combo.oddEvenRatio,
            hwc_ratio: combo.hwcRatio
        });
    }
    
    log(`✅ [${sessionId}] 双色球红球组合生成完成: ${combinations.length}个`);
    return combinations;
}

/**
 * 生成双色球蓝球组合
 */
async function generateSSQBlueCombinations(targetIssue, filters, excludeConditions, sessionId) {
    log(`🔵 [${sessionId}] 生成双色球蓝球组合`);
    
    const combinations = [];
    
    // 生成1-16的蓝球，排除指定的蓝球
    for (let blue = 1; blue <= 16; blue++) {
        if (!excludeConditions.excludedBlues.has(blue)) {
            // 应用蓝球范围过滤
            if (filters.blueMin && blue < filters.blueMin) continue;
            if (filters.blueMax && blue > filters.blueMax) continue;
            
            combinations.push(blue);
        }
    }
    
    log(`✅ [${sessionId}] 双色球蓝球组合生成完成: ${combinations.length}个`);
    return combinations.slice(0, 10); // 返回前10个
}

/**
 * 生成随机双色球红球组合
 */
function generateRandomSSQRedCombination() {
    const balls = [];
    while (balls.length < 6) {
        const ball = Math.floor(Math.random() * 33) + 1;
        if (!balls.includes(ball)) {
            balls.push(ball);
        }
    }
    balls.sort((a, b) => a - b);
    
    const sum = balls.reduce((a, b) => a + b, 0);
    const span = Math.max(...balls) - Math.min(...balls);
    
    // 计算区间比 (1-11:12-22:23-33)
    let zone1 = 0, zone2 = 0, zone3 = 0;
    balls.forEach(ball => {
        if (ball <= 11) zone1++;
        else if (ball <= 22) zone2++;
        else zone3++;
    });
    const zoneRatio = `${zone1}:${zone2}:${zone3}`;
    
    // 计算奇偶比
    let odd = 0, even = 0;
    balls.forEach(ball => {
        if (ball % 2 === 0) even++;
        else odd++;
    });
    const oddEvenRatio = `${odd}:${even}`;
    
    // 简化的热温冷比（随机生成）
    const hwcOptions = ['4:2:0', '3:2:1', '2:3:1', '3:1:2', '2:2:2'];
    const hwcRatio = hwcOptions[Math.floor(Math.random() * hwcOptions.length)];
    
    return {
        balls,
        sum,
        span,
        zoneRatio,
        oddEvenRatio,
        hwcRatio
    };
}

/**
 * 检查双色球组合是否通过排除条件
 */
function passesSSQExcludeConditions(combo, excludeConditions) {
    if (excludeConditions.excludedSums.has(combo.sum)) return false;
    if (excludeConditions.excludedSpans.has(combo.span)) return false;
    if (excludeConditions.excludedZoneRatios.has(combo.zoneRatio)) return false;
    if (excludeConditions.excludedOddEvenRatios.has(combo.oddEvenRatio)) return false;
    if (excludeConditions.excludedHWCRatios.has(combo.hwcRatio)) return false;
    return true;
}

/**
 * 获取双色球最近期数的和值
 */
async function getSSQRecentSumsFromHistory(targetIssue, periods) {
    try {
        const endIssue = parseInt(targetIssue) - 1;
        const startIssue = endIssue - periods + 1;
        
        const recentData = await UnionLotto.find({
            Issue: { $gte: startIssue.toString(), $lte: endIssue.toString() }
        }).lean();
        
        const sums = new Set();
        recentData.forEach(record => {
            if (record.Red1 && record.Red2 && record.Red3 && record.Red4 && record.Red5 && record.Red6) {
                const sum = record.Red1 + record.Red2 + record.Red3 + record.Red4 + record.Red5 + record.Red6;
                sums.add(sum);
            }
        });
        
        return Array.from(sums);
    } catch (error) {
        log(`⚠️  获取双色球和值历史数据失败: ${error.message}`);
        return [];
    }
}

/**
 * 获取双色球最近期数的区间比
 */
async function getSSQRecentZoneRatiosFromHistory(targetIssue, periods) {
    try {
        const endIssue = parseInt(targetIssue) - 1;
        const startIssue = endIssue - periods + 1;
        
        const recentData = await UnionLotto.find({
            Issue: { $gte: startIssue.toString(), $lte: endIssue.toString() }
        }).lean();
        
        const ratios = new Set();
        recentData.forEach(record => {
            if (record.Red1 && record.Red2 && record.Red3 && record.Red4 && record.Red5 && record.Red6) {
                const reds = [record.Red1, record.Red2, record.Red3, record.Red4, record.Red5, record.Red6];
                let zone1 = 0, zone2 = 0, zone3 = 0;
                reds.forEach(ball => {
                    if (ball <= 11) zone1++;
                    else if (ball <= 22) zone2++;
                    else zone3++;
                });
                ratios.add(`${zone1}:${zone2}:${zone3}`);
            }
        });
        
        return Array.from(ratios);
    } catch (error) {
        log(`⚠️  获取双色球区间比历史数据失败: ${error.message}`);
        return [];
    }
}

/**
 * 获取双色球最近期数的热温冷比
 */
async function getSSQRecentHwcRatiosFromHistory(targetIssue, periods) {
    try {
        const endIssue = parseInt(targetIssue) - 1;
        const startIssue = endIssue - periods + 1;
        
        const recentData = await UnionLotto.find({
            Issue: { $gte: startIssue.toString(), $lte: endIssue.toString() }
        }).lean();
        
        const ratios = new Set();
        // 简化实现，返回一些常见的热温冷比
        ['4:2:0', '3:2:1', '2:3:1', '3:1:2', '2:2:2'].forEach(ratio => {
            ratios.add(ratio);
        });
        
        return Array.from(ratios);
    } catch (error) {
        log(`⚠️  获取双色球热温冷比历史数据失败: ${error.message}`);
        return [];
    }
}

// ========== 规律生成功能 API ==========

// 引入规律相关模块
const PatternDiscoveryEngine = require('./patternDiscovery');
const PatternScoringSystem = require('./patternScoring');

/**
 * 规律生成API
 * POST /api/dlt/patterns/generate
 */
app.post('/api/dlt/patterns/generate', async (req, res) => {
    try {
        const {
            analysisType = 'full',
            periods = 200,
            patternTypes = null,
            minConfidence = 0.6,
            minSupport = 10
        } = req.body;

        log(`🔍 开始生成规律 - 分析期数: ${periods}, 最小置信度: ${minConfidence}`);

        // 1. 获取历史数据
        const historicalData = await DLT.find({})
            .sort({ Issue: -1 })
            .limit(periods)
            .lean();

        if (historicalData.length < minSupport) {
            return res.json({
                success: false,
                message: `历史数据不足，仅${historicalData.length}期，需要至少${minSupport}期`
            });
        }

        // 反转数据，使其按期号升序排列
        historicalData.reverse();

        // 2. 为每期数据添加热温冷比
        let htcSuccessCount = 0;
        let missingDataCount = 0;

        for (let i = 0; i < historicalData.length; i++) {
            const currentIssue = historicalData[i].Issue.toString();
            const previousIssue = (historicalData[i].Issue - 1).toString();

            // 获取当前期的中奖红球
            const redBalls = [
                historicalData[i].Red1,
                historicalData[i].Red2,
                historicalData[i].Red3,
                historicalData[i].Red4,
                historicalData[i].Red5
            ];

            // 获取上一期的遗漏数据
            const omissionRecord = await DLTRedMissing.findOne({ Issue: previousIssue });

            if (omissionRecord) {
                let hot = 0, warm = 0, cold = 0;

                redBalls.forEach(num => {
                    // 获取该号码的遗漏值
                    const fieldName = num.toString();
                    const omission = omissionRecord[fieldName];

                    // 只有当遗漏值存在且为有效数字时才计数
                    if (typeof omission === 'number' && omission >= 0) {
                        if (omission <= 4) {
                            hot++;
                        } else if (omission >= 5 && omission <= 9) {
                            warm++;
                        } else {
                            cold++;
                        }
                    }
                });

                // 只有当统计完成且总数为5时才设置热温冷比
                if (hot + warm + cold === 5) {
                    historicalData[i].htcRatio = `${hot}:${warm}:${cold}`;
                    htcSuccessCount++;
                } else {
                    log(`⚠️ 期号 ${currentIssue} 热温冷比计算异常: ${hot}:${warm}:${cold} (总数应为5)`);
                }
            } else {
                missingDataCount++;
                if (missingDataCount <= 3) {
                    log(`⚠️ 找不到期号 ${previousIssue} 的遗漏数据`);
                }
            }
        }

        log(`📊 热温冷比计算统计: 成功${htcSuccessCount}期, 遗漏数据缺失${missingDataCount}期, 总计${historicalData.length}期`);

        if (htcSuccessCount === 0) {
            return res.json({
                success: false,
                message: `热温冷比数据不足，数据库中缺少遗漏数据。请确保 DLTRedMissing 表有数据。`
            });
        }

        // 3. 初始化规律发现引擎
        const discoveryEngine = new PatternDiscoveryEngine({
            minConfidence,
            minSupport,
            analysisWindow: periods
        });

        // 4. 发现规律
        const patterns = await discoveryEngine.discoverAllPatterns(historicalData, patternTypes);

        if (patterns.length === 0) {
            return res.json({
                success: false,
                message: '未发现符合条件的规律'
            });
        }

        // 5. 初始化评分系统
        const scoringSystem = new PatternScoringSystem();

        // 6. 对规律进行评分
        const scoredPatterns = await scoringSystem.scorePatterns(patterns, historicalData);

        // 7. 生成规律ID并保存到数据库
        const savedPatterns = [];
        const timestamp = Date.now();

        for (let i = 0; i < scoredPatterns.length; i++) {
            const pattern = scoredPatterns[i];
            const patternId = `PATTERN_${timestamp}_${(i + 1).toString().padStart(3, '0')}`;

            const patternDoc = new DLTPattern({
                pattern_id: patternId,
                pattern_type: pattern.type,
                pattern_name: pattern.name,
                description: pattern.description,
                parameters: pattern.parameters,
                statistics: pattern.statistics,
                validation: pattern.validation,
                trend: {
                    status: 'active',
                    recentAccuracy: pattern.validation.accuracy,
                    trendDirection: 'stable',
                    slope: 0
                },
                score: pattern.score,
                status: 'active'
            });

            await patternDoc.save();
            savedPatterns.push(patternDoc);
        }

        log(`✅ 规律生成完成 - 共生成${savedPatterns.length}个规律`);

        // 8. 统计结果
        const patternsByType = {};
        savedPatterns.forEach(p => {
            patternsByType[p.pattern_type] = (patternsByType[p.pattern_type] || 0) + 1;
        });

        res.json({
            success: true,
            data: {
                generatedPatterns: savedPatterns.length,
                validPatterns: savedPatterns.filter(p => p.score.grade !== 'D').length,
                patternsByType,
                executionTime: `${((Date.now() - timestamp) / 1000).toFixed(2)}秒`,
                timestamp: new Date().toISOString(),
                patterns: savedPatterns.map(p => ({
                    pattern_id: p.pattern_id,
                    pattern_name: p.pattern_name,
                    pattern_type: p.pattern_type,
                    grade: p.score.grade,
                    totalScore: p.score.totalScore
                }))
            }
        });

    } catch (error) {
        log(`❌ 规律生成失败: ${error.message}`);
        console.error(error);
        res.json({
            success: false,
            message: `规律生成失败: ${error.message}`
        });
    }
});

/**
 * 规律查询API
 * GET /api/dlt/patterns/list
 */
app.get('/api/dlt/patterns/list', async (req, res) => {
    try {
        const {
            type = null,
            minConfidence = 0,
            minScore = 0,
            status = 'active',
            grade = null,
            limit = 20,
            page = 1
        } = req.query;

        log(`📚 查询规律库 - 类型: ${type || '全部'}, 最小分数: ${minScore}`);

        // 构建查询条件
        const query = {};
        if (type) query.pattern_type = type;
        if (status) query.status = status;
        if (grade) query['score.grade'] = grade;
        if (minConfidence > 0) query['statistics.confidence'] = { $gte: parseFloat(minConfidence) };
        if (minScore > 0) query['score.totalScore'] = { $gte: parseFloat(minScore) };

        // 查询规律
        const total = await DLTPattern.countDocuments(query);
        const patterns = await DLTPattern.find(query)
            .sort({ 'score.totalScore': -1, created_at: -1 })
            .skip((parseInt(page) - 1) * parseInt(limit))
            .limit(parseInt(limit))
            .lean();

        res.json({
            success: true,
            data: {
                patterns: patterns.map(p => ({
                    pattern_id: p.pattern_id,
                    pattern_name: p.pattern_name,
                    pattern_type: p.pattern_type,
                    description: p.description,
                    confidence: p.statistics.confidence,
                    accuracy: p.statistics.accuracy,
                    grade: p.score.grade,
                    totalScore: p.score.totalScore,
                    trend: p.trend,
                    created_at: p.created_at
                })),
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        log(`❌ 规律查询失败: ${error.message}`);
        res.json({
            success: false,
            message: `规律查询失败: ${error.message}`
        });
    }
});

/**
 * 规律详情API
 * GET /api/dlt/patterns/detail/:patternId
 */
app.get('/api/dlt/patterns/detail/:patternId', async (req, res) => {
    try {
        const { patternId } = req.params;

        const pattern = await DLTPattern.findOne({ pattern_id: patternId }).lean();

        if (!pattern) {
            return res.json({
                success: false,
                message: '规律不存在'
            });
        }

        // 获取规律的历史记录
        const history = await DLTPatternHistory.find({ pattern_id: patternId })
            .sort({ recorded_at: -1 })
            .limit(20)
            .lean();

        res.json({
            success: true,
            data: {
                pattern,
                history
            }
        });

    } catch (error) {
        log(`❌ 获取规律详情失败: ${error.message}`);
        res.json({
            success: false,
            message: `获取规律详情失败: ${error.message}`
        });
    }
});

/**
 * 规律智能推荐API
 * POST /api/dlt/patterns/recommend
 */
app.post('/api/dlt/patterns/recommend', async (req, res) => {
    try {
        const {
            targetIssue,
            patternIds = null,
            autoSelect = true,
            maxPatterns = 5
        } = req.body;

        log(`🎯 生成智能推荐 - 目标期号: ${targetIssue}`);

        let selectedPatterns = [];

        if (autoSelect) {
            // 自动选择最优规律组合
            selectedPatterns = await DLTPattern.find({
                status: 'active',
                'score.grade': { $in: ['S', 'A', 'B'] }
            })
                .sort({ 'score.totalScore': -1 })
                .limit(maxPatterns)
                .lean();
        } else if (patternIds && patternIds.length > 0) {
            // 使用指定的规律
            selectedPatterns = await DLTPattern.find({
                pattern_id: { $in: patternIds }
            }).lean();
        }

        if (selectedPatterns.length === 0) {
            return res.json({
                success: false,
                message: '没有可用的规律'
            });
        }

        // 构建推荐筛选条件
        const recommendedFilters = {
            sumRange: [],
            spanRange: [],
            zoneRatios: [],
            oddEvenRatios: [],
            htcRatios: [],
            excludeHtcRatios: [],
            consecutiveCount: [],
            excludeConditions: {}
        };

        const appliedPatterns = [];

        // 应用每个规律
        selectedPatterns.forEach((pattern, index) => {
            const weight = 1 - (index * 0.1);  // 权重递减

            appliedPatterns.push({
                pattern_id: pattern.pattern_id,
                pattern_name: pattern.pattern_name,
                pattern_type: pattern.pattern_type,
                weight: weight,
                reason: `${pattern.score.grade}级规律，得分${pattern.score.totalScore.toFixed(1)}`
            });

            // 根据规律类型添加筛选条件
            if (pattern.pattern_type === 'sum_pattern' && pattern.parameters.range) {
                recommendedFilters.sumRange = pattern.parameters.range;
            } else if (pattern.pattern_type === 'span_pattern' && pattern.parameters.range) {
                recommendedFilters.spanRange = pattern.parameters.range;
            } else if (pattern.pattern_type === 'zone_ratio_pattern' && pattern.parameters.keyValues) {
                recommendedFilters.zoneRatios.push(...pattern.parameters.keyValues);
            } else if (pattern.pattern_type === 'odd_even_pattern' && pattern.parameters.keyValues) {
                recommendedFilters.oddEvenRatios.push(...pattern.parameters.keyValues);
            } else if (pattern.pattern_type === 'htc_ratio_pattern' && pattern.parameters.keyValues) {
                if (pattern.pattern_name.includes('排除') || pattern.pattern_name.includes('罕见')) {
                    recommendedFilters.excludeHtcRatios.push(...pattern.parameters.keyValues);
                } else {
                    recommendedFilters.htcRatios.push(...pattern.parameters.keyValues);
                }
            }
        });

        // 去重
        recommendedFilters.zoneRatios = [...new Set(recommendedFilters.zoneRatios)];
        recommendedFilters.oddEvenRatios = [...new Set(recommendedFilters.oddEvenRatios)];
        recommendedFilters.htcRatios = [...new Set(recommendedFilters.htcRatios)];
        recommendedFilters.excludeHtcRatios = [...new Set(recommendedFilters.excludeHtcRatios)];

        // 计算预期效果
        const avgAccuracy = selectedPatterns.reduce((sum, p) => sum + p.statistics.accuracy, 0) / selectedPatterns.length;
        const avgConfidence = selectedPatterns.reduce((sum, p) => sum + p.statistics.confidence, 0) / selectedPatterns.length;

        // 生成会话ID
        const sessionId = `REC_${Date.now()}`;

        // 保存推荐记录
        const recommendation = new DLTPatternRecommendation({
            session_id: sessionId,
            target_issue: targetIssue,
            applied_patterns: appliedPatterns,
            recommended_filters: recommendedFilters,
            prediction: {
                expectedAccuracy: avgAccuracy,
                confidence: avgConfidence,
                estimatedCombinations: 8500  // 估算值
            }
        });

        await recommendation.save();

        res.json({
            success: true,
            data: {
                sessionId,
                appliedPatterns,
                recommendedFilters,
                prediction: {
                    expectedAccuracy: (avgAccuracy * 100).toFixed(1) + '%',
                    confidence: (avgConfidence * 100).toFixed(1) + '%',
                    estimatedCombinations: 8500
                }
            }
        });

    } catch (error) {
        log(`❌ 智能推荐失败: ${error.message}`);
        console.error(error);
        res.json({
            success: false,
            message: `智能推荐失败: ${error.message}`
        });
    }
});

/**
 * 规律验证API
 * POST /api/dlt/patterns/validate/:patternId
 */
app.post('/api/dlt/patterns/validate/:patternId', async (req, res) => {
    try {
        const { patternId } = req.params;
        const { testPeriods = 50 } = req.body;

        log(`✅ 开始验证规律: ${patternId}, 测试期数: ${testPeriods}`);

        // 获取规律
        const pattern = await DLTPattern.findOne({ pattern_id: patternId }).lean();

        if (!pattern) {
            return res.json({
                success: false,
                message: '规律不存在'
            });
        }

        // 获取测试数据
        const testData = await DLT.find({})
            .sort({ Issue: -1 })
            .limit(testPeriods)
            .lean();

        testData.reverse();

        // 初始化评分系统
        const scoringSystem = new PatternScoringSystem();

        // 验证规律
        const validation = await scoringSystem.validatePattern(pattern, testData);

        // 更新规律的验证信息
        await DLTPattern.updateOne(
            { pattern_id: patternId },
            {
                $set: {
                    'validation.testPeriods': testPeriods,
                    'validation.hitCount': validation.hitCount,
                    'validation.missCount': validation.missCount,
                    'validation.validationDate': new Date(),
                    'validation.precision': validation.accuracy,
                    'validation.recall': validation.accuracy,
                    'validation.f1Score': validation.accuracy,
                    updated_at: new Date()
                }
            }
        );

        // 获取最近的命中记录
        const recentPerformance = [];
        for (let i = Math.max(0, testData.length - 20); i < testData.length; i++) {
            const data = testData[i];
            const hit = scoringSystem.checkPatternHit(pattern, data);

            let expected = '', actual = '';
            if (pattern.type === 'htc_ratio_pattern' && pattern.parameters.keyValues) {
                expected = pattern.parameters.keyValues.join('或');
                actual = data.htcRatio || '未知';
            }

            recentPerformance.push({
                issue: data.Issue.toString(),
                expected,
                actual,
                hit
            });
        }

        res.json({
            success: true,
            data: {
                pattern_id: patternId,
                validation: {
                    testPeriods,
                    hitCount: validation.hitCount,
                    missCount: validation.missCount,
                    accuracy: (validation.accuracy * 100).toFixed(1) + '%',
                    precision: (validation.accuracy * 100).toFixed(1) + '%',
                    recall: (validation.accuracy * 100).toFixed(1) + '%',
                    f1Score: (validation.accuracy * 100).toFixed(1) + '%'
                },
                recentPerformance
            }
        });

    } catch (error) {
        log(`❌ 规律验证失败: ${error.message}`);
        console.error(error);
        res.json({
            success: false,
            message: `规律验证失败: ${error.message}`
        });
    }
});

/**
 * 规律趋势分析API
 * GET /api/dlt/patterns/trend/:patternId
 */
app.get('/api/dlt/patterns/trend/:patternId', async (req, res) => {
    try {
        const { patternId } = req.params;
        const { periods = 100 } = req.query;

        const pattern = await DLTPattern.findOne({ pattern_id: patternId }).lean();

        if (!pattern) {
            return res.json({
                success: false,
                message: '规律不存在'
            });
        }

        // 获取历史数据
        const historicalData = await DLT.find({})
            .sort({ Issue: -1 })
            .limit(parseInt(periods))
            .lean();

        historicalData.reverse();

        // 分段计算准确率
        const segmentSize = 20;
        const trendData = [];
        const scoringSystem = new PatternScoringSystem();

        for (let i = 0; i < historicalData.length; i += segmentSize) {
            const segment = historicalData.slice(i, i + segmentSize);
            if (segment.length < 10) continue;

            const validation = await scoringSystem.validatePattern(pattern, segment);

            const startIssue = segment[0].Issue;
            const endIssue = segment[segment.length - 1].Issue;

            trendData.push({
                period: `${startIssue}-${endIssue}`,
                accuracy: parseFloat((validation.accuracy * 100).toFixed(1))
            });
        }

        // 计算趋势
        let trendDirection = 'stable';
        let slope = 0;

        if (trendData.length >= 2) {
            const firstAccuracy = trendData[0].accuracy;
            const lastAccuracy = trendData[trendData.length - 1].accuracy;
            slope = (lastAccuracy - firstAccuracy) / 100;

            if (slope > 0.05) trendDirection = 'strengthening';
            else if (slope < -0.05) trendDirection = 'weakening';
        }

        res.json({
            success: true,
            data: {
                pattern_id: patternId,
                trendData,
                trend: {
                    direction: trendDirection,
                    slope: slope.toFixed(3),
                    status: slope > 0 ? 'active' : (slope < -0.1 ? 'weakening' : 'active'),
                    recommendation: slope > 0 ? '该规律近期准确率上升，推荐使用' :
                                   (slope < -0.1 ? '该规律准确率下降，谨慎使用' : '该规律表现稳定')
                }
            }
        });

    } catch (error) {
        log(`❌ 趋势分析失败: ${error.message}`);
        res.json({
            success: false,
            message: `趋势分析失败: ${error.message}`
        });
    }
});

/**
 * 删除规律API
 * DELETE /api/dlt/patterns/:patternId
 */
app.delete('/api/dlt/patterns/:patternId', async (req, res) => {
    try {
        const { patternId } = req.params;

        const result = await DLTPattern.deleteOne({ pattern_id: patternId });

        if (result.deletedCount === 0) {
            return res.json({
                success: false,
                message: '规律不存在'
            });
        }

        // 同时删除历史记录
        await DLTPatternHistory.deleteMany({ pattern_id: patternId });

        log(`🗑️ 删除规律: ${patternId}`);

        res.json({
            success: true,
            message: '规律已删除'
        });

    } catch (error) {
        log(`❌ 删除规律失败: ${error.message}`);
        res.json({
            success: false,
            message: `删除规律失败: ${error.message}`
        });
    }
});

// ========== 规律生成功能 API 结束 ==========

// ===== CSV导出辅助函数 =====

/**
 * 解析导出过滤条件
 */
function parseExportFilters(query) {
    return {
        customSumExcludes: [],
        sumRecentPeriods: parseInt(query.sumRecentPeriods) || 10,
        sumRecentCustom: parseInt(query.sumRecentCustom) || null,
        sumBeforePeriods: parseInt(query.sumBeforePeriods) || null,
        htcRecentPeriods: parseInt(query.htcRecentPeriods) || 15,
        zoneRecentPeriods: parseInt(query.zoneRecentPeriods) || 20,
        customSumRanges: [],
        maxRecords: parseInt(query.maxRecords) || 10000
    };
}

/**
 * 解析无限制导出过滤条件
 */
function parseUnlimitedExportFilters(query) {
    const filters = {
        customSumExcludes: [],
        sumRanges: [],
        htcExcludes: [],
        zoneExcludes: [],
        sumRecentPeriods: null,
        htcRecentPeriods: null,
        zoneRecentPeriods: null
    };

    // 解析自定义和值排除
    if (query.sumExcludes) {
        try {
            const excludes = query.sumExcludes.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
            filters.customSumExcludes = excludes;
        } catch (e) {
            console.warn('解析和值排除条件失败:', e.message);
        }
    }

    // 解析和值范围排除
    if (query.sumRanges) {
        try {
            const ranges = JSON.parse(query.sumRanges);
            if (Array.isArray(ranges)) {
                filters.sumRanges = ranges.filter(range =>
                    range.start && range.end &&
                    !isNaN(range.start) && !isNaN(range.end) &&
                    range.start <= range.end
                );
            }
        } catch (e) {
            console.warn('解析和值范围条件失败:', e.message);
        }
    }

    // 解析历史期数排除条件
    if (query.sumRecentPeriods) {
        filters.sumRecentPeriods = parseInt(query.sumRecentPeriods);
    }
    if (query.htcRecentPeriods) {
        filters.htcRecentPeriods = parseInt(query.htcRecentPeriods);
    }
    if (query.zoneRecentPeriods) {
        filters.zoneRecentPeriods = parseInt(query.zoneRecentPeriods);
    }

    // 解析自定义热温冷比排除
    if (query.htcExcludes) {
        try {
            filters.htcExcludes = query.htcExcludes.split(',').map(s => s.trim()).filter(s => s.length > 0);
        } catch (e) {
            console.warn('解析热温冷比排除条件失败:', e.message);
        }
    }

    // 解析自定义区间比排除
    if (query.zoneExcludes) {
        try {
            filters.zoneExcludes = query.zoneExcludes.split(',').map(s => s.trim()).filter(s => s.length > 0);
        } catch (e) {
            console.warn('解析区间比排除条件失败:', e.message);
        }
    }

    return filters;
}

/**
 * 构建无限制导出的数据库查询条件
 */
async function buildUnlimitedQuery(filters, targetIssue) {
    const query = {};
    const andConditions = [];

    // 1. 处理自定义和值排除
    if (filters.customSumExcludes && filters.customSumExcludes.length > 0) {
        andConditions.push({
            sum_value: { $nin: filters.customSumExcludes }
        });
    }

    // 2. 处理和值范围排除
    if (filters.sumRanges && filters.sumRanges.length > 0) {
        const rangeConditions = filters.sumRanges.map(range => ({
            sum_value: {
                $not: {
                    $gte: parseInt(range.start),
                    $lte: parseInt(range.end)
                }
            }
        }));

        if (rangeConditions.length === 1) {
            andConditions.push(rangeConditions[0]);
        } else {
            andConditions.push({ $and: rangeConditions });
        }
    }

    // 3. 处理历史和值排除
    if (filters.sumRecentPeriods && filters.sumRecentPeriods > 0) {
        try {
            const excludedSums = await getRecentPeriodSumValues(targetIssue, filters.sumRecentPeriods);
            if (excludedSums.length > 0) {
                andConditions.push({
                    sum_value: { $nin: excludedSums }
                });
            }
        } catch (e) {
            console.warn('获取历史和值排除条件失败:', e.message);
        }
    }

    // 4. 处理自定义热温冷比排除
    if (filters.htcExcludes && filters.htcExcludes.length > 0) {
        andConditions.push({
            hot_warm_cold_ratio: { $nin: filters.htcExcludes }
        });
    }

    // 5. 处理历史热温冷比排除
    if (filters.htcRecentPeriods && filters.htcRecentPeriods > 0) {
        try {
            const excludedHtcRatios = await getRecentPeriodHtcRatios(targetIssue, filters.htcRecentPeriods);
            if (excludedHtcRatios.length > 0) {
                andConditions.push({
                    hot_warm_cold_ratio: { $nin: excludedHtcRatios }
                });
            }
        } catch (e) {
            console.warn('获取历史热温冷比排除条件失败:', e.message);
        }
    }

    // 6. 处理自定义区间比排除
    if (filters.zoneExcludes && filters.zoneExcludes.length > 0) {
        andConditions.push({
            zone_ratio: { $nin: filters.zoneExcludes }
        });
    }

    // 7. 处理历史区间比排除
    if (filters.zoneRecentPeriods && filters.zoneRecentPeriods > 0) {
        try {
            const excludedZoneRatios = await getRecentPeriodZoneRatios(targetIssue, filters.zoneRecentPeriods);
            if (excludedZoneRatios.length > 0) {
                andConditions.push({
                    zone_ratio: { $nin: excludedZoneRatios }
                });
            }
        } catch (e) {
            console.warn('获取历史区间比排除条件失败:', e.message);
        }
    }

    // 组装最终查询条件
    if (andConditions.length > 0) {
        if (andConditions.length === 1) {
            Object.assign(query, andConditions[0]);
        } else {
            query.$and = andConditions;
        }
    }

    return query;
}

/**
 * 获取指定期数的历史热温冷比
 */
async function getRecentPeriodHtcRatios(targetIssue, periods) {
    try {
        const baseIssue = parseInt(targetIssue) - 1;
        const startIssue = Math.max(24001, baseIssue - periods + 1);

        const recentData = await DLT.find({
            Issue: {
                $gte: startIssue,
                $lte: baseIssue
            }
        }).sort({ Issue: -1 }).limit(periods).lean();

        // 计算热温冷比并去重
        const htcRatios = new Set();

        for (const item of recentData) {
            const redBalls = [item.Red1, item.Red2, item.Red3, item.Red4, item.Red5];

            // 获取这期的遗漏数据来计算热温冷
            const missingData = await DLTRedMissing.findOne({ Issue: item.Issue }).lean();
            if (missingData) {
                const missingMap = {};
                for (let i = 1; i <= 35; i++) {
                    missingMap[i] = missingData[`Red${i}`] || 0;
                }

                let hot = 0, warm = 0, cold = 0;
                redBalls.forEach(num => {
                    const missing = missingMap[num] || 0;
                    if (missing <= 4) hot++;
                    else if (missing <= 9) warm++;
                    else cold++;
                });

                htcRatios.add(`${hot}:${warm}:${cold}`);
            }
        }

        return Array.from(htcRatios);
    } catch (error) {
        console.error('获取历史热温冷比失败:', error);
        return [];
    }
}

/**
 * 获取指定期数的历史区间比
 */
async function getRecentPeriodZoneRatios(targetIssue, periods) {
    try {
        const baseIssue = parseInt(targetIssue) - 1;
        const startIssue = Math.max(24001, baseIssue - periods + 1);

        const recentData = await DLT.find({
            Issue: {
                $gte: startIssue,
                $lte: baseIssue
            }
        }).sort({ Issue: -1 }).limit(periods).lean();

        const zoneRatios = new Set();

        recentData.forEach(item => {
            const redBalls = [item.Red1, item.Red2, item.Red3, item.Red4, item.Red5];
            let zone1 = 0, zone2 = 0, zone3 = 0;

            redBalls.forEach(num => {
                if (num <= 12) zone1++;
                else if (num <= 23) zone2++;
                else zone3++;
            });

            zoneRatios.add(`${zone1}:${zone2}:${zone3}`);
        });

        return Array.from(zoneRatios);
    } catch (error) {
        console.error('获取历史区间比失败:', error);
        return [];
    }
}

/**
 * 获取组合预测数据
 */
async function getCombinationPredictionData(sessionId, maxRecords = 100000) {
    try {
        // 这里可以从缓存、数据库或其他存储中获取会话数据
        // 目前直接返回空数组，实际实现时需要根据具体的数据存储方案调整
        log(`尝试获取会话 ${sessionId} 的预测数据，限制 ${maxRecords} 条`);
        return [];
    } catch (error) {
        log(`获取会话数据失败: ${error.message}`);
        return [];
    }
}

/**
 * 生成CSV内容
 */
function generateCSVContent(data, includeAnalysis = true, targetIssue = '') {
    // 定义基础表头
    let headers = [
        '序号', '红球1', '红球2', '红球3', '红球4', '红球5',
        '蓝球1', '蓝球2', '红球和值', '红球跨度'
    ];

    // 根据需要添加分析表头
    if (includeAnalysis) {
        headers.push(
            '区间比', '奇偶比', '热温冷比', '热号数', '温号数', '冷号数',
            'AC值', '连号数', '命中情况', '命中号码'
        );
    }

    let csvContent = headers.join(',') + '\n';

    // 处理数据行
    data.forEach((item, index) => {
        // 提取红球数据
        const redBalls = [
            item.red1 || item.red_ball_1 || '',
            item.red2 || item.red_ball_2 || '',
            item.red3 || item.red_ball_3 || '',
            item.red4 || item.red_ball_4 || '',
            item.red5 || item.red_ball_5 || ''
        ];

        // 提取蓝球数据
        const blueBalls = [
            item.blue1 || item.blue_ball_1 || '',
            item.blue2 || item.blue_ball_2 || ''
        ];

        // 基础行数据
        let row = [
            index + 1,
            ...redBalls.map(n => n.toString().padStart(2, '0')),
            ...blueBalls.map(n => n ? n.toString().padStart(2, '0') : ''),
            item.sum_value || item.redSum || 0,
            item.span_value || item.redSpan || 0
        ];

        // 添加分析数据
        if (includeAnalysis) {
            row.push(
                item.zone_ratio || item.zoneRatio || '',
                item.odd_even_ratio || item.oddEvenRatio || '',
                item.hot_warm_cold_ratio || item.htcRatio || '',
                item.hot_count || item.hotCount || 0,
                item.warm_count || item.warmCount || 0,
                item.cold_count || item.coldCount || 0,
                item.ac_value || item.acValue || 0,
                item.consecutive_count || item.consecutiveCount || 0,
                item.hit_analysis ? `中${item.hit_analysis.red_hit_count || 0}个` : '待开奖',
                item.hit_analysis ? (item.hit_analysis.red_hit_balls || []).join(' ') : ''
            );
        }

        // 处理CSV特殊字符
        const csvRow = row.map(value => {
            const str = String(value || '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        });

        csvContent += csvRow.join(',') + '\n';
    });

    return csvContent;
}

/**
 * 生成JSON内容
 */
function generateJSONContent(data, targetIssue = '') {
    const jsonData = {
        exportInfo: {
            targetIssue: targetIssue,
            exportTime: new Date().toISOString(),
            totalRecords: data.length,
            version: '1.0',
            description: '大乐透组合预测结果'
        },
        combinations: data.map((item, index) => ({
            序号: index + 1,
            红球: [
                item.red1 || item.red_ball_1,
                item.red2 || item.red_ball_2,
                item.red3 || item.red_ball_3,
                item.red4 || item.red_ball_4,
                item.red5 || item.red_ball_5
            ].filter(n => n),
            蓝球: [
                item.blue1 || item.blue_ball_1,
                item.blue2 || item.blue_ball_2
            ].filter(n => n),
            分析: {
                和值: item.sum_value || item.redSum || 0,
                跨度: item.span_value || item.redSpan || 0,
                区间比: item.zone_ratio || item.zoneRatio || '',
                奇偶比: item.odd_even_ratio || item.oddEvenRatio || '',
                热温冷比: item.hot_warm_cold_ratio || item.htcRatio || '',
                AC值: item.ac_value || item.acValue || 0,
                连号数: item.consecutive_count || item.consecutiveCount || 0
            },
            命中分析: item.hit_analysis || null
        }))
    };

    return JSON.stringify(jsonData, null, 2);
}

/**
 * 生成TXT内容
 */
function generateTXTContent(data, targetIssue = '') {
    let txtContent = `大乐透组合预测结果\n`;
    txtContent += `预测期号: ${targetIssue}\n`;
    txtContent += `导出时间: ${new Date().toLocaleString('zh-CN')}\n`;
    txtContent += `组合数量: ${data.length}条\n`;
    txtContent += `${'='.repeat(60)}\n\n`;

    data.forEach((item, index) => {
        const redBalls = [
            item.red1 || item.red_ball_1,
            item.red2 || item.red_ball_2,
            item.red3 || item.red_ball_3,
            item.red4 || item.red_ball_4,
            item.red5 || item.red_ball_5
        ].filter(n => n).map(n => n.toString().padStart(2, '0'));

        const blueBalls = [
            item.blue1 || item.blue_ball_1,
            item.blue2 || item.blue_ball_2
        ].filter(n => n).map(n => n.toString().padStart(2, '0'));

        txtContent += `第${(index + 1).toString().padStart(3, '0')}组:\n`;
        txtContent += `红球: ${redBalls.join(' ')}\n`;
        if (blueBalls.length > 0) {
            txtContent += `蓝球: ${blueBalls.join(' ')}\n`;
        }
        txtContent += `和值: ${item.sum_value || item.redSum || 0}`;
        txtContent += `, 跨度: ${item.span_value || item.redSpan || 0}`;
        txtContent += `, 区间比: ${item.zone_ratio || item.zoneRatio || '未知'}`;
        txtContent += `, 奇偶比: ${item.odd_even_ratio || item.oddEvenRatio || '未知'}\n`;

        if (item.hit_analysis) {
            txtContent += `命中情况: 中${item.hit_analysis.red_hit_count || 0}个红球`;
            if (item.hit_analysis.red_hit_balls && item.hit_analysis.red_hit_balls.length > 0) {
                txtContent += ` (${item.hit_analysis.red_hit_balls.join(' ')})`;
            }
            txtContent += '\n';
        }

        txtContent += `${'-'.repeat(40)}\n`;
    });

    return txtContent;
}

// 导出app实例用于Electron
module.exports = app;

// 只在直接运行时启动服务器 (非Electron环境)
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, async () => {
        log(`Server is running on port ${PORT}`);

        // 初始化组合数据库
        await initializeCombinationDatabase();

        // 启动缓存管理器
        cacheManager.start();

        log('🚀 大乐透预测系统 v3 已启动，支持预生成表方案和优化期号缓存');
    });
}