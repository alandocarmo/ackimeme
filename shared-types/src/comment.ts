export interface Comment {
  id: string;
  launchId: string;
  walletAddress: string;
  content: string;
  createdAt: string;
}

export interface CommentType extends Comment {}
