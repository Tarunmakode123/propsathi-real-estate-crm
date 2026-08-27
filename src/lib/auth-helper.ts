import { cookies } from 'next/headers';
import { verifyToken } from './auth';

export interface AuthenticatedSession {
  userId: string;
  tenantId: string;
  email: string;
  role: string;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'AuthError';
  }
}

const globalForAuth = global as unknown as { mockSessionToken?: string };

/**
 * Parses and verifies the secure session cookie.
 */
export async function getSession(): Promise<AuthenticatedSession | null> {
  try {
    let token = globalForAuth.mockSessionToken;
    
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get('session')?.value;
    }
    
    if (!token) return null;
    
    const payload = verifyToken(token);
    if (!payload || !payload.userId || !payload.tenantId) return null;
    
    return {
      userId: payload.userId,
      tenantId: payload.tenantId,
      email: payload.email,
      role: payload.role || 'agent',
    };
  } catch (err) {
    // Suppress context errors during testing if token is undefined
    if (globalForAuth.mockSessionToken) return null;
    console.error('Failed to parse session:', err);
    return null;
  }
}

/**
 * Asserts that the client has a valid session and is authorized for the requested tenantId.
 * Throws AuthError (401 for unauthenticated, 403 for cross-tenant mismatches).
 */
export async function authorizeTenant(requestedTenantId: string): Promise<AuthenticatedSession> {
  if (!requestedTenantId) {
    throw new AuthError('tenantId context is required', 400);
  }

  const session = await getSession();
  if (!session) {
    throw new AuthError('Unauthenticated. Please log in.', 401);
  }

  if (session.tenantId !== requestedTenantId) {
    throw new AuthError('Access Denied. Cross-tenant access is prohibited.', 403);
  }

  return session;
}
