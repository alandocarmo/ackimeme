import * as fs from 'fs';
import * as path from 'path';

function fixFile(relPath: string) {
  const filePath = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  if (relPath === 'pages/admin/security.tsx') {
    content = content.replace(/\{ano\.wallet as string\}/g, '{String(ano.wallet)}');
    content = content.replace(/\{ano\.timestamp as string\}/g, '{String(ano.timestamp)}');
  }

  if (relPath === 'pages/token/[id].tsx') {
    content = content.replace(/toast\.error\("Erro", err\.message \|\| "Erro ao atualizar favoritos\."\);/g, 'toast.error("Erro", (err as Error).message || "Erro ao atualizar favoritos.");');
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

['pages/admin/security.tsx', 'pages/token/[id].tsx'].forEach(fixFile);
console.log('Fixed final 2 errors');
