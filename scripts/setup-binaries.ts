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
  console.log(`
⬇️  Installing expanso-edge using official script...`);
  try {
    // The install script respects EXPANSO_INSTALL_DIR
    execSync('curl -fsSL https://get.expanso.io/edge/install.sh | EXPANSO_INSTALL_DIR=' + BIN_DIR + ' bash', { stdio: ['ignore', 'inherit', 'inherit'] });
    const edgePath = path.join(BIN_DIR, 'expanso-edge');
    if (fs.existsSync(edgePath)) {
      fs.chmodSync(edgePath, '755'); // Ensure executable
      const version = execSync(`${edgePath} version`).toString().trim();
      console.log(`✅ Installed expanso-edge (${version}) to ${edgePath}`);
    } else {
      throw new Error('expanso-edge binary not found after running install script.');
    }
  } catch (e: any) {
    console.error(`❌ Failed to install expanso-edge:`);
    console.error(`   ${e.message}`);
    console.log(`   Falling back to system expanso-edge (if available).`);
  }

  // --- Install Expanso CLI ---
  console.log(`
⬇️  Installing expanso-cli using official script...`);
  try {
    // The install script respects EXPANSO_INSTALL_DIR
    execSync('curl -fsSL https://get.expanso.io/cli/install.sh | EXPANSO_INSTALL_DIR=' + BIN_DIR + ' bash', { stdio: ['ignore', 'inherit', 'inherit'] });
    const cliPath = path.join(BIN_DIR, 'expanso-cli'); // The CLI binary is named 'expanso-cli' by the installer
    if (fs.existsSync(cliPath)) {
      fs.chmodSync(cliPath, '755'); // Ensure executable
      const version = execSync(`${cliPath} version`).toString().trim();
      console.log(`✅ Installed expanso-cli (${version}) to ${cliPath}`);

      // Create a dummy profile for local testing
      console.log(`
⚙️  Configuring 'local' profile for expanso-cli...`);
      execSync(`npm run run-with-expanso -- expanso-cli profile save local --endpoint http://localhost:8080 --auth-token test-token --select`, { stdio: 'inherit' });
      console.log(`✅ 'local' profile configured.`);

    } else {
      throw new Error('expanso-cli binary not found after running install script.');
    }
  } catch (e: any) {
    console.error(`❌ Failed to install expanso-cli:`);
    console.error(`   ${e.message}`);
    console.log(`   Falling back to system expanso-cli (if available).`);
  }
}

setup();