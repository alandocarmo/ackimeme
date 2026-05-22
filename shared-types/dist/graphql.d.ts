export interface AccountQueryResult {
    id: string;
    balance: string;
    boc?: string;
    acc_type: number;
}
export interface MessageQueryResult {
    id: string;
    body: string;
    src: string;
    dst: string;
    created_at: number;
}
export interface TransactionQueryResult {
    id: string;
    in_message: {
        body: string;
        src: string;
    };
    out_messages: Array<{
        body: string;
        dst: string;
    }>;
    aborted: boolean;
}
