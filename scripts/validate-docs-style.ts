#!/usr/bin/env tsx

/**
 * Documentation Style Validator
 *
 * Validates documentation files against our "Less is More" style guide:
 * - Introduction pages: 40-50 lines max
 * - Tutorial pages: 100 lines max
 * - Detects duplication (installation steps, setup instructions)
 * - Flags verbose anti-patterns
 *
 * Usage:
 *   npm run validate-docs
 *   npm run validate-docs -- --fix  # Auto-fix some issues
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface ValidationIssue {
  file: string;
  line?: number;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

interface ValidationResult {
  file: string;
  lineCount: number;
  issues: ValidationIssue[];
  passed: boolean;
}

const VERBOSE_PATTERNS = [
  /in order to successfully/i,
  /it is important to note that/i,
  /please make sure that you/i,
  /first and foremost/i,
  /as you can see/i,
  /it should be noted/i,
  /for example, if you want to/i,
];

const DUPLICATION_KEYWORDS = [
  'npm install',
  'Installation Steps',
  'Prerequisites:',
  'Setup Instructions',
];

/**
 * Detect page type based on file path and frontmatter
 */
function detectPageType(filePath: string, content: string): 'intro' | 'tutorial' | 'reference' | 'unknown' {
  const fileName = path.basename(filePath);

  if (fileName === 'index.mdx' || fileName === 'index.md') {
    return 'intro';
  }

  if (filePath.includes('/step-') || content.includes('## Step ')) {
    return 'tutorial';
  }

  if (filePath.includes('/reference/') || content.includes('## Syntax') || content.includes('## API')) {
    return 'reference';
  }

  return 'unknown';
}

/**
 * Count non-empty lines (excluding frontmatter)
 */
function countContentLines(content: string): number {
  // Remove frontmatter
  const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n/, '');

  // Count non-empty lines
  const lines = withoutFrontmatter.split('\n');
  return lines.filter(line => line.trim().length > 0).length;
}

/**
 * Check for verbose anti-patterns
 */
function checkVerbosePatterns(content: string, filePath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    VERBOSE_PATTERNS.forEach(pattern => {
      if (pattern.test(line)) {
        issues.push({
          file: filePath,
          line: index + 1,
          severity: 'warning',
          message: `Verbose phrase detected: "${line.match(pattern)?.[0]}"`,
          suggestion: 'Simplify: Remove filler phrases and get to the point',
        });
      }
    });
  });

  return issues;
}

/**
 * Check for potential content duplication
 */
function checkDuplication(content: string, filePath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  DUPLICATION_KEYWORDS.forEach(keyword => {
    if (content.includes(keyword)) {
      issues.push({
        file: filePath,
        severity: 'info',
        message: `Potential duplication: Found "${keyword}"`,
        suggestion: 'If this content exists elsewhere, link to it instead of duplicating',
      });
    }
  });

  return issues;
}

/**
 * Validate a single documentation file
 */
function validateFile(filePath: string): ValidationResult {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lineCount = countContentLines(content);
  const pageType = detectPageType(filePath, content);
  const issues: ValidationIssue[] = [];

  // Check length based on page type
  if (pageType === 'intro' && lineCount > 50) {
    issues.push({
      file: filePath,
      severity: 'error',
      message: `Introduction page too long: ${lineCount} lines (max 50)`,
      suggestion: 'Cut to 40-50 lines. Focus on value prop, key points, and clear next steps',
    });
  } else if (pageType === 'tutorial' && lineCount > 100) {
    issues.push({
      file: filePath,
      severity: 'warning',
      message: `Tutorial page too long: ${lineCount} lines (max 100)`,
      suggestion: 'Break into smaller steps or remove verbose explanations',
    });
  }

  // Check for verbose patterns
  issues.push(...checkVerbosePatterns(content, filePath));

  // Check for duplication
  issues.push(...checkDuplication(content, filePath));

  const hasErrors = issues.some(i => i.severity === 'error');

  return {
    file: filePath,
    lineCount,
    issues,
    passed: !hasErrors,
  };
}

/**
 * Main validation function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const shouldFix = args.includes('--fix');

  console.log('📋 Validating documentation style...\n');

  // Find all MDX files
  const patterns = [
    'docs/**/*.mdx',
    'docs/**/*.md',
  ];

  let allFiles: string[] = [];
  for (const pattern of patterns) {
    const files = await glob(pattern, { cwd: process.cwd() });
    allFiles = allFiles.concat(files);
  }

  // Filter out backup files
  allFiles = allFiles.filter(f => !f.includes('.bak') && !f.includes('.backup'));

  console.log(`Found ${allFiles.length} documentation files\n`);

  const results: ValidationResult[] = [];
  let totalIssues = 0;
  let totalErrors = 0;
  let totalWarnings = 0;

  for (const file of allFiles) {
    const result = validateFile(file);
    results.push(result);

    totalIssues += result.issues.length;
    totalErrors += result.issues.filter(i => i.severity === 'error').length;
    totalWarnings += result.issues.filter(i => i.severity === 'warning').length;
  }

  // Print results
  const failedFiles = results.filter(r => !r.passed);

  if (failedFiles.length > 0) {
    console.log('❌ Files with issues:\n');

    failedFiles.forEach(result => {
      console.log(`\n📄 ${result.file} (${result.lineCount} lines)`);

      result.issues.forEach(issue => {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        const location = issue.line ? `:${issue.line}` : '';
        console.log(`  ${icon} ${issue.message}${location}`);
        if (issue.suggestion) {
          console.log(`     💡 ${issue.suggestion}`);
        }
      });
    });
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Summary:\n');
  console.log(`  Total files checked: ${allFiles.length}`);
  console.log(`  Files with issues: ${failedFiles.length}`);
  console.log(`  Total issues: ${totalIssues}`);
  console.log(`    Errors: ${totalErrors}`);
  console.log(`    Warnings: ${totalWarnings}`);
  console.log('');

  if (totalErrors > 0) {
    console.log('💡 Tip: Review DOCS_STYLE_GUIDE.md for guidelines on writing terse, effective docs\n');
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.log('✅ No blocking errors, but consider addressing warnings\n');
    process.exit(0);
  } else {
    console.log('✅ All documentation follows style guidelines!\n');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});
