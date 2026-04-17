const fs = require('fs');
const path = 'App.tsx';
let content = fs.readFileSync(path, 'utf8');

// The getMonday function is exported in dateUtils.ts, we need to import it.
content = content.replace(
  `import { \n  generateWeeksForTerm, \n  toISODate, \n  addDays, \n  formatDate \n} from './utils/dateUtils';`,
  `import { \n  generateWeeksForTerm, \n  toISODate, \n  addDays, \n  formatDate, \n  getMonday \n} from './utils/dateUtils';`
);

fs.writeFileSync(path, content);
