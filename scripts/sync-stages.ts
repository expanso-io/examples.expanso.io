import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Configuration
const DOCS_DIR = 'docs';
const EXAMPLES_DIR = 'examples';

// Regex to capture the stage configuration
// Matches objects in the array that look like: { ... yamlFilename: '...', yamlCode: `...`, ... }
const STAGE_REGEX = /yamlFilename:\s*['"]([^'"]+)['"][\s\S]*?yamlCode:\s*`([^`]+)`/g;

async function syncStages() {
  console.log('🔄 Starting stage synchronization...');
  
  // Find all stage definition files
  const stageFiles = await glob(`${DOCS_DIR}/**/*-full.stages.ts`);
  console.log(`Found ${stageFiles.length} stage files to process.`);

  let totalFilesGenerated = 0;
  let totalFilesUpdated = 0;

  for (const stageFile of stageFiles) {
    const content = fs.readFileSync(stageFile, 'utf-8');
    
    // Determine the target directory in 'examples/'
    // specific logic: docs/category/name-full.stages.ts -> examples/category/
    const relativePath = path.relative(DOCS_DIR, path.dirname(stageFile));
    const targetDir = path.join(EXAMPLES_DIR, relativePath);

    // Ensure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    let match;
    // Reset lastIndex since we're reusing the regex object in a loop? 
    // No, we create a new iterator or reset if global. 
    // Using matchAll is safer or a simple while loop with execution.
    
    let fileMatches = 0;
    while ((match = STAGE_REGEX.exec(content)) !== null) {
      const [_, filename, yamlContent] = match;
      const targetPath = path.join(targetDir, filename);
      
      // Normalize content (trim to avoid whitespace diffs being significant)
      const normalizedContent = yamlContent.trim() + '\n';

      let action = 'skipped';
      
      if (!fs.existsSync(targetPath)) {
        fs.writeFileSync(targetPath, normalizedContent);
        action = 'created';
        totalFilesGenerated++;
      } else {
        const existingContent = fs.readFileSync(targetPath, 'utf-8');
        if (existingContent.trim() !== normalizedContent.trim()) {
          fs.writeFileSync(targetPath, normalizedContent);
          action = 'updated';
          totalFilesUpdated++;
        }
      }

      console.log(`[${action}] ${path.relative(process.cwd(), targetPath)}`);
      fileMatches++;
    }
    
    if (fileMatches === 0) {
      console.warn(`⚠️  No stages found in ${stageFile}. Check regex or file format.`);
    }
  }

  console.log('--------------------------------------------------');
  console.log(`Summary:`);
  console.log(`Files Generated: ${totalFilesGenerated}`);
  console.log(`Files Updated:   ${totalFilesUpdated}`);
  console.log('✅ Synchronization complete.');
}

syncStages().catch(console.error);
