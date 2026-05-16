export interface SupabaseConfig {
  url: string;
  anonKey: string;
  projectName: string;
  authMode: 'anonymous' | 'email';
}

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: {
    id: string;
    is_anonymous?: boolean;
  };
}

export interface EmailSignUpResult {
  userId: string;
  session: SupabaseSession | null;
  needsEmailConfirmation: boolean;
}

export class SupabaseClient {
  private static readonly sessionStorageKey = 'avd.supabase.session';
  private static config: SupabaseConfig | null = null;
  private static session: SupabaseSession | null = null;

  static initialize(config: SupabaseConfig): void {
    this.config = config;
    this.session = this.loadStoredSession();
  }

  static isConfigured(): boolean {
    return this.config !== null;
  }

  static getConfig(): SupabaseConfig | null {
    return this.config;
  }

  static getProjectLabel(): string {
    return this.config?.projectName ?? 'Supabase';
  }

  static getSession(): SupabaseSession | null {
    if (this.session && this.session.expires_at && Date.now() > this.session.expires_at * 1000) {
      console.warn('[SupabaseClient] Session expired, clearing');
      this.setSession(null);
      return null;
    }
    return this.session;
  }

  static setSession(session: SupabaseSession | null): void {
    this.session = session;

    if (session) {
      globalThis.localStorage?.setItem(this.sessionStorageKey, JSON.stringify(session));
      return;
    }

    globalThis.localStorage?.removeItem(this.sessionStorageKey);
  }

  static async signInAnonymously(): Promise<SupabaseSession> {
    const existingSession = this.getSession();
    if (existingSession && existingSession.expires_at && Date.now() < existingSession.expires_at * 1000) {
      return existingSession;
    }

    this.setSession(null);

    try {
      const response = await this.requestAuth<SupabaseSession>('POST', '/signup', {
        data: {},
      });
      this.setSession(response);
      return response;
    } catch (error) {
      console.warn('[SupabaseClient] Anonymous sign-up failed, using local session fallback');
      const userId = crypto.randomUUID();
      const localSession: SupabaseSession = {
        access_token: 'local_fallback_token',
        refresh_token: '',
        expires_in: 0,
        token_type: 'local',
        user: {
          id: userId,
          is_anonymous: true,
        },
      };
      this.setSession(localSession);
      return localSession;
    }
  }

  static async signUpWithEmail(email: string, password: string): Promise<EmailSignUpResult> {
    this.setSession(null);

    const response = await this.requestAuth<Partial<SupabaseSession>>('POST', '/signup', {
      email,
      password,
    });

    if (response.access_token && response.user) {
      const session = response as SupabaseSession;
      this.setSession(session);
      return {
        userId: session.user.id,
        session,
        needsEmailConfirmation: false,
      };
    }

    if (response.user?.id) {
      return {
        userId: response.user.id,
        session: null,
        needsEmailConfirmation: true,
      };
    }

    const session = await this.signInWithPassword(email, password);
    return {
      userId: session.user.id,
      session,
      needsEmailConfirmation: false,
    };
  }

  static async signInWithPassword(email: string, password: string): Promise<SupabaseSession> {
    this.setSession(null);
    const session = await this.requestAuth<SupabaseSession>('POST', '/token?grant_type=password', {
      email,
      password,
    });
    this.setSession(session);
    return session;
  }

  static async signOut(): Promise<void> {
    const session = this.session;
    try {
      if (session && session.access_token !== 'local_fallback_token') {
        await this.requestAuth('POST', '/logout', undefined, {
          Authorization: `Bearer ${session.access_token}`,
        });
      }
    } catch (error) {
      console.warn('[SupabaseClient] Sign-out request failed, clearing local session anyway.', error);
    } finally {
      this.setSession(null);
    }
  }

  static async queryMaybeSingle<T>(table: string, query: string): Promise<T | null> {
    const result = await this.requestRest<T[]>(
      'GET',
      `/${table}?${query}`,
      undefined,
      {
        Accept: 'application/vnd.pgrst.object+json',
      },
      true,
    );

    return result;
  }

  static async queryList<T>(table: string, query?: string): Promise<T[]> {
    const path = query ? `/${table}?${query}` : `/${table}`;
    const result = await this.requestRest<T[]>('GET', path);
    return Array.isArray(result) ? result : [];
  }

  static async upsert(table: string, body: Record<string, unknown>): Promise<void> {
    await this.requestRest(
      'POST',
      `/${table}`,
      body,
      {
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      false,
    );
  }

  private static loadStoredSession(): SupabaseSession | null {
    const raw = globalThis.localStorage?.getItem(this.sessionStorageKey);
    return raw ? (JSON.parse(raw) as SupabaseSession) : null;
  }

  private static async requestAuth<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const config = this.requireConfig();
    const response = await fetch(`${config.url}/auth/v1${path}`, {
      method,
      headers: {
        apikey: config.anonKey,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    return this.parseResponse<T>(response);
  }

  private static async requestRest<T>(
    method: string,
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
    allowNotFoundObject = false,
  ): Promise<T> {
    const config = this.requireConfig();
    const session = this.session;
    const response = await fetch(`${config.url}/rest/v1${path}`, {
      method,
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${session?.access_token ?? config.anonKey}`,
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (allowNotFoundObject && response.status === 406) {
      return null as T;
    }

    return this.parseResponse<T>(response);
  }

  private static async parseResponse<T>(response: Response): Promise<T> {
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.warn(`[Supabase] Auth failed (${response.status}), falling back to local mode`);
      }
      throw new Error(data?.msg ?? data?.message ?? `Supabase request failed: ${response.status}`);
    }

    return data as T;
  }

  private static requireConfig(): SupabaseConfig {
    if (!this.config) {
      throw new Error('Supabase config is not initialized.');
    }

    return this.config;
  }
}
