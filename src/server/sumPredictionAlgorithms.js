/**
 * 和值预测批量验证 - 核心算法
 * 创建日期: 2025-12-07
 *
 * 包含:
 * - 5种预测算法 (MA、加权MA、线性回归、固定范围、历史和值集)
 * - 技术分析增强 (RSI、MACD、布林带)
 * - 验证逻辑
 */

/**
 * 计算简单移动平均
 * @param {number[]} values - 数值数组
 * @param {number} period - MA周期
 * @returns {number} - MA值
 */
function calculateMA(values, period) {
    if (values.length < period) {
        period = values.length;
    }
    const recentValues = values.slice(-period);
    return recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
}

/**
 * 计算加权移动平均 (近期权重更高)
 * @param {number[]} values - 数值数组
 * @param {number} period - MA周期
 * @returns {number} - 加权MA值
 */
function calculateWeightedMA(values, period) {
    if (values.length < period) {
        period = values.length;
    }
    const recentValues = values.slice(-period);
    const weights = Array.from({ length: period }, (_, i) => i + 1);
    const weightedSum = recentValues.reduce((acc, val, i) => acc + val * weights[i], 0);
    const weightTotal = weights.reduce((a, b) => a + b, 0);
    return weightedSum / weightTotal;
}

/**
 * 计算线性回归
 * @param {number[]} values - 数值数组
 * @returns {{ slope: number, intercept: number, predicted: number }} - 斜率、截距和预测值
 */
function calculateLinearRegression(values) {
    const n = values.length;
    if (n < 2) {
        return { slope: 0, intercept: values[0] || 0, predicted: values[0] || 0 };
    }

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 0; i < n; i++) {
        const x = i + 1;
        const y = values[i];
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
    }

    const denominator = n * sumXX - sumX * sumX;
    if (denominator === 0) {
        return { slope: 0, intercept: sumY / n, predicted: sumY / n };
    }

    const slope = (n * sumXY - sumX * sumY) / denominator;
    const intercept = (sumY - slope * sumX) / n;
    const predicted = slope * (n + 1) + intercept;

    return { slope, intercept, predicted };
}

/**
 * 计算RSI (相对强弱指标)
 * @param {number[]} values - 数值数组
 * @param {number} period - RSI周期 (默认14)
 * @returns {{ value: number, signal: string }} - RSI值和信号
 */
function calculateRSI(values, period = 14) {
    if (values.length < period + 1) {
        return { value: 50, signal: 'neutral' };
    }

    const changes = [];
    for (let i = 1; i < values.length; i++) {
        changes.push(values[i] - values[i - 1]);
    }

    const recentChanges = changes.slice(-period);
    let gains = 0, losses = 0;

    for (const change of recentChanges) {
        if (change > 0) {
            gains += change;
        } else {
            losses += Math.abs(change);
        }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) {
        return { value: 100, signal: 'overbought' };
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    let signal = 'neutral';
    if (rsi >= 70) signal = 'overbought';
    else if (rsi <= 30) signal = 'oversold';

    return { value: Math.round(rsi * 100) / 100, signal };
}

/**
 * 计算EMA (指数移动平均)
 * @param {number[]} values - 数值数组
 * @param {number} period - EMA周期
 * @returns {number} - EMA值
 */
function calculateEMA(values, period) {
    if (values.length === 0) return 0;
    if (values.length < period) period = values.length;

    const multiplier = 2 / (period + 1);
    let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;

    for (let i = period; i < values.length; i++) {
        ema = (values[i] - ema) * multiplier + ema;
    }

    return ema;
}

/**
 * 计算MACD
 * @param {number[]} values - 数值数组
 * @param {Object} config - 配置 { fast_period, slow_period, signal_period }
 * @returns {{ dif: number, dea: number, macd: number, signal: string }}
 */
function calculateMACD(values, config = { fast_period: 12, slow_period: 26, signal_period: 9 }) {
    const { fast_period, slow_period, signal_period } = config;

    if (values.length < slow_period) {
        return { dif: 0, dea: 0, macd: 0, signal: 'neutral' };
    }

    // 计算快线和慢线EMA
    const emaFast = calculateEMA(values, fast_period);
    const emaSlow = calculateEMA(values, slow_period);
    const dif = emaFast - emaSlow;

    // 计算DIF的历史序列用于DEA
    const difHistory = [];
    for (let i = slow_period; i <= values.length; i++) {
        const subValues = values.slice(0, i);
        const subEmaFast = calculateEMA(subValues, fast_period);
        const subEmaSlow = calculateEMA(subValues, slow_period);
        difHistory.push(subEmaFast - subEmaSlow);
    }

    const dea = difHistory.length >= signal_period ? calculateEMA(difHistory, signal_period) : dif;
    const macd = (dif - dea) * 2;

    let signal = 'neutral';
    if (dif > dea && macd > 0) signal = 'bullish';
    else if (dif < dea && macd < 0) signal = 'bearish';

    return {
        dif: Math.round(dif * 100) / 100,
        dea: Math.round(dea * 100) / 100,
        macd: Math.round(macd * 100) / 100,
        signal
    };
}

/**
 * 计算布林带
 * @param {number[]} values - 数值数组
 * @param {Object} config - 配置 { period, std_dev }
 * @returns {{ upper: number, middle: number, lower: number, position: string, band_width: number }}
 */
function calculateBollinger(values, config = { period: 20, std_dev: 2 }) {
    const { period, std_dev } = config;

    if (values.length < period) {
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        return { upper: avg, middle: avg, lower: avg, position: 'middle', band_width: 0 };
    }

    const recentValues = values.slice(-period);
    const middle = recentValues.reduce((a, b) => a + b, 0) / period;

    // 计算标准差
    const squaredDiffs = recentValues.map(v => Math.pow(v - middle, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const stdDev = Math.sqrt(variance);

    const upper = middle + std_dev * stdDev;
    const lower = middle - std_dev * stdDev;
    const band_width = ((upper - lower) / middle) * 100;

    const currentValue = values[values.length - 1];
    let position = 'middle';
    if (currentValue >= upper) position = 'above_upper';
    else if (currentValue > middle + stdDev) position = 'upper_half';
    else if (currentValue <= lower) position = 'below_lower';
    else if (currentValue < middle - stdDev) position = 'lower_half';

    return {
        upper: Math.round(upper * 100) / 100,
        middle: Math.round(middle * 100) / 100,
        lower: Math.round(lower * 100) / 100,
        position,
        band_width: Math.round(band_width * 100) / 100
    };
}

/**
 * 根据方法计算预测值
 * @param {number[]} sums - 和值序列
 * @param {Object} strategy - 策略配置
 * @returns {Object} - 预测结果
 */
function predictByMethod(sums, strategy) {
    const { method, ma_period, range_expand, fixed_range, history_set } = strategy;

    let result = {
        recommended: null,
        range_min: null,
        range_max: null,
        ma_value: null,
        confidence: 70,
        sum_set: null
    };

    if (sums.length === 0) {
        return result;
    }

    switch (method) {
        case 'ma':
            // 简单移动平均
            const maValue = calculateMA(sums, ma_period || 20);
            result.recommended = Math.round(maValue);
            result.ma_value = Math.round(maValue * 100) / 100;
            result.range_min = result.recommended - (range_expand || 10);
            result.range_max = result.recommended + (range_expand || 10);
            result.confidence = 70;
            break;

        case 'weighted_ma':
            // 加权移动平均
            const wmaValue = calculateWeightedMA(sums, ma_period || 20);
            result.recommended = Math.round(wmaValue);
            result.ma_value = Math.round(wmaValue * 100) / 100;
            result.range_min = result.recommended - (range_expand || 10);
            result.range_max = result.recommended + (range_expand || 10);
            result.confidence = 72;
            break;

        case 'regression':
            // 线性回归
            const regResult = calculateLinearRegression(sums.slice(-(ma_period || 20)));
            result.recommended = Math.round(regResult.predicted);
            result.ma_value = Math.round(regResult.predicted * 100) / 100;
            result.range_min = result.recommended - (range_expand || 10);
            result.range_max = result.recommended + (range_expand || 10);
            result.confidence = 68;
            break;

        case 'fixed_range':
            // 固定范围
            if (fixed_range && typeof fixed_range.min === 'number' && typeof fixed_range.max === 'number') {
                result.range_min = fixed_range.min;
                result.range_max = fixed_range.max;
                result.recommended = Math.round((fixed_range.min + fixed_range.max) / 2);
            } else {
                // 如果没有设置固定范围，使用默认MA
                const defaultMa = calculateMA(sums, 20);
                result.recommended = Math.round(defaultMa);
                result.range_min = result.recommended - 10;
                result.range_max = result.recommended + 10;
            }
            result.confidence = 65;
            break;

        case 'history_set':
            // 历史和值集 - 基于训练窗口的精确和值集合
            result.sum_set = [...new Set(sums)].sort((a, b) => a - b);

            const historyConfig = history_set || { match_mode: 'range', range_expand: 0 };
            const histExpand = historyConfig.range_expand || 0;

            // 集合统计信息
            result.set_count = result.sum_set.length;
            result.set_min = Math.min(...result.sum_set);
            result.set_max = Math.max(...result.sum_set);

            // 范围扩展模式：对每个值±扩展
            result.range_expand = histExpand;
            if (histExpand > 0) {
                result.expanded_ranges = result.sum_set.map(v => ({
                    value: v,
                    min: v - histExpand,
                    max: v + histExpand
                }));
            }

            // 推荐值使用集合中位数
            result.recommended = result.sum_set[Math.floor(result.sum_set.length / 2)];

            // 不使用 range_min/range_max，用 sum_set 判断命中
            result.range_min = null;
            result.range_max = null;
            result.confidence = 75;
            break;

        default:
            // 默认使用MA
            const defaultMaValue = calculateMA(sums, 20);
            result.recommended = Math.round(defaultMaValue);
            result.ma_value = Math.round(defaultMaValue * 100) / 100;
            result.range_min = result.recommended - 10;
            result.range_max = result.recommended + 10;
            result.confidence = 70;
    }

    return result;
}

/**
 * 应用技术分析调整
 * @param {Object} prediction - 预测结果
 * @param {number[]} sums - 和值序列
 * @param {Object} techConfig - 技术分析配置
 * @returns {Object} - 调整后的预测结果
 */
function applyTechnicalAdjustment(prediction, sums, techConfig) {
    if (!techConfig || !techConfig.enabled) {
        return prediction;
    }

    let totalAdjustment = 0;
    const signals = {};

    // RSI调整
    if (techConfig.rsi && techConfig.rsi.enabled) {
        const rsiResult = calculateRSI(sums, techConfig.rsi.period || 14);
        signals.rsi = rsiResult;

        const overbought = techConfig.rsi.overbought || 70;
        const oversold = techConfig.rsi.oversold || 30;

        if (rsiResult.value >= 80) {
            totalAdjustment -= 5; // 严重超买，下调
        } else if (rsiResult.value >= overbought) {
            totalAdjustment -= 2;
        } else if (rsiResult.value <= 20) {
            totalAdjustment += 5; // 严重超卖，上调
        } else if (rsiResult.value <= oversold) {
            totalAdjustment += 2;
        }
    }

    // MACD调整
    if (techConfig.macd && techConfig.macd.enabled) {
        const macdResult = calculateMACD(sums, {
            fast_period: techConfig.macd.fast_period || 12,
            slow_period: techConfig.macd.slow_period || 26,
            signal_period: techConfig.macd.signal_period || 9
        });
        signals.macd = macdResult;

        if (macdResult.signal === 'bullish' && macdResult.macd > 0) {
            totalAdjustment += Math.min(3, Math.abs(macdResult.macd));
        } else if (macdResult.signal === 'bearish' && macdResult.macd < 0) {
            totalAdjustment -= Math.min(3, Math.abs(macdResult.macd));
        }
    }

    // 布林带调整
    if (techConfig.bollinger && techConfig.bollinger.enabled) {
        const bollingerResult = calculateBollinger(sums, {
            period: techConfig.bollinger.period || 20,
            std_dev: techConfig.bollinger.std_dev || 2
        });
        signals.bollinger = bollingerResult;

        switch (bollingerResult.position) {
            case 'above_upper':
                totalAdjustment -= 5;
                break;
            case 'upper_half':
                totalAdjustment -= 2;
                break;
            case 'below_lower':
                totalAdjustment += 5;
                break;
            case 'lower_half':
                totalAdjustment += 2;
                break;
        }
    }

    // 应用调整
    const adjustedPrediction = { ...prediction };
    adjustedPrediction.tech_adjustment = Math.round(totalAdjustment);
    adjustedPrediction.tech_signals = signals;

    if (adjustedPrediction.recommended !== null) {
        adjustedPrediction.recommended += Math.round(totalAdjustment);
        adjustedPrediction.range_min += Math.round(totalAdjustment);
        adjustedPrediction.range_max += Math.round(totalAdjustment);
    }

    return adjustedPrediction;
}

/**
 * 计算单期和值预测
 * @param {Array} trainingData - 训练数据 (目标期号前N期)
 * @param {Object} frontStrategy - 前区预测策略
 * @param {Object} backStrategy - 后区预测策略
 * @param {Object} techConfig - 技术分析配置
 * @returns {Object} - 预测结果
 */
function calculateSumPrediction(trainingData, frontStrategy, backStrategy, techConfig) {
    // 1. 提取和值序列
    const frontSums = trainingData.map(d => d.Red1 + d.Red2 + d.Red3 + d.Red4 + d.Red5);
    const backSums = trainingData.map(d => d.Blue1 + d.Blue2);

    // 2. 计算前区预测
    let frontPrediction = predictByMethod(frontSums, frontStrategy);

    // 3. 计算后区预测
    let backPrediction = predictByMethod(backSums, backStrategy);

    // 4. 应用技术分析调整 (如果启用)
    if (techConfig && techConfig.enabled) {
        frontPrediction = applyTechnicalAdjustment(frontPrediction, frontSums, techConfig);
        backPrediction = applyTechnicalAdjustment(backPrediction, backSums, techConfig);
    }

    return { front: frontPrediction, back: backPrediction };
}

/**
 * 验证预测结果
 * @param {Object} prediction - 预测结果
 * @param {Object} actual - 实际开奖数据
 * @param {string} frontMethod - 前区预测方法
 * @param {Object} frontHistorySet - 前区历史和值集配置
 * @param {string} backMethod - 后区预测方法
 * @param {Object} backHistorySet - 后区历史和值集配置
 * @returns {Object} - 验证结果
 */
function validatePrediction(prediction, actual, frontMethod, frontHistorySet, backMethod, backHistorySet) {
    let frontHit, backHit;
    let frontRangePosition = 'in_range';
    let backRangePosition = 'in_range';

    // 前区验证
    if (frontMethod === 'history_set') {
        const sumSet = prediction.front.sum_set || [];
        const rangeExpand = prediction.front.range_expand || 0;

        if (rangeExpand > 0) {
            // 范围扩展模式：实际值是否在任一扩展范围内
            frontHit = sumSet.some(v =>
                actual.front_sum >= v - rangeExpand && actual.front_sum <= v + rangeExpand
            );
        } else {
            // 精确匹配模式：实际值是否在集合中
            frontHit = sumSet.includes(actual.front_sum);
        }

        // 计算范围位置（基于集合边界）
        if (sumSet.length > 0) {
            const setMin = Math.min(...sumSet) - rangeExpand;
            const setMax = Math.max(...sumSet) + rangeExpand;
            if (actual.front_sum < setMin) {
                frontRangePosition = 'below';
            } else if (actual.front_sum > setMax) {
                frontRangePosition = 'above';
            }
        }
    } else {
        frontHit = actual.front_sum >= prediction.front.range_min &&
                   actual.front_sum <= prediction.front.range_max;

        if (actual.front_sum < prediction.front.range_min) {
            frontRangePosition = 'below';
        } else if (actual.front_sum > prediction.front.range_max) {
            frontRangePosition = 'above';
        }
    }

    // 后区验证
    if (backMethod === 'history_set') {
        const sumSet = prediction.back.sum_set || [];
        const rangeExpand = prediction.back.range_expand || 0;

        if (rangeExpand > 0) {
            // 范围扩展模式：实际值是否在任一扩展范围内
            backHit = sumSet.some(v =>
                actual.back_sum >= v - rangeExpand && actual.back_sum <= v + rangeExpand
            );
        } else {
            // 精确匹配模式：实际值是否在集合中
            backHit = sumSet.includes(actual.back_sum);
        }

        // 计算范围位置（基于集合边界）
        if (sumSet.length > 0) {
            const setMin = Math.min(...sumSet) - rangeExpand;
            const setMax = Math.max(...sumSet) + rangeExpand;
            if (actual.back_sum < setMin) {
                backRangePosition = 'below';
            } else if (actual.back_sum > setMax) {
                backRangePosition = 'above';
            }
        }
    } else {
        backHit = actual.back_sum >= prediction.back.range_min &&
                  actual.back_sum <= prediction.back.range_max;

        if (actual.back_sum < prediction.back.range_min) {
            backRangePosition = 'below';
        } else if (actual.back_sum > prediction.back.range_max) {
            backRangePosition = 'above';
        }
    }

    return {
        front_hit: frontHit,
        back_hit: backHit,
        both_hit: frontHit && backHit,
        front_diff: prediction.front.recommended !== null ?
                    Math.abs(actual.front_sum - prediction.front.recommended) : null,
        back_diff: prediction.back.recommended !== null ?
                   Math.abs(actual.back_sum - prediction.back.recommended) : null,
        front_range_position: frontRangePosition,
        back_range_position: backRangePosition
    };
}

module.exports = {
    calculateMA,
    calculateWeightedMA,
    calculateLinearRegression,
    calculateRSI,
    calculateEMA,
    calculateMACD,
    calculateBollinger,
    predictByMethod,
    applyTechnicalAdjustment,
    calculateSumPrediction,
    validatePrediction
};
