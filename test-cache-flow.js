// 精确测试：模拟任务执行时 cachedRedCombinations 的状态

const mongoose = require('mongoose');

// 模拟 globalCacheManager 的行为
class MockGlobalCacheManager {
  constructor() {
    this.redCombinationsCache = null;
    this.cacheTimestamp = null;
  }

  isCacheValid() {
    if (!this.cacheTimestamp || !this.redCombinationsCache) {
      return false;
    }
    return true;
  }

  async ensureCacheReady() {
    if (this.isCacheValid()) {
      console.log('✅ 使用现有缓存');
      return;
    }
    console.log('🔨 开始构建缓存...');
    await this.buildCache();
  }

  async buildCache() {
    const db = mongoose.connection.db;
    const redCombos = await db.collection('hit_dlt_redcombinations').find({}).limit(100).toArray();
    this.redCombinationsCache = redCombos;
    this.cacheTimestamp = Date.now();
    console.log('✅ 缓存构建完成, redCombinationsCache.length =', this.redCombinationsCache.length);
  }

  getCachedData() {
    return {
      redCombinations: this.redCombinationsCache
    };
  }

  clearCache() {
    console.log('🧹 清理缓存...');
    this.redCombinationsCache = null;
    // 注意: cacheTimestamp 没有被清理!
  }
}

// 模拟 StreamBatchPredictor.preloadData
class MockStreamBatchPredictor {
  constructor() {
    this.cachedRedCombinations = null;
    this.sessionId = 'test-session';
  }

  async preloadData(mockGlobalCache) {
    try {
      console.log('\n📥 检查全局缓存状态...');
      await mockGlobalCache.ensureCacheReady();

      const cachedData = mockGlobalCache.getCachedData();
      console.log('📊 getCachedData().redCombinations:', cachedData.redCombinations?.length || 'null');

      this.cachedRedCombinations = cachedData.redCombinations;
      console.log('📊 this.cachedRedCombinations:', this.cachedRedCombinations?.length || 'null');

    } catch (error) {
      console.log('❌ 数据预加载失败:', error.message);
      this.cachedRedCombinations = null;
    }
  }
}

// 模拟 HwcPositivePredictor.processBatch
class MockHwcPositivePredictor extends MockStreamBatchPredictor {
  async processBatch(mockGlobalCache) {
    // 检查 cachedRedCombinations
    console.log('\n📦 processBatch 开始...');
    console.log('📊 检查前 this.cachedRedCombinations:', this.cachedRedCombinations?.length || 'null');

    if (!this.cachedRedCombinations || this.cachedRedCombinations.length === 0) {
      console.log('⚠️ cachedRedCombinations 为空，尝试从全局缓存获取...');
      const cachedData = mockGlobalCache.getCachedData();
      console.log('📊 globalCache.getCachedData().redCombinations:', cachedData.redCombinations?.length || 'null');

      if (cachedData.redCombinations && cachedData.redCombinations.length > 0) {
        this.cachedRedCombinations = cachedData.redCombinations;
        console.log('✅ cachedRedCombinations 重新加载成功:', this.cachedRedCombinations.length);
      } else {
        console.log('❌ 全局缓存中也没有红球组合数据');
      }
    }

    // 模拟 applyPositiveSelection
    console.log('\n🎯 applyPositiveSelection 开始...');
    console.log('📊 this.cachedRedCombinations:', this.cachedRedCombinations?.length || 'null');

    if (!this.cachedRedCombinations) {
      console.log('❌ cachedRedCombinations 是 null，调用 filter 会抛出 TypeError!');
      return { error: 'cachedRedCombinations is null' };
    }

    // 模拟 filter 操作
    const filteredCombos = this.cachedRedCombinations.filter(c => true);
    console.log('✅ filter 操作成功, filteredCombos.length =', filteredCombos.length);

    return { success: true, count: filteredCombos.length };
  }
}

// 测试场景
mongoose.connect('mongodb://127.0.0.1:27017/lottery').then(async () => {
  console.log('=== 测试场景 1: 正常流程 ===');
  const mockGlobalCache1 = new MockGlobalCacheManager();
  const predictor1 = new MockHwcPositivePredictor();

  await predictor1.preloadData(mockGlobalCache1);
  const result1 = await predictor1.processBatch(mockGlobalCache1);
  console.log('结果:', result1);

  console.log('\n\n=== 测试场景 2: 缓存被清理后 ===');
  const mockGlobalCache2 = new MockGlobalCacheManager();
  const predictor2 = new MockHwcPositivePredictor();

  // 先构建缓存
  await mockGlobalCache2.ensureCacheReady();
  console.log('缓存已构建');

  // 清理缓存（模拟上一个任务完成后的清理）
  mockGlobalCache2.clearCache();
  console.log('缓存已清理');

  // 现在预加载
  await predictor2.preloadData(mockGlobalCache2);
  const result2 = await predictor2.processBatch(mockGlobalCache2);
  console.log('结果:', result2);

  console.log('\n\n=== 测试场景 3: preloadData 失败时 ===');
  const mockGlobalCache3 = new MockGlobalCacheManager();
  const predictor3 = new MockHwcPositivePredictor();

  // 模拟 preloadData 失败
  console.log('\n📥 模拟 preloadData 失败...');
  predictor3.cachedRedCombinations = null;
  console.log('📊 preloadData 失败后 this.cachedRedCombinations:', predictor3.cachedRedCombinations);

  // processBatch 应该尝试重新加载
  const result3 = await predictor3.processBatch(mockGlobalCache3);
  console.log('结果:', result3);

  mongoose.disconnect();
});
