import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const BIN_DIR = path.join(process.cwd(), '.bin');
const INSTALL_TIMEOUT_MS = 240_000;
const CURL_FLAGS =
  '--connect-timeout 15 --max-time 180 --retry 3 --retry-delay 2';

function setup() {
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }

  console.log(`🏗️  Setting up Expanso binaries in ${BIN_DIR}...`);

  // --- Install Expanso Edge ---
  console.log(`\n⬇️  Installing expanso-edge using official script...`);
  try {
    const edgePath = path.join(BIN_DIR, 'expanso-edge');
    if (fs.existsSync(edgePath)) {
      console.log(`↪️  Reusing existing ${edgePath}`);
    } else {
      // Set EXPANSO_INSTALL_DIR via env, not inline — ensures bash subprocess inherits it
      execSync(
        `curl -fsSL ${CURL_FLAGS} https://get.expanso.io/edge/install.sh | bash`,
        {
          stdio: ['ignore', 'inherit', 'inherit'],
          env: {
            ...process.env,
            EXPANSO_INSTALL_DIR: BIN_DIR,
            USE_SUDO: 'false',
          },
          timeout: INSTALL_TIMEOUT_MS,
        }
      );
      if (!fs.existsSync(edgePath)) {
        throw new Error(
          'expanso-edge binary not found after running install script.'
        );
      }
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
    const cliPath = path.join(BIN_DIR, 'expanso-cli');
    if (fs.existsSync(cliPath)) {
      console.log(`↪️  Reusing existing ${cliPath}`);
    } else {
      // Set EXPANSO_INSTALL_DIR via env, not inline — ensures bash subprocess inherits it
      execSync(
        `curl -fsSL ${CURL_FLAGS} https://get.expanso.io/cli/install.sh | bash`,
        {
          stdio: ['ignore', 'inherit', 'inherit'],
          env: {
            ...process.env,
            EXPANSO_INSTALL_DIR: BIN_DIR,
            USE_SUDO: 'false',
          },
          timeout: INSTALL_TIMEOUT_MS,
        }
      );
      if (!fs.existsSync(cliPath)) {
        throw new Error(
          'expanso-cli binary not found after running install script.'
        );
      }
    }
    fs.chmodSync(cliPath, '755');
    const version = execSync(`${cliPath} version`).toString().trim();
    console.log(`✅ Installed expanso-cli (${version}) to ${cliPath}`);
  } catch (e: any) {
    console.error(`❌ Failed to install expanso-cli: ${e.message}`);
    process.exit(1);
  }
}

setup();
