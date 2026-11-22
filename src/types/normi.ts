export type UserRole = 'super_admin' | 'dean' | 'instructor';

export type CreatableUserRole = 'dean' | 'instructor';

export function formatRoleLabel(role: UserRole): string {
  if (role === 'super_admin') return 'Super Admin';
  if (role === 'dean') return 'Dean';
  return 'Instructor';
}

export interface ManagedUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type CollegeStatus = 'Active' | 'Archived';

export type CardStatus = 'active' | 'lost' | 'deactivated';

export type DeviceStatus = 'online' | 'offline';

export type LogType = 'IN' | 'OUT';

export type AttendanceStatus = 'present' | 'late' | 'denied';

export type SheetAttendanceStatus = 'present' | 'late' | 'absent';

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

export type YearLevel = '1st Year' | '2nd Year' | '3rd Year' | '4th Year';

export interface AuthSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  signedInAt: string;
}

export interface College {
  id: string;
  code: string; // e.g., CIT, CTE, CBA, CRIM, CHM
  name: string;
  deanName: string;
  status: CollegeStatus;
  createdAt: string;
}

export interface Room {
  id: string;
  roomCode: string; // e.g., LAB-1, EDTECH, RM-201
  name: string; // e.g., Computer Lab 1, EdTech Room, Room 201
  building: string; // e.g., Main Building — Ground Floor
  capacity: number;
  collegeId: string | null;
}

export interface DeviceNode {
  id: string;
  deviceUid: string; // e.g., EDTECH-01, CIT-LAB1
  roomId: string;
  apiKey: string;
  status: DeviceStatus;
  lastHeartbeat: string; // ISO timestamp
  firmwareVersion: string;
  offlineQueueCount: number;
  createdAt: string;
}

export interface Student {
  id: string;
  studentNumber: string; // unique e.g. 2026-00101
  fullName: string;
  collegeId: string;
  program: string; // e.g., BSIT, BSED, BSBA, BSCrim, BSHM
  yearLevel: YearLevel;
  rfidUid: string | null;
  cardStatus: CardStatus;
  createdAt: string;
}

export interface SubjectSchedule {
  id: string;
  subjectCode: string; // e.g., IT 301
  subjectName: string;
  collegeId: string;
  roomId: string;
  instructorName: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // HH:mm 24h
  endTime: string; // HH:mm 24h
  graceMinutes: number; // default 15
  enrolledStudentIds: string[];
}

export interface AccessLog {
  id: string;
  studentId: string | null;
  deviceId: string;
  roomId: string;
  scheduleId: string | null;
  rfidUid: string;
  logType: LogType;
  attendanceStatus: AttendanceStatus;
  tappedAt: string; // ISO timestamp
  syncedFromOffline?: boolean;
}

export interface AttendanceOverride {
  key: string; // `${scheduleId}::${dateStr}::${studentId}`
  scheduleId: string;
  date: string; // YYYY-MM-DD
  studentId: string;
  status: SheetAttendanceStatus;
  updatedBy: string;
  updatedAt: string;
}

export interface OfflineTapBufferedItem {
  id: string;
  deviceUid: string;
  rfidUid: string;
  tappedAt: string;
}
