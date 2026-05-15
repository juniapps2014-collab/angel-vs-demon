import { SupabaseClient } from '../network/SupabaseClient';

export interface SessionUser {
  id: string;
  isAnonymous: boolean;
  provider: 'local-fallback' | 'supabase-anon';
}

export class AuthService {
  private static currentUser: SessionUser | null = null;

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
          globalThis.localStorage?.setItem('avd.userId', existingUser.id);
          return this.currentUser;
        }

        const session = await SupabaseClient.signInAnonymously();
        const signedInUser = session.user;
        if (!signedInUser) {
          throw new Error('Supabase anonymous sign-in returned no user.');
        }

        globalThis.localStorage?.setItem('avd.userId', signedInUser.id);
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

    const existingId = globalThis.localStorage?.getItem('avd.userId');
    const userId = existingId ?? crypto.randomUUID();
    globalThis.localStorage?.setItem('avd.userId', userId);
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
}
