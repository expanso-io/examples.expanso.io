#!/usr/bin/env tsx
/**
 * CLI Command Validator
 *
 * Uses the installed latest expanso-cli and expanso-edge binaries to validate that
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
import { resolveInstalledExpansoBinary } from './validation/expanso-binary';

// Configuration
const DOCS_DIR = path.join(process.cwd(), 'docs');

const binaryPaths = new Map<string, string>();

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

interface CommandValidation {
  valid: boolean;
  issue?: string;
}

interface ExtractedCommand {
  binary: string;
  args: string;
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
  const binaryPath = binaryPaths.get(binary);

  if (!binaryPath) throw new Error(`Binary was not resolved: ${binary}`);

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
    if (
      inCommandsSection &&
      (/^Flags:$/i.test(trimmed) || /^Global Flags:$/i.test(trimmed))
    ) {
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

    const subtree: CommandTree = {};
    tree[cmd] = subtree;

    // Get subcommands for this command (one level deep)
    try {
      const cmdHelp = runHelp(binary, [cmd]);
      const subCommands = parseSubcommands(cmdHelp);

      for (const sub of subCommands) {
        if (sub === 'help') continue;
        subtree[sub] = null;
      }

      // If no subcommands, mark as leaf
      if (Object.keys(subtree).length === 0) {
        tree[cmd] = null;
      }
    } catch {
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

    if (sub) {
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

    if (sub) {
      paths.push(...getValidPaths(sub, currentPath));
    }
  }

  return paths;
}

/**
 * Check if a command path is valid
 */
function isValidCommand(
  commandParts: string[],
  tree: CommandTree
): CommandValidation {
  let current: CommandTree | null = tree;

  for (let i = 0; i < commandParts.length; i++) {
    const part = commandParts[i];

    // Skip flags and values
    if (
      part.startsWith('-') ||
      part.includes('/') ||
      part.includes('.') ||
      part.includes('=') ||
      part.startsWith('$') ||
      part.startsWith('<') ||
      part.match(/^[A-Z_]+$/) ||
      part.match(/^\d/)
    ) {
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
function extractCommands(line: string): ExtractedCommand[] {
  const results: ExtractedCommand[] = [];

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
      const parts = args.split(/\s+/).filter((p) => p.length > 0);
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
 * Main
 */
async function main() {
  console.log('========================================');
  console.log('  Expanso CLI Command Validator');
  console.log('========================================\n');

  const cli = resolveInstalledExpansoBinary('cli');
  const edge = resolveInstalledExpansoBinary('edge');
  binaryPaths.set('expanso-cli', cli.path);
  binaryPaths.set('expanso-edge', edge.path);
  log(`expanso-cli: ${cli.version}`);
  log(`expanso-edge: ${edge.version}`);

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
