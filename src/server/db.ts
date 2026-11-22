import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import mysql, { type Pool, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type DbRole = 'super_admin' | 'dean' | 'instructor';

export interface DbUserRow {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: DbRole;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface PublicUser {
  id: string;
  full_name: string;
  email: string;
  role: DbRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const isMySQL = process.env.DB_TYPE === 'mysql' || Boolean(process.env.MYSQL_DATABASE);

let mysqlPool: Pool | null = null;
let sqliteDb: DatabaseSync | null = null;

if (isMySQL) {
  mysqlPool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'admin',
    database: process.env.MYSQL_DATABASE || 'normi_attendance',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true,
  });
} else {
  const dataDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const dbPath = path.join(dataDir, 'normi.db');
  sqliteDb = new DatabaseSync(dbPath);
  sqliteDb.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'instructor' CHECK (role IN ('super_admin', 'dean', 'instructor')),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

export function getDatabaseType(): 'mysql' | 'sqlite' {
  return isMySQL ? 'mysql' : 'sqlite';
}

export async function testConnection(): Promise<boolean> {
  if (isMySQL && mysqlPool) {
    try {
      const [rows] = await mysqlPool.query('SELECT 1 as val');
      return Boolean(rows);
    } catch (err) {
      console.error('[MySQL Error] Connection test failed:', err);
      return false;
    }
  }
  return true;
}

// ---------- User Operations ----------
export async function getUserByEmail(email: string): Promise<DbUserRow | null> {
  const cleanEmail = email.trim().toLowerCase();
  if (isMySQL && mysqlPool) {
    const [rows] = await mysqlPool.execute<RowDataPacket[]>(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
      [cleanEmail]
    );
    if (!rows || rows.length === 0) return null;
    return rows[0] as DbUserRow;
  }

  if (sqliteDb) {
    const row = sqliteDb
      .prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1')
      .get(cleanEmail) as unknown as DbUserRow | undefined;
    return row ?? null;
  }

  return null;
}

export async function getUserById(id: string): Promise<DbUserRow | null> {
  if (isMySQL && mysqlPool) {
    const [rows] = await mysqlPool.execute<RowDataPacket[]>(
      'SELECT * FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    if (!rows || rows.length === 0) return null;
    return rows[0] as DbUserRow;
  }

  if (sqliteDb) {
    const row = sqliteDb
      .prepare('SELECT * FROM users WHERE id = ? LIMIT 1')
      .get(id) as unknown as DbUserRow | undefined;
    return row ?? null;
  }

  return null;
}

export async function hasSuperAdmin(): Promise<boolean> {
  if (isMySQL && mysqlPool) {
    const [rows] = await mysqlPool.execute<RowDataPacket[]>(
      "SELECT COUNT(*) as cnt FROM users WHERE role = 'super_admin'"
    );
    const cnt = Number(rows[0]?.cnt ?? 0);
    return cnt > 0;
  }

  if (sqliteDb) {
    const row = sqliteDb
      .prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'super_admin'")
      .get() as { cnt: number } | undefined;
    return Boolean(row && row.cnt > 0);
  }

  return false;
}

export async function createUser(user: {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: DbRole;
  is_active?: number;
}): Promise<void> {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const active = user.is_active ?? 1;

  if (isMySQL && mysqlPool) {
    await mysqlPool.execute(
      `INSERT INTO users (id, full_name, email, password_hash, role, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.full_name, user.email, user.password_hash, user.role, active, now, now]
    );
    return;
  }

  if (sqliteDb) {
    sqliteDb
      .prepare(
        `INSERT INTO users (id, full_name, email, password_hash, role, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(user.id, user.full_name, user.email, user.password_hash, user.role, active, now, now);
  }
}

export async function updateUser(
  id: string,
  fields: {
    full_name?: string;
    email?: string;
    password_hash?: string;
    role?: DbRole;
    is_active?: number;
  }
): Promise<void> {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const updates: string[] = [];
  const params: any[] = [];

  if (fields.full_name !== undefined) {
    updates.push('full_name = ?');
    params.push(fields.full_name);
  }
  if (fields.email !== undefined) {
    updates.push('email = ?');
    params.push(fields.email);
  }
  if (fields.password_hash !== undefined) {
    updates.push('password_hash = ?');
    params.push(fields.password_hash);
  }
  if (fields.role !== undefined) {
    updates.push('role = ?');
    params.push(fields.role);
  }
  if (fields.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(fields.is_active);
  }
  updates.push('updated_at = ?');
  params.push(now);

  params.push(id);

  const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

  if (isMySQL && mysqlPool) {
    await mysqlPool.execute(query, params);
    return;
  }

  if (sqliteDb) {
    sqliteDb.prepare(query).run(...params);
  }
}

export async function deleteUser(id: string): Promise<boolean> {
  if (isMySQL && mysqlPool) {
    const [res] = await mysqlPool.execute<ResultSetHeader>('DELETE FROM users WHERE id = ?', [id]);
    return res.affectedRows > 0;
  }

  if (sqliteDb) {
    const res = sqliteDb.prepare('DELETE FROM users WHERE id = ?').run(id);
    return Boolean(res && res.changes > 0);
  }

  return false;
}

export async function listUsers(roleFilter?: string, search?: string): Promise<DbUserRow[]> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (roleFilter && roleFilter !== 'all') {
    conditions.push('role = ?');
    params.push(roleFilter);
  }

  if (search) {
    conditions.push('(LOWER(full_name) LIKE ? OR LOWER(email) LIKE ?)');
    const term = `%${search.toLowerCase()}%`;
    params.push(term, term);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT id, full_name, email, role, is_active, created_at, updated_at
    FROM users
    ${where}
    ORDER BY CASE role WHEN 'super_admin' THEN 0 WHEN 'dean' THEN 1 ELSE 2 END, created_at DESC
  `;

  if (isMySQL && mysqlPool) {
    const [rows] = await mysqlPool.execute<RowDataPacket[]>(sql, params);
    return rows as DbUserRow[];
  }

  if (sqliteDb) {
    const rows = sqliteDb.prepare(sql).all(...params) as unknown as DbUserRow[];
    return rows;
  }

  return [];
}

// ---------- Operational Data Queries (MySQL) ----------
export async function getOperationalState() {
  if (!isMySQL || !mysqlPool) {
    return null;
  }

  try {
    const [colleges] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM colleges ORDER BY id ASC');
    const [rooms] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM rooms ORDER BY id ASC');
    const [devices] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM devices ORDER BY id ASC');
    const [students] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM students ORDER BY id ASC');
    const [schedules] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM schedules ORDER BY id ASC');
    const [accessLogs] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM access_logs ORDER BY tapped_at DESC LIMIT 500');

    return {
      colleges: colleges.map((c) => ({
        id: String(c.id),
        code: c.code,
        name: c.name,
        deanName: c.dean_name,
        status: c.status,
      })),
      rooms: rooms.map((r) => ({
        id: String(r.id),
        roomCode: r.room_code,
        name: r.name,
        building: r.building,
        capacity: Number(r.capacity),
        collegeId: r.college_id ? String(r.college_id) : null,
      })),
      devices: devices.map((d) => ({
        id: String(d.id),
        deviceUid: d.device_uid,
        roomId: String(d.room_id),
        firmwareVersion: d.firmware_version,
        apiKey: d.api_key,
        status: d.status,
        lastHeartbeat: d.last_heartbeat,
        offlineQueueCount: Number(d.offline_queue_count),
      })),
      students: students.map((s) => ({
        id: String(s.id),
        studentNumber: s.student_number,
        fullName: s.full_name,
        collegeId: String(s.college_id),
        program: s.program,
        yearLevel: s.year_level,
        rfidUid: s.rfid_uid,
        cardStatus: s.card_status,
      })),
      schedules: schedules.map((sc) => ({
        id: String(sc.id),
        subjectCode: sc.subject_code,
        subjectName: sc.subject_name,
        collegeId: String(sc.college_id),
        roomId: String(sc.room_id),
        instructorName: sc.instructor_name,
        dayOfWeek: sc.day_of_week,
        startTime: sc.start_time.slice(0, 5),
        endTime: sc.end_time.slice(0, 5),
        graceMinutes: Number(sc.grace_minutes),
      })),
      accessLogs: accessLogs.map((l) => ({
        id: String(l.id),
        rfidUid: l.rfid_uid,
        studentId: l.student_id ? String(l.student_id) : null,
        deviceId: l.device_id ? String(l.device_id) : '',
        roomId: String(l.room_id),
        scheduleId: l.schedule_id ? String(l.schedule_id) : null,
        logType: l.log_type,
        attendanceStatus: l.attendance_status,
        tappedAt: l.tapped_at,
        syncedFromOffline: Boolean(l.synced_from_offline),
      })),
    };
  } catch (err) {
    console.error('[MySQL Operational Error]:', err);
    return null;
  }
}

export async function purgeOperationalDataMySQL(): Promise<boolean> {
  if (!isMySQL || !mysqlPool) return false;

  const conn = await mysqlPool.getConnection();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE access_logs');
    await conn.query('TRUNCATE TABLE attendance_overrides');
    await conn.query('TRUNCATE TABLE schedules');
    await conn.query('TRUNCATE TABLE students');
    await conn.query('TRUNCATE TABLE devices');
    await conn.query('TRUNCATE TABLE rooms');
    await conn.query('TRUNCATE TABLE colleges');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    return true;
  } catch (err) {
    console.error('[MySQL Purge Error]:', err);
    return false;
  } finally {
    conn.release();
  }
}
