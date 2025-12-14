/**
 * 和值预测批量验证 - 数据模型
 * 创建日期: 2025-12-07
 */

const mongoose = require('mongoose');

// ========== 和值预测批量验证任务表 ==========
const sumPredictionTaskSchema = new mongoose.Schema({
    // 基础信息
    task_id: { type: String, required: true, unique: true }, // sum-pred-YYYYMMDD-序号
    task_name: { type: String, required: true },
    task_type: { type: String, default: 'sum-prediction-batch' },

    // 状态管理
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },

    // 期号范围配置
    period_range: {
        type: { type: String, enum: ['all', 'recent', 'custom'] },
        recent_count: Number,
        start_issue: String,
        end_issue: String,
        total_periods: { type: Number, default: 0 },
        processed_periods: { type: Number, default: 0 }
    },

    // 训练窗口 (可自定义，默认30期)
    training_window: { type: Number, default: 30, min: 10, max: 200 },

    // 前区和值预测策略
    front_strategy: {
        method: {
            type: String,
            enum: ['ma', 'weighted_ma', 'regression', 'fixed_range', 'history_set'],
            default: 'ma'
        },
        // MA相关参数
        ma_period: { type: Number, default: 20 },
        range_expand: { type: Number, default: 10 },
        // 固定范围参数
        fixed_range: {
            min: Number,
            max: Number
        },
        // 历史和值集参数
        history_set: {
            match_mode: { type: String, enum: ['range', 'exact'], default: 'range' },
            range_expand: { type: Number, default: 0 }
        }
    },

    // 后区和值预测策略
    back_strategy: {
        method: {
            type: String,
            enum: ['ma', 'weighted_ma', 'regression', 'fixed_range', 'history_set'],
            default: 'ma'
        },
        ma_period: { type: Number, default: 10 },
        range_expand: { type: Number, default: 3 },
        fixed_range: {
            min: Number,
            max: Number
        },
        history_set: {
            match_mode: { type: String, enum: ['range', 'exact'], default: 'range' },
            range_expand: { type: Number, default: 0 }
        }
    },

    // 技术分析增强 (可选，默认关闭)
    technical_analysis: {
        enabled: { type: Boolean, default: false },
        rsi: {
            enabled: { type: Boolean, default: false },
            period: { type: Number, default: 14 },
            overbought: { type: Number, default: 70 },
            oversold: { type: Number, default: 30 }
        },
        macd: {
            enabled: { type: Boolean, default: false },
            fast_period: { type: Number, default: 12 },
            slow_period: { type: Number, default: 26 },
            signal_period: { type: Number, default: 9 }
        },
        bollinger: {
            enabled: { type: Boolean, default: false },
            period: { type: Number, default: 20 },
            std_dev: { type: Number, default: 2 }
        }
    },

    // 执行统计
    execution_stats: {
        start_time: Date,
        end_time: Date,
        duration_ms: Number
    },

    // 汇总统计
    summary_stats: {
        front_hit_count: { type: Number, default: 0 },
        back_hit_count: { type: Number, default: 0 },
        both_hit_count: { type: Number, default: 0 },
        front_hit_rate: { type: Number, default: 0 },      // 百分比
        back_hit_rate: { type: Number, default: 0 },
        both_hit_rate: { type: Number, default: 0 },
        avg_front_diff: { type: Number, default: 0 },      // 平均偏差
        avg_back_diff: { type: Number, default: 0 },
        // 按范围位置统计
        front_above_count: { type: Number, default: 0 },   // 实际值高于预测范围
        front_below_count: { type: Number, default: 0 },   // 实际值低于预测范围
        back_above_count: { type: Number, default: 0 },
        back_below_count: { type: Number, default: 0 }
    },

    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

// 索引
sumPredictionTaskSchema.index({ task_id: 1 });
sumPredictionTaskSchema.index({ status: 1 });
sumPredictionTaskSchema.index({ created_at: -1 });

const SumPredictionTask = mongoose.model('HIT_DLT_SumPredictionTask', sumPredictionTaskSchema);

// ========== 和值预测批量验证结果表 ==========
const sumPredictionResultSchema = new mongoose.Schema({
    result_id: { type: String, required: true, unique: true },
    task_id: { type: String, required: true },
    period: { type: Number, required: true },

    // 训练数据信息
    training_info: {
        start_issue: Number,
        end_issue: Number,
        count: Number,
        // 历史和值集 (仅history_set方法时填充)
        front_sum_set: [Number],
        back_sum_set: [Number]
    },

    // 预测结果
    prediction: {
        front_sum: {
            recommended: Number,     // 推荐值 (MA/回归计算值)
            range_min: Number,
            range_max: Number,
            ma_value: Number,        // MA值
            confidence: Number,      // 置信度
            // 技术分析调整 (如果启用)
            tech_adjustment: Number,
            tech_signals: {
                rsi: { value: Number, signal: String },
                macd: { dif: Number, dea: Number, signal: String },
                bollinger: { position: String, band_width: Number }
            },
            // 历史和值集专用字段
            sum_set: [Number],       // 精确和值集合
            set_count: Number,       // 集合大小
            set_min: Number,         // 集合最小值
            set_max: Number,         // 集合最大值
            range_expand: Number     // 扩展范围
        },
        back_sum: {
            recommended: Number,
            range_min: Number,
            range_max: Number,
            ma_value: Number,
            confidence: Number,
            tech_adjustment: Number,
            tech_signals: {
                rsi: { value: Number, signal: String },
                macd: { dif: Number, dea: Number, signal: String },
                bollinger: { position: String, band_width: Number }
            },
            // 历史和值集专用字段
            sum_set: [Number],       // 精确和值集合
            set_count: Number,       // 集合大小
            set_min: Number,         // 集合最小值
            set_max: Number,         // 集合最大值
            range_expand: Number     // 扩展范围
        }
    },

    // 实际开奖数据
    actual: {
        red_balls: [Number],
        blue_balls: [Number],
        front_sum: Number,
        back_sum: Number
    },

    // 验证结果
    validation: {
        front_hit: Boolean,
        back_hit: Boolean,
        both_hit: Boolean,
        front_diff: Number,          // |实际 - 推荐|
        back_diff: Number,
        front_range_position: String, // 'in_range' | 'above' | 'below'
        back_range_position: String
    },

    created_at: { type: Date, default: Date.now }
});

// 索引
sumPredictionResultSchema.index({ task_id: 1, period: 1 }, { unique: true });
sumPredictionResultSchema.index({ task_id: 1 });
sumPredictionResultSchema.index({ period: 1 });
sumPredictionResultSchema.index({ created_at: -1 });

const SumPredictionResult = mongoose.model('HIT_DLT_SumPredictionResult', sumPredictionResultSchema);

module.exports = {
    SumPredictionTask,
    SumPredictionResult
};
