const fs = require('fs');

let jsx = fs.readFileSync('frontend/pages/exclusive.js', 'utf8');

// Remove the hero section
jsx = jsx.replace(/<section className=\{styles\.hero\}>[\s\S]*?<\/section>/, '');

// Remove the marketStrip section safely
jsx = jsx.replace(/<section className=\{styles\.marketStrip\} id="market-feed">[\s\S]*?<\/section>/, '');

// Adjust title
jsx = jsx.replace(/<title>\{appConfig\.appName\}<\/title>/, '<title>Exclusive Launchpad | {appConfig.appName}</title>');

fs.writeFileSync('frontend/pages/exclusive.js', jsx);
console.log("Exclusive view patched.");
