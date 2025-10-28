/**
 * Check actual WiredTiger configuration from MongoDB
 */

const mongoose = require('mongoose');

async function checkWiredTigerConfig() {
    try {
        console.log('\n====================================');
        console.log('WiredTiger Configuration Check');
        console.log('====================================\n');

        // Connect to MongoDB
        await mongoose.connect('mongodb://127.0.0.1:27017/lottery', {
            serverSelectionTimeoutMS: 5000
        });

        console.log('✅ Connected to MongoDB\n');

        const adminDb = mongoose.connection.db.admin();

        // Get server status
        const serverStatus = await adminDb.serverStatus();

        if (serverStatus.wiredTiger) {
            console.log('📊 WiredTiger Configuration:');
            console.log('====================================\n');

            // Cache configuration
            const cache = serverStatus.wiredTiger.cache;
            const maxBytes = cache['maximum bytes configured'];
            const currentBytes = cache['bytes currently in the cache'];
            const dirtyBytes = cache['tracked dirty bytes in the cache'];

            console.log('Cache Settings:');
            console.log(`  Maximum configured: ${(maxBytes / 1024 / 1024).toFixed(2)} MB (${(maxBytes / 1024 / 1024 / 1024).toFixed(2)} GB)`);
            console.log(`  Currently used: ${(currentBytes / 1024 / 1024).toFixed(2)} MB`);
            console.log(`  Dirty bytes: ${(dirtyBytes / 1024 / 1024).toFixed(2)} MB`);
            console.log('');

            // Get command line options
            const cmdLineOpts = await adminDb.command({ getCmdLineOpts: 1 });

            console.log('Command Line Configuration:');
            console.log('====================================\n');

            if (cmdLineOpts.parsed && cmdLineOpts.parsed.storage) {
                console.log('Storage config:');
                console.log(JSON.stringify(cmdLineOpts.parsed.storage, null, 2));
            } else {
                console.log('⚠️  No storage configuration found in parsed options');
            }

            console.log('');
            console.log('Config file:');
            console.log(`  ${cmdLineOpts.parsed.config || 'Not specified'}`);

        } else {
            console.log('❌ WiredTiger information not available');
        }

        console.log('\n====================================');
        console.log('Check Complete');
        console.log('====================================\n');

        await mongoose.disconnect();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkWiredTigerConfig();
