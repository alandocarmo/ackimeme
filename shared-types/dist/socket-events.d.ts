import { Launch } from './launch';
import { Comment } from './comment';
import { Trade } from './trade';
export interface TokenUpdate {
    launchId: string;
    marketCap: number;
    price: number;
    reserveBalance?: number | string;
    tokenSupply?: number | string;
}
export interface ServerToClientEvents {
    newLaunch: (launch: Launch) => void;
    tokenUpdated: (update: TokenUpdate) => void;
    newComment: (comment: Comment) => void;
    newTrade: (trade: Trade) => void;
}
export interface ClientToServerEvents {
    subscribeToToken: (launchId: string) => void;
    unsubscribeFromToken: (launchId: string) => void;
}
