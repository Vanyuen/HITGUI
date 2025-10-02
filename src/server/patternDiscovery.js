/**
 * HIT-大乐透-规律发现引擎
 * 自动发现和提取历史数据中的中奖规律
 */

const mongoose = require('mongoose');

/**
 * 规律发现引擎核心类
 */
class PatternDiscoveryEngine {
    constructor(config = {}) {
        this.minConfidence = config.minConfidence || 0.6;       // 最小置信度
        this.minSupport = config.minSupport || 10;              // 最小支持度（样本数）
        this.analysisWindow = config.analysisWindow || 200;     // 分析窗口期数
        this.minFrequency = config.minFrequency || 0.1;         // 最小出现频率
    }

    /**
     * 发现所有类型的规律
     */
    async discoverAllPatterns(historicalData, patternTypes = null) {
        console.log(`🔍 开始发现规律 - 分析${historicalData.length}期数据`);

        const allPatterns = [];
        const typesToDiscover = patternTypes || [
            'sum_pattern',
            'span_pattern',
            'zone_ratio_pattern',
            'odd_even_pattern',
            'htc_ratio_pattern',
            'consecutive_pattern',
            'repeat_number_pattern'
        ];

        for (const type of typesToDiscover) {
            console.log(`📊 正在分析${type}规律...`);
            let patterns = [];

            switch (type) {
                case 'sum_pattern':
                    patterns = await this.discoverSumPatterns(historicalData);
                    break;
                case 'span_pattern':
                    patterns = await this.discoverSpanPatterns(historicalData);
                    break;
                case 'zone_ratio_pattern':
                    patterns = await this.discoverZoneRatioPatterns(historicalData);
                    break;
                case 'odd_even_pattern':
                    patterns = await this.discoverOddEvenPatterns(historicalData);
                    break;
                case 'htc_ratio_pattern':
                    patterns = await this.discoverHTCPatterns(historicalData);
                    break;
                case 'consecutive_pattern':
                    patterns = await this.discoverConsecutivePatterns(historicalData);
                    break;
                case 'repeat_number_pattern':
                    patterns = await this.discoverRepeatPatterns(historicalData);
                    break;
            }

            console.log(`✅ ${type}规律发现完成，找到${patterns.length}个有效规律`);
            allPatterns.push(...patterns);
        }

        console.log(`🎉 规律发现完成！共发现${allPatterns.length}个有效规律`);
        return allPatterns;
    }

    /**
     * 发现和值规律
     */
    async discoverSumPatterns(historicalData) {
        const patterns = [];
        const sumValues = historicalData.map(d => this.calculateSum(d));

        // 1. 和值周期性分析
        const cyclicPatterns = this.detectCyclicPatterns(sumValues, [3, 5, 7, 10]);
        cyclicPatterns.forEach(cycle => {
            if (cycle.confidence >= this.minConfidence) {
                patterns.push({
                    type: 'sum_pattern',
                    name: `和值${cycle.period}期周期`,
                    description: `和值每${cycle.period}期呈现${cycle.description}`,
                    parameters: {
                        cycle: cycle.period,
                        range: cycle.range
                    },
                    statistics: {
                        confidence: cycle.confidence,
                        accuracy: cycle.accuracy,
                        frequency: cycle.frequency,
                        support: cycle.occurrenceCount,
                        lastOccurrence: historicalData[historicalData.length - 1].Issue.toString(),
                        occurrenceCount: cycle.occurrenceCount
                    }
                });
            }
        });

        // 2. 和值区间分布规律
        const rangePatterns = this.detectRangePatterns(
            sumValues,
            [[60, 80], [80, 100], [100, 120], [120, 140]]
        );

        rangePatterns.forEach(range => {
            if (range.probability >= this.minFrequency) {
                patterns.push({
                    type: 'sum_pattern',
                    name: `和值集中区间[${range.min}-${range.max}]`,
                    description: `和值在[${range.min}-${range.max}]区间出现频率${(range.probability * 100).toFixed(1)}%`,
                    parameters: {
                        range: [range.min, range.max]
                    },
                    statistics: {
                        confidence: range.confidence,
                        accuracy: range.accuracy,
                        frequency: range.probability,
                        support: range.count,
                        lastOccurrence: historicalData[historicalData.length - 1].Issue.toString(),
                        occurrenceCount: range.count
                    }
                });
            }
        });

        // 3. 和值连续趋势
        const trendPatterns = this.detectTrendPatterns(sumValues);
        trendPatterns.forEach(trend => {
            if (trend.significance >= this.minConfidence) {
                patterns.push({
                    type: 'sum_pattern',
                    name: trend.name,
                    description: trend.description,
                    parameters: {
                        threshold: trend.threshold
                    },
                    statistics: {
                        confidence: trend.confidence,
                        accuracy: trend.accuracy,
                        frequency: trend.frequency,
                        support: trend.count,
                        lastOccurrence: historicalData[historicalData.length - 1].Issue.toString(),
                        occurrenceCount: trend.count
                    }
                });
            }
        });

        return patterns;
    }

    /**
     * 发现跨度规律
     */
    async discoverSpanPatterns(historicalData) {
        const patterns = [];
        const spanValues = historicalData.map(d => this.calculateSpan(d));

        // 跨度集中区间
        const rangePatterns = this.detectRangePatterns(
            spanValues,
            [[15, 20], [18, 25], [20, 28], [25, 30]]
        );

        rangePatterns.forEach(range => {
            if (range.probability >= 0.3) {  // 跨度区间出现频率>=30%才保留
                patterns.push({
                    type: 'span_pattern',
                    name: `跨度集中区间[${range.min}-${range.max}]`,
                    description: `跨度在[${range.min}-${range.max}]区间出现频率${(range.probability * 100).toFixed(1)}%`,
                    parameters: {
                        range: [range.min, range.max]
                    },
                    statistics: {
                        confidence: range.confidence,
                        accuracy: range.accuracy,
                        frequency: range.probability,
                        support: range.count,
                        lastOccurrence: historicalData[historicalData.length - 1].Issue.toString(),
                        occurrenceCount: range.count
                    }
                });
            }
        });

        return patterns;
    }

    /**
     * 发现区间比规律
     */
    async discoverZoneRatioPatterns(historicalData) {
        const patterns = [];
        const zoneRatios = historicalData.map(d => this.calculateZoneRatio(d));

        // 统计各区间比分布
        const distribution = this.calculateDistribution(zoneRatios);

        // 找出高频区间比
        const topRatios = Object.entries(distribution)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .filter(([ratio, freq]) => freq >= this.minFrequency);

        if (topRatios.length > 0) {
            patterns.push({
                type: 'zone_ratio_pattern',
                name: '高频区间比分布',
                description: `区间比${topRatios.map(([r, f]) => `${r}(${(f * 100).toFixed(1)}%)`).join(', ')}出现频率最高`,
                parameters: {
                    keyValues: topRatios.map(([r]) => r)
                },
                statistics: {
                    confidence: 0.9,
                    accuracy: topRatios.reduce((sum, [, freq]) => sum + freq, 0),
                    frequency: topRatios.reduce((sum, [, freq]) => sum + freq, 0),
                    support: historicalData.length,
                    lastOccurrence: historicalData[historicalData.length - 1].Issue.toString(),
                    occurrenceCount: Math.floor(historicalData.length * topRatios[0][1])
                }
            });
        }

        // 排除型规律（极端区间比）
        const extremeRatios = Object.entries(distribution)
            .filter(([ratio, freq]) => freq < 0.02)  // 出现频率<2%的极端比例
            .map(([ratio]) => ratio);

        if (extremeRatios.length > 0) {
            patterns.push({
                type: 'zone_ratio_pattern',
                name: '极端区间比排除',
                description: `区间比${extremeRatios.join(', ')}几乎不出现`,
                parameters: {
                    keyValues: extremeRatios
                },
                statistics: {
                    confidence: 0.95,
                    accuracy: 0.98,
                    frequency: 0.02,
                    support: historicalData.length,
                    lastOccurrence: historicalData[historicalData.length - 1].Issue.toString(),
                    occurrenceCount: Math.floor(historicalData.length * 0.02)
                }
            });
        }

        return patterns;
    }

    /**
     * 发现奇偶比规律
     */
    async discoverOddEvenPatterns(historicalData) {
        const patterns = [];
        const oddEvenRatios = historicalData.map(d => this.calculateOddEvenRatio(d));

        // 统计各奇偶比分布
        const distribution = this.calculateDistribution(oddEvenRatios);

        // 找出均衡型奇偶比
        const balancedRatios = Object.entries(distribution)
            .filter(([ratio, freq]) => {
                const [odd, even] = ratio.split(':').map(Number);
                return Math.abs(odd - even) <= 1 && freq >= 0.2;  // 差值≤1且频率≥20%
            })
            .sort((a, b) => b[1] - a[1]);

        if (balancedRatios.length > 0) {
            const totalFreq = balancedRatios.reduce((sum, [, freq]) => sum + freq, 0);
            patterns.push({
                type: 'odd_even_pattern',
                name: '奇偶均衡主导',
                description: `奇偶比${balancedRatios.map(([r]) => r).join(', ')}占比${(totalFreq * 100).toFixed(1)}%`,
                parameters: {
                    keyValues: balancedRatios.map(([r]) => r)
                },
                statistics: {
                    confidence: 0.85,
                    accuracy: totalFreq,
                    frequency: totalFreq,
                    support: historicalData.length,
                    lastOccurrence: historicalData[historicalData.length - 1].Issue.toString(),
                    occurrenceCount: Math.floor(historicalData.length * totalFreq)
                }
            });
        }

        return patterns;
    }

    /**
     * 发现热温冷比规律 ⭐
     */
    async discoverHTCPatterns(historicalData) {
        const patterns = [];

        // 确保每期数据都有htcRatio字段
        const htcSequence = historicalData
            .filter(d => d.htcRatio && d.htcRatio !== '')
            .map(d => d.htcRatio);

        if (htcSequence.length < this.minSupport) {
            console.warn(`⚠️ 热温冷数据不足：仅${htcSequence.length}期，需要至少${this.minSupport}期`);
            return patterns;
        }

        // 1. 热温冷周期检测
        const cycles = this.detectHTCCycles(htcSequence);
        cycles.forEach(cycle => {
            if (cycle.confidence >= this.minConfidence) {
                patterns.push({
                    type: 'htc_ratio_pattern',
                    name: `热温冷${cycle.description}周期`,
                    description: `每${cycle.period}期出现${cycle.dominantType}主导的组合`,
                    parameters: {
                        cycle: cycle.period,
                        keyValues: cycle.dominantRatios
                    },
                    statistics: {
                        confidence: cycle.confidence,
                        accuracy: cycle.accuracy,
                        frequency: cycle.frequency,
                        support: cycle.occurrenceCount,
                        lastOccurrence: historicalData[historicalData.length - 1].Issue.toString(),
                        occurrenceCount: cycle.occurrenceCount
                    }
                });
            }
        });

        // 2. 热温冷转换规律
        const transitions = this.analyzeHTCTransitions(htcSequence);
        const significantTransitions = transitions.filter(t => t.probability > 0.65);

        significantTransitions.forEach(transition => {
            patterns.push({
                type: 'htc_ratio_pattern',
                name: `${transition.from} → ${transition.to}转换规律`,
                description: `${transition.from}后，有${(transition.probability * 100).toFixed(1)}%概率变为${transition.to}`,
                parameters: {
                    transition: {
                        from: transition.from,
                        to: transition.to,
                        probability: transition.probability
                    }
                },
                statistics: {
                    confidence: transition.probability,
                    accuracy: transition.probability,
                    frequency: transition.count / htcSequence.length,
                    support: transition.count,
                    lastOccurrence: historicalData[historicalData.length - 1].Issue.toString(),
                    occurrenceCount: transition.count
                }
            });
        });

        // 3. 热温冷分布规律
        const distribution = this.calculateDistribution(htcSequence);
        const top5 = Object.entries(distribution)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const rare = Object.entries(distribution)
            .filter(([, freq]) => freq < 0.02)
            .map(([ratio]) => ratio);

        patterns.push({
            type: 'htc_ratio_pattern',
            name: '热温冷比分布规律',
            description: `高频比例：${top5.map(([r, f]) => `${r}(${(f * 100).toFixed(1)}%)`).join(', ')}`,
            parameters: {
                keyValues: top5.map(([r]) => r)
            },
            statistics: {
                confidence: 0.9,
                accuracy: top5.reduce((sum, [, freq]) => sum + freq, 0),
                frequency: top5.reduce((sum, [, freq]) => sum + freq, 0),
                support: htcSequence.length,
                lastOccurrence: historicalData[historicalData.length - 1].Issue.toString(),
                occurrenceCount: htcSequence.length
            }
        });

        // 添加排除规律
        if (rare.length > 0) {
            patterns.push({
                type: 'htc_ratio_pattern',
                name: '罕见热温冷比排除',
                description: `热温冷比${rare.join(', ')}出现频率<2%，建议排除`,
                parameters: {
                    keyValues: rare
                },
                statistics: {
                    confidence: 0.95,
                    accuracy: 0.98,
                    frequency: 0.02,
                    support: htcSequence.length,
                    lastOccurrence: historicalData[historicalData.length - 1].Issue.toString(),
                    occurrenceCount: Math.floor(htcSequence.length * 0.02)
                }
            });
        }

        return patterns;
    }

    /**
     * 发现连号规律
     */
    async discoverConsecutivePatterns(historicalData) {
        const patterns = [];
        const consecutiveCounts = historicalData.map(d => this.calculateConsecutiveCount(d));

        const distribution = this.calculateDistribution(consecutiveCounts.map(c => c.toString()));

        patterns.push({
            type: 'consecutive_pattern',
            name: '连号出现规律',
            description: `包含连号分布：${Object.entries(distribution).map(([count, freq]) => `${count}组(${(freq * 100).toFixed(1)}%)`).join(', ')}`,
            parameters: {
                keyValues: Object.keys(distribution)
            },
            statistics: {
                confidence: 0.85,
                accuracy: 0.8,
                frequency: 1 - (distribution['0'] || 0),
                support: historicalData.length,
                lastOccurrence: historicalData[historicalData.length - 1].Issue.toString(),
                occurrenceCount: historicalData.length
            }
        });

        return patterns;
    }

    /**
     * 发现重号规律
     */
    async discoverRepeatPatterns(historicalData) {
        const patterns = [];
        const repeatCounts = [];

        for (let i = 1; i < historicalData.length; i++) {
            const prev = [historicalData[i - 1].Red1, historicalData[i - 1].Red2,
                         historicalData[i - 1].Red3, historicalData[i - 1].Red4,
                         historicalData[i - 1].Red5];
            const curr = [historicalData[i].Red1, historicalData[i].Red2,
                         historicalData[i].Red3, historicalData[i].Red4,
                         historicalData[i].Red5];

            const repeatCount = prev.filter(n => curr.includes(n)).length;
            repeatCounts.push(repeatCount);
        }

        const distribution = this.calculateDistribution(repeatCounts.map(c => c.toString()));

        patterns.push({
            type: 'repeat_number_pattern',
            name: '上期重号规律',
            description: `与上期重复号码分布：${Object.entries(distribution).map(([count, freq]) => `${count}个(${(freq * 100).toFixed(1)}%)`).join(', ')}`,
            parameters: {
                keyValues: Object.keys(distribution)
            },
            statistics: {
                confidence: 0.85,
                accuracy: 0.8,
                frequency: 1 - (distribution['0'] || 0),
                support: repeatCounts.length,
                lastOccurrence: historicalData[historicalData.length - 1].Issue.toString(),
                occurrenceCount: repeatCounts.length
            }
        });

        return patterns;
    }

    // ========== 辅助方法 ==========

    /**
     * 计算和值
     */
    calculateSum(data) {
        return data.Red1 + data.Red2 + data.Red3 + data.Red4 + data.Red5;
    }

    /**
     * 计算跨度
     */
    calculateSpan(data) {
        const reds = [data.Red1, data.Red2, data.Red3, data.Red4, data.Red5];
        return Math.max(...reds) - Math.min(...reds);
    }

    /**
     * 计算区间比
     */
    calculateZoneRatio(data) {
        const reds = [data.Red1, data.Red2, data.Red3, data.Red4, data.Red5];
        const zone1 = reds.filter(n => n >= 1 && n <= 12).length;
        const zone2 = reds.filter(n => n >= 13 && n <= 24).length;
        const zone3 = reds.filter(n => n >= 25 && n <= 35).length;
        return `${zone1}:${zone2}:${zone3}`;
    }

    /**
     * 计算奇偶比
     */
    calculateOddEvenRatio(data) {
        const reds = [data.Red1, data.Red2, data.Red3, data.Red4, data.Red5];
        const oddCount = reds.filter(n => n % 2 === 1).length;
        const evenCount = 5 - oddCount;
        return `${oddCount}:${evenCount}`;
    }

    /**
     * 计算连号数量
     */
    calculateConsecutiveCount(data) {
        const reds = [data.Red1, data.Red2, data.Red3, data.Red4, data.Red5].sort((a, b) => a - b);
        let count = 0;
        for (let i = 1; i < reds.length; i++) {
            if (reds[i] - reds[i - 1] === 1) {
                count++;
            }
        }
        return count;
    }

    /**
     * 检测周期性模式
     */
    detectCyclicPatterns(sequence, periodsToTest) {
        const patterns = [];

        for (const period of periodsToTest) {
            const segments = this.segmentByPeriod(sequence, period);
            const pattern = this.findRepeatingPattern(segments, period);

            if (pattern && pattern.confidence > this.minConfidence) {
                patterns.push(pattern);
            }
        }

        return patterns;
    }

    /**
     * 按周期分段
     */
    segmentByPeriod(sequence, period) {
        const segments = [];
        for (let i = 0; i < sequence.length; i += period) {
            segments.push(sequence.slice(i, i + period));
        }
        return segments;
    }

    /**
     * 查找重复模式
     */
    findRepeatingPattern(segments, period) {
        if (segments.length < 3) return null;

        // 简化版：检测段内平均值的波动
        const avgValues = segments.map(seg => {
            const sum = seg.reduce((a, b) => a + b, 0);
            return sum / seg.length;
        });

        // 计算波动幅度
        const max = Math.max(...avgValues);
        const min = Math.min(...avgValues);
        const range = max - min;

        // 如果波动幅度足够大，认为存在周期性
        if (range > 10) {
            return {
                period: period,
                range: [Math.round(min), Math.round(max)],
                confidence: 0.7,
                accuracy: 0.65,
                frequency: 1 / period,
                description: `在${Math.round(min)}-${Math.round(max)}之间波动`,
                occurrenceCount: segments.length
            };
        }

        return null;
    }

    /**
     * 检测区间分布
     */
    detectRangePatterns(values, ranges) {
        const patterns = [];
        const total = values.length;

        for (const [min, max] of ranges) {
            const count = values.filter(v => v >= min && v <= max).length;
            const probability = count / total;

            if (count >= this.minSupport) {
                patterns.push({
                    min,
                    max,
                    count,
                    probability,
                    confidence: probability > 0.5 ? 0.8 : 0.7,
                    accuracy: probability
                });
            }
        }

        return patterns.sort((a, b) => b.probability - a.probability);
    }

    /**
     * 检测趋势模式
     */
    detectTrendPatterns(values) {
        const patterns = [];

        // 检测连续上升/下降
        let upCount = 0, downCount = 0;
        for (let i = 1; i < values.length; i++) {
            if (values[i] > values[i - 1]) upCount++;
            else if (values[i] < values[i - 1]) downCount++;
        }

        const upFreq = upCount / (values.length - 1);
        const downFreq = downCount / (values.length - 1);

        if (upFreq > 0.4) {
            patterns.push({
                name: '和值上升趋势',
                description: `和值呈上升趋势，${(upFreq * 100).toFixed(1)}%的期数递增`,
                threshold: 0.4,
                confidence: upFreq,
                accuracy: upFreq,
                frequency: upFreq,
                count: upCount,
                significance: upFreq > 0.5 ? 0.8 : 0.6
            });
        }

        return patterns;
    }

    /**
     * 计算分布
     */
    calculateDistribution(values) {
        const distribution = {};
        const total = values.length;

        values.forEach(v => {
            distribution[v] = (distribution[v] || 0) + 1;
        });

        // 转换为频率
        Object.keys(distribution).forEach(key => {
            distribution[key] = distribution[key] / total;
        });

        return distribution;
    }

    /**
     * 检测热温冷周期
     */
    detectHTCCycles(htcSequence) {
        const cycles = [];
        const periodsToTest = [5, 8, 10, 12];

        for (const period of periodsToTest) {
            // 检测温号主导周期
            let warmDominantCount = 0;
            for (let i = 0; i < htcSequence.length; i += period) {
                const segment = htcSequence.slice(i, i + period);
                const hasWarmDominant = segment.some(ratio => {
                    const [h, w, c] = ratio.split(':').map(Number);
                    return w >= 3;  // 温号≥3
                });
                if (hasWarmDominant) warmDominantCount++;
            }

            const totalSegments = Math.floor(htcSequence.length / period);
            const frequency = warmDominantCount / totalSegments;

            if (frequency > 0.5 && warmDominantCount >= 3) {
                cycles.push({
                    period: period,
                    description: '温号主导',
                    dominantType: '温号',
                    dominantRatios: ['2:3:0', '1:3:1', '0:3:2'],
                    confidence: frequency,
                    accuracy: frequency,
                    frequency: frequency,
                    occurrenceCount: warmDominantCount
                });
            }
        }

        return cycles;
    }

    /**
     * 分析热温冷转换
     */
    analyzeHTCTransitions(htcSequence) {
        const transitions = {};

        for (let i = 0; i < htcSequence.length - 1; i++) {
            const from = htcSequence[i];
            const to = htcSequence[i + 1];
            const key = `${from}→${to}`;

            transitions[key] = (transitions[key] || 0) + 1;
        }

        // 计算条件概率
        const transitionProbabilities = [];
        const fromCounts = {};

        htcSequence.slice(0, -1).forEach(ratio => {
            fromCounts[ratio] = (fromCounts[ratio] || 0) + 1;
        });

        for (const [key, count] of Object.entries(transitions)) {
            const [from, to] = key.split('→');
            const probability = count / fromCounts[from];

            if (probability > 0.5 && count >= 3) {  // 只保留概率>50%且至少出现3次的转换
                transitionProbabilities.push({
                    from,
                    to,
                    count,
                    probability
                });
            }
        }

        return transitionProbabilities.sort((a, b) => b.probability - a.probability);
    }
}

module.exports = PatternDiscoveryEngine;
