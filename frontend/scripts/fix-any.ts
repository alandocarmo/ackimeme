import * as fs from 'fs';
import * as path from 'path';

function fixFile(relPath: string) {
  const filePath = path.join(__dirname, '..', relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // General catch (err: any) -> catch (err: unknown)
  // Actually catch (err) is safer to avoid err.message compilation errors
  // Wait! In React we often do `err.message` so catch (err: any) -> catch (err: unknown) requires casting.
  // I will use catch(err: any) -> catch(err: unknown) and let TS complain, then fix it, OR I can just replace `err.message` with `(err as Error).message`.
  // Wait! A better way is: `catch (err: any)` -> `catch (error)` and then `error instanceof Error ? error.message : String(error)`.
  content = content.replace(/catch\s*\((err|error|e):\s*any\)/g, 'catch ($1: unknown)');

  // lib/api.ts
  if (relPath === 'lib/api.ts') {
    content = content.replace(/body\?: any;/g, 'body?: unknown;');
    content = content.replace(/let data: any = null;/g, 'let data: unknown = null;');
    content = content.replace(/export function verifyPayment\(payload: any\): Promise<any>/g, 'export function verifyPayment(payload: unknown): Promise<Record<string, unknown>>');
    content = content.replace(/export function createLaunchRequest\(payload: any, token\?: string\): Promise<any>/g, 'export function createLaunchRequest(payload: unknown, token?: string): Promise<Record<string, unknown>>');
    content = content.replace(/history: any\[\]/g, 'history: Record<string, unknown>[]');
  }

  // lib/utils.ts
  if (relPath === 'lib/utils.ts') {
    content = content.replace(/bcContract: any/g, 'bcContract: unknown');
  }

  // global.d.ts
  if (relPath === 'global.d.ts') {
    content = content.replace(/Telegram\?: any;/g, 'Telegram?: Record<string, unknown>;');
  }

  // admin/security.tsx
  if (relPath === 'pages/admin/security.tsx') {
    content = content.replace(/\(ano: any, i: number\)/g, '(ano: Record<string, unknown>, i: number)');
  }

  // create.tsx
  if (relPath === 'pages/create.tsx') {
    content = content.replace(/ticket: any \| null/g, 'ticket: import("@ackimeme/shared-types").LaunchTicket | null');
    content = content.replace(/value: any/g, 'value: string | number | boolean | undefined');
  }

  // index.tsx
  if (relPath === 'pages/index.tsx') {
    content = content.replace(/readReserveBalance\(onchainData: any\)/g, 'readReserveBalance(onchainData: import("@ackimeme/shared-types").OnchainData | undefined)');
    content = content.replace(/handleTokenUpdated = \(update: any\)/g, 'handleTokenUpdated = (update: Partial<import("@ackimeme/shared-types").Launch>)');
  }

  // portfolio.tsx
  if (relPath === 'pages/portfolio.tsx') {
    content = content.replace(/\(r: any\)/g, '(r: { launches?: import("@ackimeme/shared-types").Launch[] })');
    content = content.replace(/\(l: any\)/g, '(l: import("@ackimeme/shared-types").Launch)');
    content = content.replace(/const foundHoldings: any\[\] = \[\];/g, 'const foundHoldings: Record<string, unknown>[] = [];');
    content = content.replace(/\(token: any\)/g, '(token: Record<string, unknown>)');
  }

  // token/[id].tsx
  if (relPath === 'pages/token/[id].tsx') {
    content = content.replace(/history: any\[\]/g, 'history: Record<string, unknown>[]');
    content = content.replace(/scaleY = \(val: any\)/g, 'scaleY = (val: number)');
    content = content.replace(/\(getSession as any\)\(\)/g, 'getSession()');
    content = content.replace(/\(r: any\)/g, '(r: Record<string, unknown>)');
    content = content.replace(/\(f: any\)/g, '(f: import("@ackimeme/shared-types").Launch)');
    content = content.replace(/\(r as any\)/g, '(r as Record<string, unknown>)');
    content = content.replace(/handleTokenUpdated = \(update: any\)/g, 'handleTokenUpdated = (update: Partial<import("@ackimeme/shared-types").Launch>)');
    content = content.replace(/handleNewComment = \(comment: any\)/g, 'handleNewComment = (comment: import("@ackimeme/shared-types").Comment)');
    content = content.replace(/handleNewTrade = \(trade: any\)/g, 'handleNewTrade = (trade: import("@ackimeme/shared-types").Trade)');
    content = content.replace(/\(update: any\)/g, '(update: Record<string, unknown>)'); // fallback for any missed
  }

  // Final catch err.message fix (simple version: replaces err.message with (err as Error).message)
  content = content.replace(/err\.message/g, '(err as Error).message');
  content = content.replace(/error\.message/g, '(error as Error).message');

  fs.writeFileSync(filePath, content, 'utf8');
}

['global.d.ts', 'lib/api.ts', 'lib/utils.ts', 'pages/admin/security.tsx', 'pages/auth.tsx', 'pages/buy-shell.tsx', 'pages/create.tsx', 'pages/index.tsx', 'pages/portfolio.tsx', 'pages/token/[id].tsx'].forEach(fixFile);
console.log('Fixed any in frontend');
