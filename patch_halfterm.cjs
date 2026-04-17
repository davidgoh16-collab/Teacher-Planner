const fs = require('fs');

const path = 'App.tsx';
let content = fs.readFileSync(path, 'utf8');

const oldLine = 'const mondayAfterHalfTerm = getMonday(addDays(currentTerm.halfTermEnd, 1));';
const newLine = 'const mondayAfterHalfTerm = getMonday(addDays(currentTerm.halfTermEnd, 3));';

content = content.replace(oldLine, newLine);
fs.writeFileSync(path, content);
