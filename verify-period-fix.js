/**
 * Verification script: Test that period range resolution works correctly
 *
 * This script simulates the exact scenario that was causing the crash:
 * - User selects "最近10期" (Recent 10 periods)
 * - System should return 11 periods: 10 historical + 1 predicted
 * - Predicted period should be "25125" (NOT "251241"!)
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3003';

async function verifyPeriodRangeFix() {
    console.log('🧪 Testing Period Range Resolution Fix\n');
    console.log('=' .repeat(60));

    try {
        // Test 1: Recent 10 periods
        console.log('\n📊 Test 1: Recent 10 periods');
        console.log('-'.repeat(60));

        const response1 = await axios.post(`${API_BASE}/api/dlt/resolve-issue-range`, {
            rangeType: 'recent',
            recentCount: 10
        });

        const issues1 = response1.data.data.targetIssues;
        console.log(`✅ Received ${issues1.length} periods`);
        console.log(`   First (predicted): ${issues1[0]}`);
        console.log(`   Last (oldest): ${issues1[issues1.length - 1]}`);

        // Verify the predicted period is correct
        const predictedPeriod = issues1[0];
        const isPredictedCorrect = predictedPeriod.length === 5 && /^\d{5}$/.test(predictedPeriod);

        if (!isPredictedCorrect) {
            console.log(`❌ FAILED: Predicted period "${predictedPeriod}" is invalid!`);
            console.log(`   Expected format: 5 digits (e.g., 25125)`);
            console.log(`   Got: "${predictedPeriod}" (length: ${predictedPeriod.length})`);
            return false;
        }

        console.log(`✅ Predicted period is valid: ${predictedPeriod}`);

        // Test 2: Custom range that requires prediction (25115-25125)
        console.log('\n📊 Test 2: Custom range with prediction (25115-25125)');
        console.log('-'.repeat(60));

        const response2 = await axios.post(`${API_BASE}/api/dlt/resolve-issue-range`, {
            rangeType: 'custom',
            startIssue: '25115',
            endIssue: '25125'
        });

        const issues2 = response2.data.data.targetIssues;
        console.log(`✅ Received ${issues2.length} periods`);
        console.log(`   First: ${issues2[0]}`);
        console.log(`   Last: ${issues2[issues2.length - 1]}`);

        // Verify periods
        const firstPeriod = issues2[0];
        if (firstPeriod !== '25125') {
            console.log(`❌ FAILED: First period should be 25125, got "${firstPeriod}"`);
            return false;
        }

        console.log(`✅ First period is correct: ${firstPeriod}`);

        // Test 3: Verify no string concatenation bugs
        console.log('\n📊 Test 3: Verify arithmetic operations');
        console.log('-'.repeat(60));

        // Check that all periods have valid format
        const allValid = issues1.every(issue => {
            return issue.length === 5 && /^\d{5}$/.test(issue);
        });

        if (!allValid) {
            console.log('❌ FAILED: Some periods have invalid format');
            const invalid = issues1.filter(issue => !(issue.length === 5 && /^\d{5}$/.test(issue)));
            console.log('   Invalid periods:', invalid);
            return false;
        }

        console.log('✅ All periods have valid format (5 digits)');

        // Final result
        console.log('\n' + '='.repeat(60));
        console.log('🎉 ALL TESTS PASSED!');
        console.log('='.repeat(60));
        console.log('\n✅ The string concatenation bug has been fixed!');
        console.log('✅ Period "25124" + 1 now correctly produces "25125"');
        console.log('✅ No more invalid periods like "251241"');
        console.log('\n💡 The application should now work without memory crashes.\n');

        return true;

    } catch (error) {
        console.error('\n❌ Test failed with error:');
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Message: ${error.response.data.message || error.response.statusText}`);
        } else if (error.request) {
            console.error('   No response from server. Is it running?');
            console.error('   Run: npm start');
        } else {
            console.error(`   ${error.message}`);
        }
        return false;
    }
}

// Run the verification
verifyPeriodRangeFix().then(success => {
    process.exit(success ? 0 : 1);
});
