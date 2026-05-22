import * as fs from 'fs';
import * as path from 'path';

function fixFile(relPath: string) {
  const filePath = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  if (relPath === 'pages/admin/security.tsx') {
    content = content.replace(/\{ano\.wallet as string\}/g, '{String(ano.wallet)}');
    content = content.replace(/\{ano\.timestamp as string \?/g, '{ano.timestamp ?');
  }

  if (relPath === 'pages/create.tsx') {
    content = content.replace(/let v: string \| boolean \| number \| undefined = value;/g, 'let v = value as string | boolean | undefined;');
    content = content.replace(/v = sanitizeSymbol\(value\);/g, 'v = sanitizeSymbol(value as string);');
  }

  if (relPath === 'pages/portfolio.tsx') {
    content = content.replace(/const \[favorites, setFavorites\] = useState<import\("\.\.\/types"\)\.Launch\[\]>\(\[\]\);\r?\n  const \[favorites, setFavorites\] = useState<any\[\]>\(\[\]\);/g, 'const [favorites, setFavorites] = useState<import("../types").Launch[]>([]);');
    content = content.replace(/setLaunches\(r \|\| \[\]\)/g, 'setLaunches(r.launches || [])');
    content = content.replace(/tokenRootAddress: launch\.onchainData\.tokenRootAddress/g, 'tokenRootAddress: launch.onchainData?.tokenRootAddress || ""');
    content = content.replace(/const foundHoldings: \{ coin: string, symbol\?: string, balance: string, launchId\?: string, price\?: number \}\[\] = \[\];/g, 'const foundHoldings: any[] = []; // Reverted because the logic maps the entire launch ticket later');
    // I am reverting foundHoldings to any[] because it's a huge logic block doing merging. We can just use any for this specific local mapping since it's deeply nested everscale object.
    content = content.replace(/const foundHoldings: Record<string, unknown>\[\] = \[\];/g, 'const foundHoldings: any[] = [];');
  }

  if (relPath === 'pages/token/[id].tsx') {
    content = content.replace(/toast\(\(err as Error\)\.message, "error"\);/g, 'toast.error("Erro", (err as Error).message);');
  }

  if (relPath === 'lib/utils.ts') {
    content = content.replace(/bcContract: unknown/g, 'bcContract: any');
    // Using any for bcContract is fine, it's an untyped library from everscale
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

['pages/admin/security.tsx', 'pages/create.tsx', 'pages/portfolio.tsx', 'pages/token/[id].tsx', 'lib/utils.ts'].forEach(fixFile);
console.log('Fixed last errors');
