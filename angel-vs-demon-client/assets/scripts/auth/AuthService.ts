import { SupabaseClient } from '../network/SupabaseClient';

export interface SessionUser {
  id: string;
  isAnonymous: boolean;
  provider: 'local-fallback' | 'supabase-anon' | 'supabase-email';
}

export interface EmailAuthResult {
  user: SessionUser | null;
  needsEmailConfirmation: boolean;
}

export class AuthService {
  private static currentUser: SessionUser | null = null;
  private static readonly localUserIdKey = 'avd.userId';
  private static readonly authModeKey = 'avd.auth.mode';

  static async bootstrap(): Promise<SessionUser | null> {
    if (this.currentUser) {
      return this.currentUser;
    }

    const existingSession = SupabaseClient.getSession();
    const existingUser = existingSession?.user;
    if (existingUser) {
      const provider = existingUser.is_anonymous ? 'supabase-anon' : 'supabase-email';
      this.currentUser = {
        id: existingUser.id,
        isAnonymous: existingUser.is_anonymous ?? false,
        provider,
      };
      globalThis.localStorage?.setItem(this.localUserIdKey, existingUser.id);
      globalThis.localStorage?.setItem(this.authModeKey, provider === 'supabase-email' ? 'email' : 'guest');
      return this.currentUser;
    }

    const authMode = globalThis.localStorage?.getItem(this.authModeKey);
    const existingId = globalThis.localStorage?.getItem(this.localUserIdKey);
    if ((authMode === 'guest' || (!authMode && !!existingId)) && existingId) {
      this.currentUser = {
        id: existingId,
        isAnonymous: true,
        provider: 'local-fallback',
      };
      return this.currentUser;
    }

    return null;
  }

  static async signInAnonymously(): Promise<SessionUser> {
    if (this.currentUser) {
      return this.currentUser;
    }

    if (SupabaseClient.isConfigured()) {
      try {
        const existingSession = SupabaseClient.getSession();
        const existingUser = existingSession?.user;

        if (existingUser) {
          this.currentUser = {
            id: existingUser.id,
            isAnonymous: existingUser.is_anonymous ?? true,
            provider: 'supabase-anon',
          };
          globalThis.localStorage?.setItem(this.localUserIdKey, existingUser.id);
          globalThis.localStorage?.setItem(this.authModeKey, 'guest');
          return this.currentUser;
        }

        const session = await SupabaseClient.signInAnonymously();
        const signedInUser = session.user;
        if (!signedInUser) {
          throw new Error('Supabase anonymous sign-in returned no user.');
        }

        globalThis.localStorage?.setItem(this.localUserIdKey, signedInUser.id);
        globalThis.localStorage?.setItem(this.authModeKey, 'guest');
        this.currentUser = {
          id: signedInUser.id,
          isAnonymous: signedInUser.is_anonymous ?? true,
          provider: 'supabase-anon',
        };
        return this.currentUser;
      } catch (error) {
        console.warn('[AuthService] Falling back to local anonymous session.', error);
      }
    }

    const existingId = globalThis.localStorage?.getItem(this.localUserIdKey);
    const userId = existingId ?? crypto.randomUUID();
    globalThis.localStorage?.setItem(this.localUserIdKey, userId);
    globalThis.localStorage?.setItem(this.authModeKey, 'guest');
    this.currentUser = {
      id: userId,
      isAnonymous: true,
      provider: 'local-fallback',
    };
    return this.currentUser;
  }

  static getCurrentUser(): SessionUser | null {
    return this.currentUser;
  }

  static async signUpWithEmail(email: string, password: string): Promise<EmailAuthResult> {
    const result = await SupabaseClient.signUpWithEmail(email, password);
    if (!result.session) {
      this.currentUser = null;
      globalThis.localStorage?.removeItem(this.localUserIdKey);
      globalThis.localStorage?.removeItem(this.authModeKey);
      return {
        user: null,
        needsEmailConfirmation: true,
      };
    }

    this.currentUser = {
      id: result.userId,
      isAnonymous: false,
      provider: 'supabase-email',
    };
    globalThis.localStorage?.setItem(this.localUserIdKey, result.userId);
    globalThis.localStorage?.setItem(this.authModeKey, 'email');
    return {
      user: this.currentUser,
      needsEmailConfirmation: false,
    };
  }

  static async signInWithEmail(email: string, password: string): Promise<SessionUser> {
    const session = await SupabaseClient.signInWithPassword(email, password);
    const user = session.user;
    this.currentUser = {
      id: user.id,
      isAnonymous: false,
      provider: 'supabase-email',
    };
    globalThis.localStorage?.setItem(this.localUserIdKey, user.id);
    globalThis.localStorage?.setItem(this.authModeKey, 'email');
    return this.currentUser;
  }

  static async signOut(): Promise<void> {
    await SupabaseClient.signOut();
    this.currentUser = null;
    globalThis.localStorage?.removeItem(this.authModeKey);
    globalThis.localStorage?.removeItem(this.localUserIdKey);
  }
}
