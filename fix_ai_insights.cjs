const fs = require('fs');
let code = fs.readFileSync('services/aiService.ts', 'utf8');

// The @google/genai SDK requires `contents: prompt` (string) rather than an array of strings like `contents: [prompt]`
code = code.replace(/contents:\s*\[prompt\]/g, 'contents: prompt');

fs.writeFileSync('services/aiService.ts', code);
console.log('Fixed AI service generateContent arguments');
