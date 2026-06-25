const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'index.css');
const content = fs.readFileSync(cssPath, 'utf8');

const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('color:') && line.includes('!important')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
