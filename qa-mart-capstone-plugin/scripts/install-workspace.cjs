const fs = require('node:fs');
const path = require('node:path');
const { workspace, containedPath } = require('../lib/workspace.cjs');

const components = [
  ['instructions/qa-standards.instructions.md', '.github/instructions/qamart-capstone-qa.instructions.md'],
  ['instructions/playwright-rules.instructions.md', '.github/instructions/qamart-capstone-playwright.instructions.md'],
  ['prompts/test-from-story.prompt.md', '.github/prompts/qamart-capstone-test-from-story.prompt.md'],
  ['prompts/triage-regression.prompt.md', '.github/prompts/qamart-capstone-triage-regression.prompt.md'],
];

function install(root) {
  const files = components.map(([source, destination]) => ({
    destination: containedPath(root, destination),
    content: fs.readFileSync(path.join(__dirname, '..', source), 'utf8'),
  }));
  for (const file of files) {
    if (fs.existsSync(file.destination) && fs.readFileSync(file.destination, 'utf8') !== file.content) {
      throw new Error(`Refusing to overwrite ${file.destination}. Reconcile the existing file before installing.`);
    }
  }
  for (const file of files) {
    if (!fs.existsSync(file.destination)) {
      fs.mkdirSync(path.dirname(file.destination), { recursive: true });
      fs.writeFileSync(file.destination, file.content, { flag: 'wx' });
    }
  }
  return files.map((file) => path.relative(root, file.destination));
}

if (require.main === module) {
  try {
    console.log(`Workspace instructions/prompts ready:\n${install(workspace()).join('\n')}`);
    console.log('Install the plugin separately for agents, skills, hooks and MCP servers. Start a new Copilot session.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
module.exports = { install, components };
