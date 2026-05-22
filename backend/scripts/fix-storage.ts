import * as fs from 'fs';
import * as path from 'path';

const storagePath = path.join(__dirname, '../src/storage.ts');
let content = fs.readFileSync(storagePath, 'utf8');

// Replace catch (err: any) -> catch (err: unknown)
content = content.replace(/catch \((err|error): any\)/g, 'catch ($1: unknown)');

// Replace row: any -> row: Record<string, unknown>
content = content.replace(/\(row: any\)/g, '(row: Record<string, unknown>)');

// Replace normalizeLaunchRow
content = content.replace('function normalizeLaunchRow(row: any)', 'function normalizeLaunchRow(row: Record<string, unknown>)');

// Replace normalizeCommentRow
content = content.replace('function normalizeCommentRow(row: any)', 'function normalizeCommentRow(row: Record<string, unknown>)');

// Replace normalizeSessionRow
content = content.replace('function normalizeSessionRow(row: any)', 'function normalizeSessionRow(row: Record<string, unknown>)');

// Replace return type for some specific functions
content = content.replace('auditEvent: any', 'auditEvent: Record<string, unknown>');
content = content.replace('export async function createLaunchBundle(params: { launchTicket: LaunchTicket; auditEvent: any })', 'export async function createLaunchBundle(params: { launchTicket: import("./types").LaunchTicket; auditEvent: Record<string, unknown> })');
content = content.replace('withTransaction(async (client: any) =>', 'withTransaction(async (client: import("pg").PoolClient) =>');

// Search for any remaining : any
content = content.replace(/:\s*any\b/g, ': unknown');

fs.writeFileSync(storagePath, content, 'utf8');
console.log('Fixed storage.ts');

const servicesDir = path.join(__dirname, '../src/services');
const files = fs.readdirSync(servicesDir).filter(f => f.endsWith('.ts'));

for (const file of files) {
  const filePath = path.join(servicesDir, file);
  let svcContent = fs.readFileSync(filePath, 'utf8');
  svcContent = svcContent.replace(/catch \((err|error): any\)/g, 'catch ($1: unknown)');
  
  // Specific fixes
  svcContent = svcContent.replace(/let client: any = null;/g, 'let client: unknown = null;');
  svcContent = svcContent.replace(/let abiContract: any = null;/g, 'let abiContract: unknown = null;');
  svcContent = svcContent.replace(/let signerKeys: any = null;/g, 'let signerKeys: unknown = null;');
  svcContent = svcContent.replace(/let tvmClient: any = null;/g, 'let tvmClient: unknown = null;');
  svcContent = svcContent.replace(/let sdkClient: any = null;/g, 'let sdkClient: unknown = null;');
  svcContent = svcContent.replace(/let fileKeys: any = \{\};/g, 'let fileKeys: Record<string, unknown> = {};');
  svcContent = svcContent.replace(/abi: any;/g, 'abi: unknown;');
  svcContent = svcContent.replace(/BONDING_CURVE_ABI: any;/g, 'BONDING_CURVE_ABI: unknown;');
  svcContent = svcContent.replace(/export async function gql\(query: any, variables = \{\}, retries = 3\)/g, 'export async function gql(query: string, variables = {}, retries = 3)');
  svcContent = svcContent.replace(/export function nanoToDecimal\(nanoValue: any\)/g, 'export function nanoToDecimal(nanoValue: unknown)');
  svcContent = svcContent.replace(/export function extractCurrencyNano\(currencies: any, currencyId: any\)/g, 'export function extractCurrencyNano(currencies: unknown, currencyId: unknown)');
  svcContent = svcContent.replace(/export function normalizeAddress\(value: any\)/g, 'export function normalizeAddress(value: unknown)');
  svcContent = svcContent.replace(/export function buildTxHashCandidates\(hash: any\)/g, 'export function buildTxHashCandidates(hash: unknown)');
  svcContent = svcContent.replace(/export function canonicalTxHash\(hash: any\)/g, 'export function canonicalTxHash(hash: unknown)');
  svcContent = svcContent.replace(/export function normalizeStatus\(statusInt: any, statusName: any\)/g, 'export function normalizeStatus(statusInt: unknown, statusName: unknown)');
  svcContent = svcContent.replace(/export async function getAccountBalance\(address: any\)/g, 'export async function getAccountBalance(address: string)');
  svcContent = svcContent.replace(/export async function getAccountBalanceNano\(address: any\)/g, 'export async function getAccountBalanceNano(address: string)');
  svcContent = svcContent.replace(/export async function getAccountPublicKey\(address: any\)/g, 'export async function getAccountPublicKey(address: string)');
  svcContent = svcContent.replace(/export async function getAccountState\(address: any\)/g, 'export async function getAccountState(address: string)');
  svcContent = svcContent.replace(/export async function getTransaction\(hash: any\)/g, 'export async function getTransaction(hash: string)');
  svcContent = svcContent.replace(/signer: any/g, 'signer: unknown');
  svcContent = svcContent.replace(/initialData\?: any/g, 'initialData?: unknown');
  svcContent = svcContent.replace(/constructorInput: any/g, 'constructorInput: unknown');
  svcContent = svcContent.replace(/slopeDivisor: any/g, 'slopeDivisor: number');
  svcContent = svcContent.replace(/e: any/g, 'e: unknown');
  
  // catch-all for remaining anys
  svcContent = svcContent.replace(/:\s*any\b/g, ': unknown');

  fs.writeFileSync(filePath, svcContent, 'utf8');
}
console.log('Fixed services');
