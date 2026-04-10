const fs = require('fs');

let css = fs.readFileSync('frontend/styles/Home.module.css', 'utf8');
css += `
/* Degen Terminal Overrides */
.shell { background: var(--bg); color: var(--ink); font-family: var(--font-mono); min-height: 100vh; padding: 16px; }
.terminalHeader { text-align: center; margin: 40px 0; }
.launchCta { font-size: 28px; color: var(--accent); font-weight: bold; padding: 16px 24px; border: 1px solid var(--accent); display: inline-block; margin-bottom: 16px; transition: all 0.2s; background: rgba(134, 239, 172, 0.05); text-decoration: none; }
.launchCta:hover { background: var(--accent); color: #000; box-shadow: 0 0 15px var(--accent); text-decoration: none; }
.terminalNav { display: flex; gap: 16px; justify-content: center; }
.terminalLink { color: var(--ink-soft); font-size: 14px; text-transform: lowercase; }
.terminalLink:hover { color: var(--accent); }
.marketStrip { background: transparent !important; box-shadow: none !important; border: none !important; padding: 0 !important; }
.marketCard { font-family: var(--font-mono); border-radius: 0 !important; border: 1px solid var(--line) !important; background: var(--bg-panel) !important; transition: border-color 0.2s; }
.marketCard:hover { border-color: var(--accent) !important; }
.marketTitle { font-family: var(--font-mono); text-transform: uppercase; color: var(--accent) !important; }
.marketToken { border-radius: 0 !important; background: var(--line) !important; color: var(--accent) !important; font-size: 14px !important; }
.marketBadge { background: rgba(249, 115, 22, 0.2) !important; color: var(--accent-warm) !important; }
.eyebrow { color: var(--accent-warm) !important; }
.orb { display: none !important; }
`;
fs.writeFileSync('frontend/styles/Home.module.css', css);

let js = fs.readFileSync('frontend/pages/index.js', 'utf8');
// remove launchpadSection precisely
js = js.replace(/<section className={styles\.launchpadSection}[\s\S]*?<\/section>/, '{/* Launchpad Removido */}');
fs.writeFileSync('frontend/pages/index.js', js);

console.log("UI patched.");
