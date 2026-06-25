const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'index.css');
const content = fs.readFileSync(cssPath, 'utf8');

const lines = content.split('\n');
for (let i = 730; i <= 860; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
