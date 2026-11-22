import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  getUserByEmail,
  getUserById,
  hasSuperAdmin,
  createUser,
  updateUser,
  deleteUser,
  listUsers,
  getDatabaseType,
  testConnection,
  getOperationalState,
  purgeOperationalDataMySQL,
  type DbRole,
  type DbUserRow,
  type PublicUser,
} from './src/server/db';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT ?? 3000);
const DEFAULT_SUPER_ADMIN_EMAIL = (
  process.env.SUPER_ADMIN_EMAIL?.trim() || 'admin@normi.edu.ph'
).toLowerCase();
const DEFAULT_SUPER_ADMIN_NAME =
  process.env.SUPER_ADMIN_NAME?.trim() || 'NORMI Super Admin';
const ENV_SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD?.trim() || '';

// Session signing key: read from env or fall back to an ephemeral 256-bit in-memory key
const SESSION_SIGNING_KEY =
  process.env.SESSION_SECRET?.trim() || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_SECONDS = 60 * 60 * 24; // 24 hours

type CreatableRole = 'dean' | 'instructor';

interface TokenPayload {
  sub: string;
  role: DbRole;
  jti: string;
  iat: number;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  authUser?: PublicUser;
  authTokenJti?: string;
}

// ---------- Password Hashing (salted scrypt + constant-time verify) ----------
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hashHex] = parts;
  if (!salt || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N: 16384,
      r: 8,
      p: 1,
    });
    if (expected.length !== actual.length) return false;
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// ---------- HMAC-SHA256 Signed Bearer Tokens ----------
const revokedTokenIds = new Set<string>();

function signToken(user: { id: string; role: DbRole }): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sub: user.id,
    role: user.role,
    jti: crypto.randomUUID(),
    iat: nowSec,
    exp: nowSec + TOKEN_TTL_SECONDS,
  };
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
    'base64url'
  );
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
  return `${headerB64}.${payloadB64}.${signature}`;
}

function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(`${headerB64}.${payloadB64}`)
    .digest();

  let actualSig: Buffer;
  try {
    actualSig = Buffer.from(sigB64, 'base64url');
  } catch {
    return null;
  }

  if (expectedSig.length !== actualSig.length) return null;
  if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as TokenPayload;
    if (
      !parsed ||
      typeof parsed.sub !== 'string' ||
      typeof parsed.jti !== 'string' ||
      typeof parsed.exp !== 'number'
    ) {
      return null;
    }
    if (revokedTokenIds.has(parsed.jti)) return null;
    if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ---------- Helpers & Validation ----------
function sanitizeUser(row: DbUserRow): PublicUser {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.role,
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isCreatableRole(role: unknown): role is CreatableRole {
  return role === 'instructor' || role === 'dean';
}

// If SUPER_ADMIN_PASSWORD is configured in process.env, enforce/sync it on boot
async function syncEnvSuperAdmin(): Promise<void> {
  if (!ENV_SUPER_ADMIN_PASSWORD) return;
  const existing = await getUserByEmail(DEFAULT_SUPER_ADMIN_EMAIL);
  const passwordHash = hashPassword(ENV_SUPER_ADMIN_PASSWORD);

  if (existing) {
    await updateUser(existing.id, {
      role: 'super_admin',
      password_hash: passwordHash,
      is_active: 1,
    });
  } else {
    await createUser({
      id: crypto.randomUUID(),
      full_name: DEFAULT_SUPER_ADMIN_NAME,
      email: DEFAULT_SUPER_ADMIN_EMAIL,
      password_hash: passwordHash,
      role: 'super_admin',
      is_active: 1,
    });
  }
}

// ---------- Auth & RBAC Middleware ----------
async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const rawToken = authHeader.slice('Bearer '.length).trim();
  const payload = verifyToken(rawToken);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid token.' });
    return;
  }

  const row = await getUserById(payload.sub);

  if (!row) {
    res.status(401).json({ error: 'Account no longer exists.' });
    return;
  }

  if (!row.is_active) {
    res.status(403).json({ error: 'Your account has been deactivated. Contact a Super Admin.' });
    return;
  }

  req.authUser = sanitizeUser(row);
  req.authTokenJti = payload.jti;
  next();
}

function requireSuperAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (req.authUser.role !== 'super_admin') {
    res.status(403).json({
      error: 'Forbidden: Only Super Admin accounts can access User Management.',
    });
    return;
  }
  next();
}

// ---------- Express App & API Routes ----------
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));

// Public auth status check (indicates whether first-run Super Admin setup is needed)
app.get('/api/auth/status', async (_req: Request, res: Response) => {
  const adminExists = await hasSuperAdmin();
  const setupRequired = !ENV_SUPER_ADMIN_PASSWORD && !adminExists;
  res.json({
    setupRequired,
    defaultSuperAdminEmail: DEFAULT_SUPER_ADMIN_EMAIL,
    dbType: getDatabaseType(),
  });
});

// One-time first-run Super Admin setup
app.post('/api/auth/setup', async (req: Request, res: Response) => {
  if (ENV_SUPER_ADMIN_PASSWORD || (await hasSuperAdmin())) {
    res.status(409).json({
      error: 'Super Admin account is already initialized. Please sign in instead.',
    });
    return;
  }

  const fullName =
    typeof req.body?.full_name === 'string' ? req.body.full_name.trim() : '';
  const email =
    typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!fullName || fullName.length < 2 || fullName.length > 120) {
    res.status(400).json({ error: 'Full name must be between 2 and 120 characters.' });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (password.length < 8 || password.length > 128) {
    res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    return;
  }

  const id = crypto.randomUUID();
  const passwordHash = hashPassword(password);

  try {
    if (await hasSuperAdmin()) {
      res.status(409).json({
        error: 'Super Admin account is already initialized. Please sign in instead.',
      });
      return;
    }
    await createUser({
      id,
      full_name: fullName,
      email,
      password_hash: passwordHash,
      role: 'super_admin',
      is_active: 1,
    });
  } catch {
    res.status(409).json({ error: 'Super Admin account already exists.' });
    return;
  }

  const created = await getUserById(id);
  const user = sanitizeUser(created!);
  const token = signToken({ id: user.id, role: user.role });

  res.status(201).json({ token, user });
});

// Sign In (works for super_admin, dean, and instructor accounts)
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const email =
    typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const row = await getUserByEmail(email);

  if (!row || !verifyPassword(password, row.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  if (!row.is_active) {
    res.status(403).json({
      error: 'This account is inactive. Please contact a Super Admin to reactivate it.',
    });
    return;
  }

  const user = sanitizeUser(row);
  const token = signToken({ id: user.id, role: user.role });
  res.json({ token, user });
});

// Verify current session
app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.authUser });
});

// Logout & revoke active token
app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  if (req.authTokenJti) {
    revokedTokenIds.add(req.authTokenJti);
  }
  res.json({ ok: true });
});

// ---------- Super Admin User Management Endpoints (/api/users) ----------

// GET /api/users?role=dean|instructor&search=...
app.get(
  '/api/users',
  requireAuth,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    const roleFilter =
      typeof req.query.role === 'string' ? req.query.role.trim().toLowerCase() : '';
    const search =
      typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

    const rows = await listUsers(roleFilter, search);
    res.json({
      users: rows.map(sanitizeUser),
    });
  }
);

// POST /api/users — Super Admin creates ONLY 'instructor' or 'dean' accounts
app.post(
  '/api/users',
  requireAuth,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    const fullName =
      typeof req.body?.full_name === 'string' ? req.body.full_name.trim() : '';
    const email =
      typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const role = req.body?.role;

    if (!fullName || fullName.length < 2 || fullName.length > 120) {
      res.status(400).json({ error: 'Full name is required (2–120 characters).' });
      return;
    }

    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Please provide a valid institutional email address.' });
      return;
    }

    if (!isCreatableRole(role)) {
      res.status(400).json({ error: 'Role must be either "instructor" or "dean".' });
      return;
    }

    if (password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    const existing = await getUserByEmail(email);

    if (existing) {
      res.status(409).json({
        error: `A user account with email "${email}" already exists.`,
      });
      return;
    }

    const id = crypto.randomUUID();
    const passwordHash = hashPassword(password);

    await createUser({
      id,
      full_name: fullName,
      email,
      password_hash: passwordHash,
      role,
      is_active: 1,
    });

    const created = await getUserById(id);

    res.status(201).json({
      user: sanitizeUser(created!),
    });
  }
);

// PATCH /api/users/:id — Update user details, role, active status, or optional password reset
app.patch(
  '/api/users/:id',
  requireAuth,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    const targetId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!targetId) {
      res.status(400).json({ error: 'Invalid user ID.' });
      return;
    }

    const target = await getUserById(targetId);

    if (!target) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }

    const isSelf = req.authUser?.id === target.id;
    let nextFullName = target.full_name;
    let nextEmail = target.email;
    let nextRole: DbRole = target.role;
    let nextIsActive = Boolean(target.is_active);
    let nextPasswordHash: string | undefined = undefined;

    if (req.body?.full_name !== undefined) {
      const candidate =
        typeof req.body.full_name === 'string' ? req.body.full_name.trim() : '';
      if (!candidate || candidate.length < 2 || candidate.length > 120) {
        res.status(400).json({ error: 'Full name must be between 2 and 120 characters.' });
        return;
      }
      nextFullName = candidate;
    }

    if (req.body?.email !== undefined) {
      const candidate =
        typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (!isValidEmail(candidate)) {
        res.status(400).json({ error: 'Please provide a valid email address.' });
        return;
      }
      const duplicate = await getUserByEmail(candidate);
      if (duplicate && duplicate.id !== target.id) {
        res.status(409).json({
          error: `Email "${candidate}" is already assigned to another account.`,
        });
        return;
      }
      nextEmail = candidate;
    }

    if (req.body?.role !== undefined) {
      if (target.role === 'super_admin') {
        if (req.body.role !== 'super_admin') {
          res.status(400).json({ error: 'Super Admin role cannot be changed.' });
          return;
        }
      } else {
        if (!isCreatableRole(req.body.role)) {
          res.status(400).json({ error: 'Role must be either "instructor" or "dean".' });
          return;
        }
        nextRole = req.body.role;
      }
    }

    if (req.body?.is_active !== undefined) {
      const candidate = Boolean(req.body.is_active);
      if (target.role === 'super_admin' && !candidate) {
        res.status(400).json({ error: 'Super Admin accounts cannot be deactivated.' });
        return;
      }
      if (isSelf && !candidate) {
        res.status(400).json({ error: 'You cannot deactivate your own active session account.' });
        return;
      }
      nextIsActive = candidate;
    }

    if (req.body?.password !== undefined && req.body.password !== '') {
      const candidatePwd =
        typeof req.body.password === 'string' ? req.body.password : '';
      if (candidatePwd.length < 8 || candidatePwd.length > 128) {
        res.status(400).json({
          error: 'New password must be at least 8 characters long.',
        });
        return;
      }
      nextPasswordHash = hashPassword(candidatePwd);
    }

    await updateUser(target.id, {
      full_name: nextFullName,
      email: nextEmail,
      role: nextRole,
      is_active: nextIsActive ? 1 : 0,
      password_hash: nextPasswordHash,
    });

    const updated = await getUserById(target.id);

    res.json({
      user: sanitizeUser(updated!),
    });
  }
);

// DELETE /api/users/:id — Super Admin deletes an account (blocks self-deletion)
app.delete(
  '/api/users/:id',
  requireAuth,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    const targetId = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!targetId) {
      res.status(400).json({ error: 'Invalid user ID.' });
      return;
    }

    if (req.authUser?.id === targetId) {
      res.status(400).json({
        error: 'You cannot delete your own Super Admin account.',
      });
      return;
    }

    const existing = await getUserById(targetId);

    if (!existing) {
      res.status(404).json({ error: 'User account not found.' });
      return;
    }

    if (existing.role === 'super_admin') {
      res.status(400).json({ error: 'Super Admin accounts cannot be deleted.' });
      return;
    }

    await deleteUser(targetId);
    res.json({ deleted: true, id: targetId });
  }
);

// ---------- Operational MySQL Endpoints ----------

// GET /api/operational/state — Retrieve operational tables from MySQL
app.get('/api/operational/state', async (_req: Request, res: Response) => {
  const state = await getOperationalState();
  res.json({
    dbType: getDatabaseType(),
    state,
  });
});

// POST /api/operational/purge — Purge all operational records from MySQL
app.post(
  '/api/operational/purge',
  requireAuth,
  requireSuperAdmin,
  async (_req: AuthenticatedRequest, res: Response) => {
    const success = await purgeOperationalDataMySQL();
    res.json({
      success,
      message: 'Operational database records purged in MySQL.',
    });
  }
);

// Return JSON 404 for unknown /api/* routes
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// ---------- Vite Dev Middleware / Production Static Serving ----------
async function startServer() {
  const dbType = getDatabaseType();
  const connOk = await testConnection();
  console.log(`[Database] Active Engine: ${dbType.toUpperCase()} (Connected: ${connOk})`);

  await syncEnvSuperAdmin();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NORMI Attendance System server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start NORMI Attendance System server:', err);
  process.exit(1);
});
