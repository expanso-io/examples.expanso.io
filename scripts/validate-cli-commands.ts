#!/usr/bin/env tsx
/**
 * CLI Command Validator
 *
 * Downloads real expanso-cli and expanso-edge binaries and validates that
 * all CLI commands mentioned in documentation are real (not hallucinated).
 *
 * Usage:
 *   npm run validate-cli           # Validate docs against CLI
 *   npm run validate-cli -- --verbose          # Show detailed output
 *   npm run validate-cli -- --dump-commands    # Just show discovered commands
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// Configuration
const BIN_DIR = path.join(process.cwd(), '.bin');
const DOCS_DIR = path.join(process.cwd(), 'docs');

interface CommandTree {
  [key: string]: CommandTree | null;
}

interface ValidationResult {
  file: string;
  line: number;
  command: string;
  issue: string;
  context: string;
}

const VERBOSE = process.argv.includes('--verbose');
const DUMP_COMMANDS = process.argv.includes('--dump-commands');

function log(msg: string) {
  console.log(msg);
}

function debug(msg: string) {
  if (VERBOSE) {
    console.log(`  [debug] ${msg}`);
  }
}

/**
 * Run a command and capture output
 */
function runHelp(binary: string, args: string[] = []): string {
  const binaryPath = path.join(BIN_DIR, binary);

  if (!fs.existsSync(binaryPath)) {
    throw new Error(`Binary not found: ${binaryPath}`);
  }

  const result = spawnSync(binaryPath, [...args, '--help'], {
    encoding: 'utf-8',
    timeout: 5000,
  });

  return (result.stdout || '') + (result.stderr || '');
}

/**
 * Parse help output to extract subcommands
 */
function parseSubcommands(output: string): string[] {
  const subcommands: string[] = [];
  const lines = output.split('\n');
  let inCommandsSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect "Available Commands:" section
    if (/^Available Commands:$/i.test(trimmed)) {
      inCommandsSection = true;
      continue;
    }

    // Section ends at "Flags:" or empty line after commands
    if (inCommandsSection && (/^Flags:$/i.test(trimmed) || /^Global Flags:$/i.test(trimmed))) {
      break;
    }

    // Parse commands - they appear as "  command    description"
    if (inCommandsSection && trimmed) {
      const match = trimmed.match(/^(\w[\w-]*)\s+/);
      if (match) {
        subcommands.push(match[1]);
      }
    }
  }

  return subcommands;
}

/**
 * Build command tree for a binary (non-recursive, finite depth)
 */
function buildCommandTree(binary: string): CommandTree {
  const tree: CommandTree = {};

  // Get top-level commands
  const rootHelp = runHelp(binary);
  const topCommands = parseSubcommands(rootHelp);

  for (const cmd of topCommands) {
    // Skip 'help' and 'completion' to avoid noise
    if (cmd === 'help') {
      tree[cmd] = null;
      continue;
    }

    tree[cmd] = {};

    // Get subcommands for this command (one level deep)
    try {
      const cmdHelp = runHelp(binary, [cmd]);
      const subCommands = parseSubcommands(cmdHelp);

      for (const sub of subCommands) {
        if (sub === 'help') continue;
        (tree[cmd] as CommandTree)[sub] = null;
      }

      // If no subcommands, mark as leaf
      if (Object.keys(tree[cmd] as CommandTree).length === 0) {
        tree[cmd] = null;
      }
    } catch (e) {
      // Command might not support --help, mark as leaf
      tree[cmd] = null;
    }
  }

  return tree;
}

/**
 * Print command tree
 */
function printCommandTree(tree: CommandTree, prefix: string = ''): void {
  for (const [cmd, sub] of Object.entries(tree)) {
    console.log(`${prefix}${cmd}`);
    if (sub && typeof sub === 'object') {
      printCommandTree(sub, prefix + '  ');
    }
  }
}

/**
 * Get all valid command paths from tree
 */
function getValidPaths(tree: CommandTree, prefix: string = ''): string[] {
  const paths: string[] = [];

  for (const [cmd, sub] of Object.entries(tree)) {
    const currentPath = prefix ? `${prefix} ${cmd}` : cmd;
    paths.push(currentPath);

    if (sub && typeof sub === 'object') {
      paths.push(...getValidPaths(sub, currentPath));
    }
  }

  return paths;
}

/**
 * Check if a command path is valid
 */
function isValidCommand(commandParts: string[], tree: CommandTree): { valid: boolean; issue?: string } {
  let current: CommandTree | null = tree;

  for (let i = 0; i < commandParts.length; i++) {
    const part = commandParts[i];

    // Skip flags and values
    if (part.startsWith('-') || part.includes('/') || part.includes('.') ||
        part.includes('=') || part.startsWith('$') || part.startsWith('<') ||
        part.match(/^[A-Z_]+$/) || part.match(/^\d/)) {
      continue;
    }

    if (current === null) {
      // Previous command was a leaf, remaining parts are arguments
      return { valid: true };
    }

    if (part in current) {
      current = current[part];
    } else {
      // Check if it's an argument (not a known subcommand)
      const validSubs = Object.keys(current);
      if (validSubs.length === 0) {
        // No subcommands expected, this is an argument
        return { valid: true };
      }

      // Could be an argument, be lenient
      // Only flag as invalid if it looks like a command attempt
      if (part.match(/^[a-z][a-z-]*$/)) {
        return {
          valid: false,
          issue: `Unknown subcommand '${part}'. Valid: ${validSubs.join(', ')}`,
        };
      }

      // Treat as argument
      return { valid: true };
    }
  }

  return { valid: true };
}

/**
 * Extract CLI commands from a line
 */
function extractCommands(line: string): { binary: string; args: string }[] {
  const results: { binary: string; args: string }[] = [];

  // Match "expanso-cli ..." or "expanso-edge ..."
  const patterns = [
    /(?:^|\s)(expanso-cli)\s+([^\n#|&]+)/g,
    /(?:^|\s)(expanso-edge)\s+([^\n#|&]+)/g,
    /`(expanso-cli)\s+([^`]+)`/g,
    /`(expanso-edge)\s+([^`]+)`/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(line)) !== null) {
      results.push({
        binary: match[1],
        args: match[2].trim(),
      });
    }
  }

  return results;
}

/**
 * Validate a file
 */
function validateFile(
  filePath: string,
  cliTree: CommandTree,
  edgeTree: CommandTree
): ValidationResult[] {
  const results: ValidationResult[] = [];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const commands = extractCommands(line);

    for (const { binary, args } of commands) {
      const tree = binary === 'expanso-cli' ? cliTree : edgeTree;
      const parts = args.split(/\s+/).filter(p => p.length > 0);
      const validation = isValidCommand(parts, tree);

      if (!validation.valid) {
        results.push({
          file: filePath,
          line: lineNum + 1,
          command: `${binary} ${args}`,
          issue: validation.issue || 'Unknown issue',
          context: line.trim().substring(0, 100),
        });
      }
    }
  }

  return results;
}

/**
 * Save command reference JSON
 */
function saveReference(cliTree: CommandTree, edgeTree: CommandTree) {
  const reference = {
    generatedAt: new Date().toISOString(),
    binaries: {
      'expanso-cli': path.join(BIN_DIR, 'expanso-cli'),
      'expanso-edge': path.join(BIN_DIR, 'expanso-edge'),
    },
    'expanso-cli': {
      commands: getValidPaths(cliTree),
      tree: cliTree,
    },
    'expanso-edge': {
      commands: getValidPaths(edgeTree),
      tree: edgeTree,
    },
  };

  const refPath = path.join(BIN_DIR, 'command-reference.json');
  fs.writeFileSync(refPath, JSON.stringify(reference, null, 2));
  log(`\nSaved command reference to ${refPath}`);
}

/**
 * Main
 */
async function main() {
  console.log('========================================');
  console.log('  Expanso CLI Command Validator');
  console.log('========================================\n');

  // Check binaries exist
  const cliBinary = path.join(BIN_DIR, 'expanso-cli');
  const edgeBinary = path.join(BIN_DIR, 'expanso-edge');

  if (!fs.existsSync(cliBinary)) {
    console.error(`expanso-cli not found at ${cliBinary}`);
    console.error('Run: curl -fsSL https://get.expanso.io/cli/install.sh | bash');
    console.error('Then copy to .bin/expanso-cli');
    process.exit(1);
  }

  if (!fs.existsSync(edgeBinary)) {
    console.error(`expanso-edge not found at ${edgeBinary}`);
    console.error('Run: curl -fsSL https://get.expanso.io/edge/install.sh | bash');
    console.error('Then copy to .bin/expanso-edge');
    process.exit(1);
  }

  // Get versions
  const cliVersion = spawnSync(cliBinary, ['version'], { encoding: 'utf-8' });
  const edgeVersion = spawnSync(edgeBinary, ['version'], { encoding: 'utf-8' });
  log(`expanso-cli: ${cliVersion.stdout.trim().split('\n')[0]}`);
  log(`expanso-edge: ${edgeVersion.stdout.trim().split('\n')[0]}`);

  // Build command trees
  log('\nDiscovering commands...');
  const cliTree = buildCommandTree('expanso-cli');
  const edgeTree = buildCommandTree('expanso-edge');

  // Show command summary
  const cliPaths = getValidPaths(cliTree);
  const edgePaths = getValidPaths(edgeTree);

  console.log('\n--- Valid Commands ---');
  console.log(`expanso-cli (${cliPaths.length} commands):`);
  if (VERBOSE || DUMP_COMMANDS) {
    printCommandTree(cliTree, '  ');
  } else {
    console.log(`  ${Object.keys(cliTree).join(', ')}`);
  }

  console.log(`\nexpanso-edge (${edgePaths.length} commands):`);
  if (VERBOSE || DUMP_COMMANDS) {
    printCommandTree(edgeTree, '  ');
  } else {
    console.log(`  ${Object.keys(edgeTree).join(', ')}`);
  }

  // Save reference
  saveReference(cliTree, edgeTree);

  if (DUMP_COMMANDS) {
    process.exit(0);
  }

  // Validate documentation
  log('\n--- Validating Documentation ---');
  const mdxFiles = await glob(`${DOCS_DIR}/**/*.mdx`);
  log(`Scanning ${mdxFiles.length} files...`);

  const allResults: ValidationResult[] = [];
  let filesWithCommands = 0;

  for (const file of mdxFiles) {
    const results = validateFile(file, cliTree, edgeTree);
    const content = fs.readFileSync(file, 'utf-8');

    if (content.includes('expanso-cli') || content.includes('expanso-edge')) {
      filesWithCommands++;
    }

    if (results.length > 0) {
      allResults.push(...results);
    }
  }

  log(`Found CLI commands in ${filesWithCommands} files`);

  // Report results
  if (allResults.length === 0) {
    console.log('\n All CLI commands in documentation are valid!');
    process.exit(0);
  } else {
    console.log(`\n Found ${allResults.length} potential issues:\n`);

    for (const result of allResults) {
      const relPath = path.relative(process.cwd(), result.file);
      console.log(`${relPath}:${result.line}`);
      console.log(`  Command: ${result.command}`);
      console.log(`  Issue: ${result.issue}`);
      console.log();
    }

    console.log('Review above. Some may be false positives.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
