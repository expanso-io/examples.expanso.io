import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const BIN_DIR = path.join(process.cwd(), '.bin');

// 1. Construct the enhanced PATH
const env = { 
    ...process.env, 
    PATH: `${BIN_DIR}:${process.env.PATH}` 
};

// 2. Parse Command
const args = process.argv.slice(2);
if (args.length === 0) {
    console.error("Usage: tsx scripts/run-with-expanso.ts <command> [args...]");
    process.exit(1);
}
const command = args[0];
const commandArgs = args.slice(1);

// 3. Log Environment Context
console.log('--------------------------------------------------');
console.log('🚀 Expanso Test Runner');
console.log(`   Command: ${command} ${commandArgs.join(' ')}`);
console.log(`   Binaries: ${BIN_DIR}`);

// 4. Verify Versions (if binaries exist)
['expanso-cli', 'expanso-edge'].forEach(tool => {
    const toolPath = path.join(BIN_DIR, tool);
    if (fs.existsSync(toolPath)) {
        try {
             // We use spawnSync here to safely capture output without streaming to main stdout immediately
             const { spawnSync } = require('child_process');
             const res = spawnSync(toolPath, ['version']);
             if (res.stdout) {
                 console.log(`   ${tool}: ${res.stdout.toString().trim()}`);
             }
        } catch (e) {}
    } else {
        console.log(`   ${tool}: (not found in local bin, using system default if available)`);
    }
});
console.log('--------------------------------------------------');

// 5. Execute
const child = spawn(command, commandArgs, { 
    env, 
    stdio: 'inherit',
    shell: true 
});

child.on('exit', (code) => {
    process.exit(code ?? 0);
});
