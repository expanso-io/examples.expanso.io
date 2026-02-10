import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const BIN_DIR = path.join(process.cwd(), '.bin');

function setup() {
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }

  console.log(`🏗️  Setting up Expanso binaries in ${BIN_DIR}...`);

  // --- Install Expanso Edge ---
  console.log(`\n⬇️  Installing expanso-edge using official script...`);
  try {
    // Set EXPANSO_INSTALL_DIR via env, not inline — ensures bash subprocess inherits it
    execSync('curl -fsSL https://get.expanso.io/edge/install.sh | bash', {
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, EXPANSO_INSTALL_DIR: BIN_DIR, USE_SUDO: 'false' },
    });
    const edgePath = path.join(BIN_DIR, 'expanso-edge');
    if (!fs.existsSync(edgePath)) {
      throw new Error('expanso-edge binary not found after running install script.');
    }
    fs.chmodSync(edgePath, '755');
    const version = execSync(`${edgePath} version`).toString().trim();
    console.log(`✅ Installed expanso-edge (${version}) to ${edgePath}`);
  } catch (e: any) {
    console.error(`❌ Failed to install expanso-edge: ${e.message}`);
    process.exit(1);
  }

  // --- Install Expanso CLI ---
  console.log(`\n⬇️  Installing expanso-cli using official script...`);
  try {
    // Set EXPANSO_INSTALL_DIR via env, not inline — ensures bash subprocess inherits it
    execSync('curl -fsSL https://get.expanso.io/cli/install.sh | bash', {
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, EXPANSO_INSTALL_DIR: BIN_DIR, USE_SUDO: 'false' },
    });
    const cliPath = path.join(BIN_DIR, 'expanso-cli');
    if (!fs.existsSync(cliPath)) {
      throw new Error('expanso-cli binary not found after running install script.');
    }
    fs.chmodSync(cliPath, '755');
    const version = execSync(`${cliPath} version`).toString().trim();
    console.log(`✅ Installed expanso-cli (${version}) to ${cliPath}`);

    // Create a dummy profile for local testing
    console.log(`\n⚙️  Configuring 'local' profile for expanso-cli...`);
    execSync(`npm run run-with-expanso -- expanso-cli profile save local --endpoint http://localhost:8080 --auth-token test-token --select`, { stdio: 'inherit' });
    console.log(`✅ 'local' profile configured.`);
  } catch (e: any) {
    console.error(`❌ Failed to install expanso-cli: ${e.message}`);
    process.exit(1);
  }
}

setup();