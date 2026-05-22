export interface Session {
    id?: string;
    token?: string;
    walletAddress: string;
    publicKey?: string;
    proofLevel?: 'signature' | 'telegram' | 'basic' | string;
    telegramBinding?: {
        telegramId: number;
        firstName?: string;
        username?: string;
    };
    createdAt?: string;
    issuedAt?: string;
    expiresAt?: string;
    lastSeenAt?: string;
}
export interface JWTPayload {
    address: string;
    iat: number;
    exp: number;
}
export interface QRSession {
    sessionId: string;
    challenge: string;
    expiresAt: number;
    address?: string;
    status: 'pending' | 'confirmed' | 'expired' | string;
}
