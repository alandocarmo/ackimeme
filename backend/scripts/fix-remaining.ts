import * as fs from 'fs';
import * as path from 'path';

function fixFile(relPath: string) {
  const filePath = path.join(__dirname, '../src', relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Specific main.ts
  if (relPath === 'main.ts') {
    content = content.replace(/let redisClient: any = null;/g, 'let redisClient: unknown = null;');
    content = content.replace(/function mapPublicLaunch\(launch: import\("\.\/types"\)\.LaunchTicket\): any/g, 'function mapPublicLaunch(launch: import("./types").LaunchTicket): Record<string, unknown>');
  }

  // Telegram
  if (relPath === 'telegram.ts') {
    content = content.replace(/user: any;/g, 'user: Record<string, unknown> | null;');
    content = content.replace(/let user: any = null;/g, 'let user: Record<string, unknown> | null = null;');
    content = content.replace(/function parseTelegramInitData\(initData: any\)/g, 'function parseTelegramInitData(initData: unknown)');
  }

  // Payments
  if (relPath === 'payments.ts') {
    content = content.replace(/amount: any;/g, 'amount: number | string;');
    content = content.replace(/minimumAmount: any;/g, 'minimumAmount: number | string;');
  }

  // Treasury
  if (relPath === 'treasury.ts') {
    content = content.replace(/normalizeTokenSymbol\(value: any\)/g, 'normalizeTokenSymbol(value: unknown)');
    content = content.replace(/\(item: any\)/g, '(item: Record<string, unknown>)');
    content = content.replace(/amount: any;/g, 'amount: number | string;');
  }

  // Security
  if (relPath === 'security.ts') {
    content = content.replace(/\(row: any\)/g, '(row: Record<string, unknown>)');
  }

  // Common catches
  content = content.replace(/catch \((err|error|bundleErr): any\)/g, 'catch ($1: unknown)');

  fs.writeFileSync(filePath, content, 'utf8');
}

['main.ts', 'payments.ts', 'security.ts', 'telegram.ts', 'treasury.ts'].forEach(fixFile);
console.log('Fixed remaining files');
