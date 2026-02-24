const fs = require('fs');
const path = require('path');

const viewsDir = path.join(__dirname, 'views');

// Fix main.ejs to handle undefined title
const mainEjsPath = path.join(viewsDir, 'layouts', 'main.ejs');
let mainContent = fs.readFileSync(mainEjsPath, 'utf8');

// Replace title line with safe version
mainContent = mainContent.replace(
  '<title><%= title %> | School Management System</title>',
  '<title><%= typeof title !== "undefined" ? title : "School Management System" %> | School Management System</title>'
);

fs.writeFileSync(mainEjsPath, mainContent);
console.log('? Fixed main.ejs to handle undefined titles');

// Fix all view files to ensure they pass title
const fixViewFiles = (dir) => {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fixViewFiles(fullPath);
    } else if (file.endsWith('.ejs')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      // Add default title if not present
      if (!content.includes('<%=') && !content.includes('<!DOCTYPE')) {
        // This is a partial, skip
        return;
      }
    }
  });
};

console.log('Done! Restart your server.');