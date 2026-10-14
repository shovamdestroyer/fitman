const http = require('http');

const urls = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/css/sathi.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/calories.js',
  '/js/nutrition.js',
  '/js/water.js',
  '/js/workouts.js',
  '/js/pose.js',
  '/js/dashboard.js',
  '/js/chatbot.js',
  '/manifest.json',
  '/service-worker.js',
  '/api/health'
];

async function runTests() {
  console.log('=== Testing FitAI Coach Localhost Endpoints ===');
  let passCount = 0;
  for (const u of urls) {
    await new Promise((resolve) => {
      http.get(`http://localhost:3000${u}`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log(`[PASS] ${u} -> Status: 200 OK (${data.length} bytes, ${res.headers['content-type']})`);
            passCount++;
          } else {
            console.error(`[FAIL] ${u} -> Status: ${res.statusCode}`);
          }
          resolve();
        });
      }).on('error', (err) => {
        console.error(`[ERROR] ${u} -> ${err.message}`);
        resolve();
      });
    });
  }
  console.log(`\nResults: ${passCount} / ${urls.length} endpoints passed.`);
}

runTests();
