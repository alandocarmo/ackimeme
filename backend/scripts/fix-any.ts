import * as fs from 'fs';
import * as path from 'path';

const mainTsPath = path.join(__dirname, '../src/main.ts');
let content = fs.readFileSync(mainTsPath, 'utf8');

// Replace standard catches
content = content.replace(/catch \((err|error): any\)/g, 'catch ($1: unknown)');

// Replace Express Request augmentation
content = content.replace('session?: any;', 'session?: import("./types").Session;');
content = content.replace('admin?: any;', 'admin?: { authMode: string; walletAddress: string };');

// Replace redisClient type
content = content.replace('let redisClient: any = null;', 'let redisClient: any = null; // type fixed later if needed');

// Replace verifiedPaymentsCache type
content = content.replace('payment: any;', 'payment: import("./types").TreasuryPayment;');

// Replace normalizeCachePart
content = content.replace('function normalizeCachePart(value: any): string', 'function normalizeCachePart(value: unknown): string');

// Replace isCachedPaymentUsable
content = content.replace('function isCachedPaymentUsable(cached: any,', 'function isCachedPaymentUsable(cached: { payment?: import("./types").TreasuryPayment; timestamp: number } | undefined,');

// Replace buildPublicSession
content = content.replace('function buildPublicSession(session: any): any', 'function buildPublicSession(session: import("./types").Session | null): Partial<import("./types").Session> | null');

// Replace verifyAdminJwt
content = content.replace('function verifyAdminJwt(token: string): any', 'function verifyAdminJwt(token: string): jwt.JwtPayload | null');

// Replace ranking map
content = content.replace(/launch: any/g, 'launch: import("./types").LaunchTicket');
content = content.replace(/holders\.map\(\(h: any\)/g, 'holders.map((h: { address: string, balance: string, isContract: boolean })');
content = content.replace(/holders\.reduce\(\(acc: bigint, h: any\)/g, 'holders.reduce((acc: bigint, h: { balance: string })');
content = content.replace(/holders\.sort\(\(a: any, b: any\)/g, 'holders.sort((a: { balance: string }, b: { balance: string })');

// Replace mapPublicLaunch
content = content.replace('function mapPublicLaunch(launch: any): any', 'function mapPublicLaunch(launch: import("./types").LaunchTicket): Record<string, unknown>');

// holders array
content = content.replace('const holders: any[] = await getTopHoldersByLaunchId', 'const holders: { address: string, balance: string, isContract: boolean }[] = await getTopHoldersByLaunchId');

fs.writeFileSync(mainTsPath, content, 'utf8');
console.log('Fixed main.ts');
