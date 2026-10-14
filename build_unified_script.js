const fs = require('fs');

const files = [
  'js/auth.js',
  'js/calories.js',
  'js/nutrition.js',
  'js/water.js',
  'js/workouts.js',
  'js/pose.js',
  'js/dashboard.js',
  'js/chatbot.js',
  'js/app.js'
];

let output = '// FitAI Coach & SATHI AI — Unified Application Script\n';
output += 'if (typeof window.FITAI_APP_LOADED === "undefined") {\n';
output += '  window.FITAI_APP_LOADED = true;\n\n';

for (const f of files) {
  output += `// ========================================================\n`;
  output += `// MODULE: ${f}\n`;
  output += `// ========================================================\n`;
  output += fs.readFileSync(f, 'utf8') + '\n\n';
}

output += `
  // Immediate bootstrap if DOM is already ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (typeof App !== 'undefined' && typeof App.init === 'function') {
      try { App.init(); } catch (e) { console.warn(e); }
    }
  }
}
`;

fs.writeFileSync('script.js', output);
console.log('Successfully built script.js, size:', output.length, 'bytes');
