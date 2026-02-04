const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();

const listChangedFiles = () => {
  try {
    const output = execSync('git diff --name-only --diff-filter=ACMRTUB', { encoding: 'utf-8' });
    return output.split('\n').map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
};

const hasTrailingWhitespace = (content) => /[\t ]+$/m.test(content);

const files = listChangedFiles();
let hasError = false;

files.forEach((file) => {
  const fullPath = path.join(repoRoot, file);
  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) return;
  const content = fs.readFileSync(fullPath, 'utf-8');
  if (hasTrailingWhitespace(content)) {
    console.error(`Trailing whitespace detected in ${file}`);
    hasError = true;
  }
});

if (hasError) {
  process.exit(1);
}
