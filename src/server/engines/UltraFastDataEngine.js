/**
 * UltraFastDataEngine - v3.0超高速数据引擎
 *
 * 核心特性:
 * - TypedArray紧凑存储 (20 bytes/组合)
 * - 全内存数据加载
 * - 零数据库查询
 * - O(1)组合访问
 *
 * 性能目标:
 * - 内存占用: 6.5MB (vs 原65MB)
 * - 加载时间: <1秒 (vs 原8-15秒)
 * - 查询速度: O(1) (vs 原O(N))
 */

class UltraFastDataEngine {
    constructor() {
        // 红球组合数据池 (324,632个组合)
        this.redComboPool = {
            data: null,           // Uint8Array: 紧凑存储
            count: 0,             // 组合总数
            bytePerCombo: 20,     // 每个组合20字节
            indexMap: null        // Map<combination_id, offset>
        };

        // 蓝球组合数据池 (66个组合)
        this.blueComboPool = {
            data: null,
            count: 0,
            bytePerCombo: 4       // 每个组合4字节
        };

        // 元数据
        this.isLoaded = false;
        this.loadTime = null;
    }

    /**
     * 🚀 加载所有组合数据到内存
     * @param {Array} redCombinations - 红球组合数组
     * @param {Array} blueCombinations - 蓝球组合数组
     */
    async loadFromDatabase(redCombinations, blueCombinations) {
        const startTime = Date.now();
        console.log(`🔧 [UltraFastDataEngine] 开始加载数据...`);

        // 加载红球组合
        this.loadRedCombinations(redCombinations);

        // 加载蓝球组合
        this.loadBlueCombinations(blueCombinations);

        this.isLoaded = true;
        this.loadTime = Date.now() - startTime;

        console.log(`✅ [UltraFastDataEngine] 数据加载完成:`);
        console.log(`   - 红球组合: ${this.redComboPool.count}个 (${(this.redComboPool.data.byteLength / 1024 / 1024).toFixed(2)}MB)`);
        console.log(`   - 蓝球组合: ${this.blueComboPool.count}个 (${(this.blueComboPool.data.byteLength / 1024).toFixed(2)}KB)`);
        console.log(`   - 加载耗时: ${this.loadTime}ms`);
    }

    /**
     * 🔴 加载红球组合到TypedArray
     *
     * 数据布局 (每个组合20字节):
     * [0-3]   combination_id (Uint32)
     * [4]     ball_1 (Uint8)
     * [5]     ball_2 (Uint8)
     * [6]     ball_3 (Uint8)
     * [7]     ball_4 (Uint8)
     * [8]     ball_5 (Uint8)
     * [9]     sum_value (Uint8)
     * [10]    span_value (Uint8)
     * [11]    odd_even_ratio_key (Uint8) // 编码: 0:5→0, 1:4→1, 2:3→2, 3:2→3, 4:1→4, 5:0→5
     * [12]    ac_value (Uint8)
     * [13-15] zone_ratio_encoded (3 bytes) // zone1, zone2, zone3
     * [16-19] 保留字段
     */
    loadRedCombinations(combinations) {
        const count = combinations.length;
        const bytePerCombo = this.redComboPool.bytePerCombo;
        const totalBytes = count * bytePerCombo;

        // 分配内存
        this.redComboPool.data = new Uint8Array(totalBytes);
        this.redComboPool.count = count;
        this.redComboPool.indexMap = new Map();

        const dataView = new DataView(this.redComboPool.data.buffer);

        for (let i = 0; i < count; i++) {
            const combo = combinations[i];
            const offset = i * bytePerCombo;

            // 保存索引映射
            this.redComboPool.indexMap.set(combo.combination_id, offset);

            // [0-3] combination_id
            dataView.setUint32(offset, combo.combination_id, true);

            // [4-8] 球号
            this.redComboPool.data[offset + 4] = combo.red_ball_1;
            this.redComboPool.data[offset + 5] = combo.red_ball_2;
            this.redComboPool.data[offset + 6] = combo.red_ball_3;
            this.redComboPool.data[offset + 7] = combo.red_ball_4;
            this.redComboPool.data[offset + 8] = combo.red_ball_5;

            // [9] sum_value
            this.redComboPool.data[offset + 9] = combo.sum_value || 0;

            // [10] span_value
            this.redComboPool.data[offset + 10] = combo.span_value || 0;

            // [11] odd_even_ratio (编码)
            const oddEvenKey = this.encodeOddEvenRatio(combo.odd_even_ratio);
            this.redComboPool.data[offset + 11] = oddEvenKey;

            // [12] ac_value
            this.redComboPool.data[offset + 12] = combo.ac_value || 0;

            // [13-15] zone_ratio
            const [z1, z2, z3] = this.parseZoneRatio(combo.zone_ratio);
            this.redComboPool.data[offset + 13] = z1;
            this.redComboPool.data[offset + 14] = z2;
            this.redComboPool.data[offset + 15] = z3;
        }
    }

    /**
     * 🔵 加载蓝球组合到TypedArray
     *
     * 数据布局 (每个组合4字节):
     * [0-1] combination_id (Uint16)
     * [2]   ball_1 (Uint8)
     * [3]   ball_2 (Uint8)
     */
    loadBlueCombinations(combinations) {
        const count = combinations.length;
        const bytePerCombo = this.blueComboPool.bytePerCombo;

        this.blueComboPool.data = new Uint8Array(count * bytePerCombo);
        this.blueComboPool.count = count;

        const dataView = new DataView(this.blueComboPool.data.buffer);

        for (let i = 0; i < count; i++) {
            const combo = combinations[i];
            const offset = i * bytePerCombo;

            // [0-1] combination_id
            dataView.setUint16(offset, combo.combination_id, true);

            // [2-3] 球号
            this.blueComboPool.data[offset + 2] = combo.blue_ball_1;
            this.blueComboPool.data[offset + 3] = combo.blue_ball_2;
        }
    }

    /**
     * 🎯 获取红球组合 (O(1)查询)
     * @param {number} combinationId - 组合ID
     * @returns {Object|null} 组合对象
     */
    getRedCombination(combinationId) {
        const offset = this.redComboPool.indexMap.get(combinationId);
        if (offset === undefined) return null;

        const dataView = new DataView(this.redComboPool.data.buffer);

        return {
            combination_id: dataView.getUint32(offset, true),
            red_ball_1: this.redComboPool.data[offset + 4],
            red_ball_2: this.redComboPool.data[offset + 5],
            red_ball_3: this.redComboPool.data[offset + 6],
            red_ball_4: this.redComboPool.data[offset + 7],
            red_ball_5: this.redComboPool.data[offset + 8],
            sum_value: this.redComboPool.data[offset + 9],
            span_value: this.redComboPool.data[offset + 10],
            odd_even_ratio: this.decodeOddEvenRatio(this.redComboPool.data[offset + 11]),
            ac_value: this.redComboPool.data[offset + 12],
            zone_ratio: `${this.redComboPool.data[offset + 13]}:${this.redComboPool.data[offset + 14]}:${this.redComboPool.data[offset + 15]}`
        };
    }

    /**
     * 🎯 批量获取红球组合
     * @param {Array<number>} ids - 组合ID数组
     * @returns {Array<Object>} 组合对象数组
     */
    getRedCombinations(ids) {
        return ids.map(id => this.getRedCombination(id)).filter(c => c !== null);
    }

    // ===== 辅助方法 =====

    encodeOddEvenRatio(ratio) {
        if (!ratio) return 0;
        const match = ratio.match(/(\d):(\d)/);
        if (!match) return 0;
        const odd = parseInt(match[1]);
        return odd; // 0:5→0, 1:4→1, 2:3→2, 3:2→3, 4:1→4, 5:0→5
    }

    decodeOddEvenRatio(encoded) {
        const odd = encoded;
        const even = 5 - odd;
        return `${odd}:${even}`;
    }

    parseZoneRatio(ratio) {
        if (!ratio) return [0, 0, 0];
        const match = ratio.match(/(\d):(\d):(\d)/);
        if (!match) return [0, 0, 0];
        return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    }

    /**
     * 📊 获取统计信息
     */
    getStats() {
        return {
            isLoaded: this.isLoaded,
            loadTime: this.loadTime,
            redCombinations: {
                count: this.redComboPool.count,
                memoryBytes: this.redComboPool.data?.byteLength || 0,
                memoryMB: (this.redComboPool.data?.byteLength || 0) / 1024 / 1024
            },
            blueCombinations: {
                count: this.blueComboPool.count,
                memoryBytes: this.blueComboPool.data?.byteLength || 0,
                memoryKB: (this.blueComboPool.data?.byteLength || 0) / 1024
            }
        };
    }
}

module.exports = UltraFastDataEngine;
