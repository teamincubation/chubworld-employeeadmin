const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'pages');
const files = fs.readdirSync(pagesDir);

files.forEach(file => {
  if (file.endsWith('.jsx') || file.endsWith('.js')) {
    const content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
    if (content.includes('photo_path') || content.includes('photo') || content.includes('avatar')) {
      console.log(`Found photo/avatar in: ${file}`);
    }
  }
});
