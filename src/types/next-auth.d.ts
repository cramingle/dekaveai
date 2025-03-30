import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** User ID */
      id?: string;
      /** Number of tokens the user has */
      tokens?: number;
      /** User tier */
      tier?: 'Pioneer' | 'Voyager' | 'Dominator' | 'Overlord';
      /** Token expiration date */
      tokens_expiry_date?: string;
      /** Whether the user has a stored conversation */
      hasStoredConversation?: boolean;
      /** When the conversation was last used */
      conversationLastUsed?: string;
    } & DefaultSession["user"]
  }
  
  interface User {
    /** User tier */
    tier?: 'Pioneer' | 'Voyager' | 'Dominator' | 'Overlord';
    /** User tokens */
    tokens?: number;
    /** Token expiration date */
    tokens_expiry_date?: string;
  }
}

// Include User and JWT interfaces if needed
declare module "next-auth/jwt" {
  interface JWT {
    /** User ID */
    id?: string;
    /** User tier */
    tier?: 'Pioneer' | 'Voyager' | 'Dominator' | 'Overlord';
    /** User tokens */
    tokens?: number;
    /** Token expiration date */
    tokens_expiry_date?: string;
  }
} 