/**
 * HIT-大乐透-规律评分系统
 * 对发现的规律进行多维度评分和等级评定
 */

/**
 * 规律评分系统类
 */
class PatternScoringSystem {
    constructor(config = {}) {
        // 评分权重配置
        this.weights = config.weights || {
            accuracy: 0.35,      // 准确率权重
            stability: 0.25,     // 稳定性权重
            recency: 0.15,       // 时效性权重
            support: 0.15,       // 支持度权重
            trend: 0.10          // 趋势权重
        };
    }

    /**
     * 计算规律综合得分
     */
    scorePattern(pattern, historicalValidation) {
        const scores = {
            accuracyScore: this.scoreAccuracy(pattern.statistics.accuracy),
            stabilityScore: this.scoreStability(historicalValidation.variance),
            recencyScore: this.scoreRecency(pattern.statistics.lastOccurrence),
            supportScore: this.scoreSupport(pattern.statistics.support),
            trendScore: this.scoreTrend(pattern.trend)
        };

        // 计算加权总分
        const totalScore = Object.keys(scores).reduce((sum, key) => {
            const weight = this.weights[key.replace('Score', '')];
            return sum + scores[key] * weight;
        }, 0);

        // 评定等级
        const grade = this.getGrade(totalScore);

        return {
            totalScore: Math.round(totalScore * 100) / 100,
            grade: grade,
            breakdown: scores
        };
    }

    /**
     * 准确率评分 (0-100)
     */
    scoreAccuracy(accuracy) {
        // 准确率直接映射到0-100分
        // accuracy是0-1之间的值
        if (accuracy >= 0.9) return 100;
        if (accuracy >= 0.8) return 95;
        if (accuracy >= 0.7) return 85;
        if (accuracy >= 0.6) return 75;
        if (accuracy >= 0.5) return 60;
        return accuracy * 100;
    }

    /**
     * 稳定性评分 (0-100)
     */
    scoreStability(variance) {
        // variance越小，稳定性越高
        // 假设variance范围在0-1之间
        if (variance === undefined || variance === null) {
            return 70;  // 默认中等稳定性
        }

        if (variance <= 0.05) return 100;  // 极度稳定
        if (variance <= 0.1) return 90;
        if (variance <= 0.15) return 80;
        if (variance <= 0.2) return 70;
        if (variance <= 0.3) return 60;
        return Math.max(50, 100 - variance * 200);
    }

    /**
     * 时效性评分 (0-100)
     */
    scoreRecency(lastOccurrence) {
        if (!lastOccurrence) return 50;

        // 假设lastOccurrence是期号字符串，如"25087"
        const currentIssue = 25090;  // 这个值应该动态获取最新期号
        const lastIssueNum = parseInt(lastOccurrence);

        const gap = currentIssue - lastIssueNum;

        // 最近出现的规律得分更高
        if (gap <= 1) return 100;      // 上一期或当前期
        if (gap <= 5) return 90;       // 5期内
        if (gap <= 10) return 80;      // 10期内
        if (gap <= 20) return 70;      // 20期内
        if (gap <= 30) return 60;      // 30期内
        return Math.max(40, 100 - gap);
    }

    /**
     * 支持度评分 (0-100)
     */
    scoreSupport(support) {
        // support是样本数量
        if (support >= 100) return 100;
        if (support >= 50) return 90;
        if (support >= 30) return 80;
        if (support >= 20) return 70;
        if (support >= 10) return 60;
        return Math.max(40, support * 4);
    }

    /**
     * 趋势评分 (0-100)
     */
    scoreTrend(trend) {
        if (!trend || !trend.status) return 70;  // 默认中等分数

        switch (trend.status) {
            case 'strengthening':
                return 95;  // 增强中的规律高分
            case 'active':
                return 85;  // 活跃规律
            case 'weakening':
                return 60;  // 减弱中的规律
            case 'archived':
                return 40;  // 已归档
            case 'invalid':
                return 20;  // 已失效
            default:
                return 70;
        }
    }

    /**
     * 根据总分评定等级
     */
    getGrade(totalScore) {
        if (totalScore >= 90) return 'S';  // 优秀
        if (totalScore >= 80) return 'A';  // 良好
        if (totalScore >= 70) return 'B';  // 中等
        if (totalScore >= 60) return 'C';  // 及格
        return 'D';  // 差
    }

    /**
     * 批量评分规律
     */
    async scorePatterns(patterns, historicalData) {
        const scoredPatterns = [];

        for (const pattern of patterns) {
            // 为每个规律进行历史验证
            const validation = await this.validatePattern(pattern, historicalData);

            // 计算得分
            const score = this.scorePattern(pattern, validation);

            scoredPatterns.push({
                ...pattern,
                score: score,
                validation: validation
            });
        }

        // 按总分降序排序
        return scoredPatterns.sort((a, b) => b.score.totalScore - a.score.totalScore);
    }

    /**
     * 验证规律（回测）
     */
    async validatePattern(pattern, historicalData) {
        // 使用最近50期数据进行验证
        const testData = historicalData.slice(-50);
        let hitCount = 0;
        let missCount = 0;
        const accuracies = [];

        for (const data of testData) {
            const hit = this.checkPatternHit(pattern, data);
            if (hit) {
                hitCount++;
                accuracies.push(1);
            } else {
                missCount++;
                accuracies.push(0);
            }
        }

        // 计算方差（稳定性指标）
        const avgAccuracy = hitCount / testData.length;
        const variance = accuracies.reduce((sum, acc) => {
            return sum + Math.pow(acc - avgAccuracy, 2);
        }, 0) / testData.length;

        return {
            hitCount,
            missCount,
            accuracy: avgAccuracy,
            variance: variance,
            testPeriods: testData.length
        };
    }

    /**
     * 检查规律是否命中
     */
    checkPatternHit(pattern, data) {
        switch (pattern.type) {
            case 'sum_pattern':
                return this.checkSumPattern(pattern, data);
            case 'span_pattern':
                return this.checkSpanPattern(pattern, data);
            case 'zone_ratio_pattern':
                return this.checkZoneRatioPattern(pattern, data);
            case 'odd_even_pattern':
                return this.checkOddEvenPattern(pattern, data);
            case 'htc_ratio_pattern':
                return this.checkHTCPattern(pattern, data);
            default:
                return false;
        }
    }

    /**
     * 检查和值规律是否命中
     */
    checkSumPattern(pattern, data) {
        const sum = data.Red1 + data.Red2 + data.Red3 + data.Red4 + data.Red5;

        if (pattern.parameters.range) {
            const [min, max] = pattern.parameters.range;
            return sum >= min && sum <= max;
        }

        return false;
    }

    /**
     * 检查跨度规律是否命中
     */
    checkSpanPattern(pattern, data) {
        const reds = [data.Red1, data.Red2, data.Red3, data.Red4, data.Red5];
        const span = Math.max(...reds) - Math.min(...reds);

        if (pattern.parameters.range) {
            const [min, max] = pattern.parameters.range;
            return span >= min && span <= max;
        }

        return false;
    }

    /**
     * 检查区间比规律是否命中
     */
    checkZoneRatioPattern(pattern, data) {
        const reds = [data.Red1, data.Red2, data.Red3, data.Red4, data.Red5];
        const zone1 = reds.filter(n => n >= 1 && n <= 12).length;
        const zone2 = reds.filter(n => n >= 13 && n <= 24).length;
        const zone3 = reds.filter(n => n >= 25 && n <= 35).length;
        const actualRatio = `${zone1}:${zone2}:${zone3}`;

        if (pattern.parameters.keyValues) {
            return pattern.parameters.keyValues.includes(actualRatio);
        }

        return false;
    }

    /**
     * 检查奇偶比规律是否命中
     */
    checkOddEvenPattern(pattern, data) {
        const reds = [data.Red1, data.Red2, data.Red3, data.Red4, data.Red5];
        const oddCount = reds.filter(n => n % 2 === 1).length;
        const actualRatio = `${oddCount}:${5 - oddCount}`;

        if (pattern.parameters.keyValues) {
            return pattern.parameters.keyValues.includes(actualRatio);
        }

        return false;
    }

    /**
     * 检查热温冷比规律是否命中
     */
    checkHTCPattern(pattern, data) {
        // 需要额外的遗漏数据才能判断热温冷比
        // 这里简化处理，假设data中已包含htcRatio字段
        if (data.htcRatio && pattern.parameters.keyValues) {
            return pattern.parameters.keyValues.includes(data.htcRatio);
        }

        return false;
    }

    /**
     * 计算规律置信度
     */
    calculateConfidence(pattern, validation) {
        // 综合考虑准确率、支持度和稳定性
        const accuracyFactor = validation.accuracy;
        const supportFactor = Math.min(1, pattern.statistics.support / 50);
        const stabilityFactor = 1 - Math.min(1, validation.variance);

        return (accuracyFactor * 0.5 + supportFactor * 0.3 + stabilityFactor * 0.2);
    }

    /**
     * 更新规律趋势
     */
    async updatePatternTrend(pattern, recentValidation) {
        const currentAccuracy = pattern.statistics.accuracy;
        const recentAccuracy = recentValidation.accuracy;

        // 计算趋势斜率
        const slope = recentAccuracy - currentAccuracy;

        let trendStatus, trendDirection;

        if (slope > 0.05) {
            trendStatus = 'strengthening';
            trendDirection = 'up';
        } else if (slope < -0.05) {
            trendStatus = 'weakening';
            trendDirection = 'down';
        } else {
            trendStatus = 'active';
            trendDirection = 'stable';
        }

        // 如果准确率低于50%，标记为无效
        if (recentAccuracy < 0.5) {
            trendStatus = 'invalid';
        }

        return {
            status: trendStatus,
            recentAccuracy: recentAccuracy,
            trendDirection: trendDirection,
            slope: slope
        };
    }
}

module.exports = PatternScoringSystem;
