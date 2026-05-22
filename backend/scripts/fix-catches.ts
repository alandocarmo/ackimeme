import * as fs from 'fs';
import * as path from 'path';

function fixFile(relPath: string) {
  const filePath = path.join(__dirname, '../src', relPath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace catch (err: any) with catch (err)
  content = content.replace(/catch \((err|error|bundleErr|e): any\)/g, 'catch ($1)');

  // Replace redisClient: any with redisClient: unknown
  content = content.replace(/let redisClient: any = null;/g, 'let redisClient: unknown = null;');

  // Replace admin?: any with admin?: { authMode: string; walletAddress: string };
  content = content.replace(/admin\?: any;/g, 'admin?: { authMode: string; walletAddress: string };');
  
  // Replace session?: any with session?: import("./types").Session;
  content = content.replace(/session\?: any;/g, 'session?: import("./types").Session;');

  // Replace launch: any in rankings
  content = content.replace(/launches\.map\(\(launch: any\)/g, 'launches.map((launch: import("./types").LaunchTicket)');
  
  // Replace mapPublicLaunch
  content = content.replace(/function mapPublicLaunch\(launch: any\): any/g, 'function mapPublicLaunch(launch: import("./types").LaunchTicket): Record<string, unknown>');

  // Replace holders array
  content = content.replace(/const holders: any\[\] = await getTopHoldersByLaunchId/g, 'const holders: { address: string, balance: string, isContract: boolean }[] = await getTopHoldersByLaunchId');
  content = content.replace(/holders\.reduce\(\(acc: bigint, h: any\)/g, 'holders.reduce((acc: bigint, h: { balance: string })');
  content = content.replace(/holders\.sort\(\(a: any, b: any\)/g, 'holders.sort((a: { balance: string }, b: { balance: string })');

  // Specific functions in launches.ts
  if (relPath === 'launches.ts') {
    content = content.replace(/function trimString\(value: any\)/g, 'function trimString(value: unknown)');
    content = content.replace(/function requireText\(value: any, fieldName: string, options: RequireTextOptions = \{\}\)/g, 'function requireText(value: unknown, fieldName: string, options: RequireTextOptions = {})');
    content = content.replace(/function normalizeSymbol\(value: any\)/g, 'function normalizeSymbol(value: unknown)');
    content = content.replace(/function normalizeSupply\(value: any\)/g, 'function normalizeSupply(value: unknown)');
    content = content.replace(/export function parseSlopeDivisor\(val: any\)/g, 'export function parseSlopeDivisor(val: unknown)');
    content = content.replace(/function normalizeOptionalUrl\(value: any, fieldName: string\)/g, 'function normalizeOptionalUrl(value: unknown, fieldName: string)');
    content = content.replace(/function normalizeImageUrl\(value: any, fieldName: string\)/g, 'function normalizeImageUrl(value: unknown, fieldName: string)');
    content = content.replace(/export function normalizeLaunchRequest\(body: any = \{\}, session: any = null\): any/g, 'export function normalizeLaunchRequest(body: unknown = {}, session: import("./types").Session | null = null): Record<string, unknown>');
    content = content.replace(/export function createLaunchTicket\(\{ launchRequest, treasuryPayment, riskProfile \}: CreateLaunchTicketParams\): any/g, 'export function createLaunchTicket({ launchRequest, treasuryPayment, riskProfile }: CreateLaunchTicketParams): import("./types").LaunchTicket');
    content = content.replace(/launchRequest: any;/g, 'launchRequest: import("./types").LaunchRequest;');
    content = content.replace(/treasuryPayment: any;/g, 'treasuryPayment: import("./types").TreasuryPayment;');
    content = content.replace(/riskProfile: any;/g, 'riskProfile: import("./types").RiskProfile;');
  }

  // Specific functions in storage.ts
  if (relPath === 'storage.ts') {
    content = content.replace(/export async function getSessionByToken\(token: any\)/g, 'export async function getSessionByToken(token: string)');
    content = content.replace(/export async function createLaunchBundle\(params: \{ launchTicket: LaunchTicket; auditEvent: any \}\)/g, 'export async function createLaunchBundle(params: { launchTicket: import("./types").LaunchTicket; auditEvent: Record<string, unknown> })');
    content = content.replace(/withTransaction\(async \(client: any\) =>/g, 'withTransaction(async (client: import("pg").PoolClient) =>');
  }

  // Replace remaining simple catch-all if possible
  
  fs.writeFileSync(filePath, content, 'utf8');
}

['main.ts', 'launches.ts', 'storage.ts', 'services/graphql.service.ts', 'services/sync.service.ts', 'services/tvm-client.ts', 'services/deployer.service.ts'].forEach(fixFile);
console.log('Fixed catches and specific anys');
