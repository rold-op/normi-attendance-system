import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';
import {
  INITIAL_ACCESS_LOGS,
  INITIAL_COLLEGES,
  INITIAL_DEVICES,
  INITIAL_ROOMS,
  INITIAL_SCHEDULES,
  INITIAL_STUDENTS,
  TODAY_DOW,
} from '../data/normiSeed';
import type {
  AccessLog,
  AttendanceOverride,
  AttendanceStatus,
  CardStatus,
  College,
  CollegeStatus,
  DayOfWeek,
  DeviceNode,
  LogType,
  OfflineTapBufferedItem,
  Room,
  SheetAttendanceStatus,
  Student,
  SubjectSchedule,
  YearLevel,
} from '../types/normi';

const STORAGE_KEY = 'normi_attendance_system_v5_clean';

interface PersistedNormiState {
  colleges: College[];
  rooms: Room[];
  devices: DeviceNode[];
  students: Student[];
  schedules: SubjectSchedule[];
  accessLogs: AccessLog[];
  overrides: Record<string, AttendanceOverride>;
  offlineBuffers: OfflineTapBufferedItem[];
}

export interface RoomLiveSnapshot {
  room: Room;
  college: College | null;
  device: DeviceNode | null;
  status: 'Occupied' | 'Available' | 'Offline';
  activeSchedule: SubjectSchedule | null;
  headcount: number;
  lastScanAt: string | null;
}

interface NormiContextValue {
  colleges: College[];
  rooms: Room[];
  devices: DeviceNode[];
  students: Student[];
  schedules: SubjectSchedule[];
  accessLogs: AccessLog[];
  overrides: Record<string, AttendanceOverride>;
  offlineBuffers: OfflineTapBufferedItem[];
  // Lookups
  collegeById: Map<string, College>;
  roomById: Map<string, Room>;
  deviceById: Map<string, DeviceNode>;
  studentById: Map<string, Student>;
  scheduleById: Map<string, SubjectSchedule>;
  // Live monitoring snapshots
  roomSnapshots: RoomLiveSnapshot[];
  wsConnected: boolean;
  isCapturingRfid: boolean;
  setRfidCaptureListener: (listener: ((uid: string, deviceUid: string) => void) | null) => void;
  // College CRUD
  addCollege: (input: {
    code: string;
    name: string;
    deanName: string;
    status: CollegeStatus;
  }) => { success: boolean; error?: string };
  updateCollege: (
    id: string,
    input: { code: string; name: string; deanName: string; status: CollegeStatus }
  ) => { success: boolean; error?: string };
  toggleCollegeStatus: (id: string) => void;
  // Room CRUD
  addRoom: (input: {
    roomCode: string;
    name: string;
    building: string;
    capacity: number;
    collegeId: string | null;
  }) => { success: boolean; error?: string };
  updateRoom: (
    id: string,
    input: {
      roomCode: string;
      name: string;
      building: string;
      capacity: number;
      collegeId: string | null;
    }
  ) => { success: boolean; error?: string };
  deleteRoom: (id: string) => { success: boolean; error?: string };
  // Device CRUD & Hardware actions
  addDevice: (input: {
    deviceUid: string;
    roomId: string;
    firmwareVersion?: string;
    apiKey?: string;
  }) => { success: boolean; error?: string };
  updateDevice: (
    id: string,
    input: { deviceUid: string; roomId: string; firmwareVersion: string }
  ) => { success: boolean; error?: string };
  deleteDevice: (id: string) => void;
  regenerateDeviceApiKey: (id: string) => string;
  sendDeviceHeartbeat: (deviceUid: string) => void;
  toggleDeviceConnection: (deviceUid: string) => void;
  queueOfflineTap: (deviceUid: string) => void;
  syncDeviceOfflineBatch: (deviceUid: string) => void;
  // Student CRUD
  addStudent: (input: {
    studentNumber: string;
    fullName: string;
    collegeId: string;
    program: string;
    yearLevel: YearLevel;
    rfidUid: string | null;
    cardStatus: CardStatus;
  }) => { success: boolean; error?: string };
  updateStudent: (
    id: string,
    input: {
      studentNumber: string;
      fullName: string;
      collegeId: string;
      program: string;
      yearLevel: YearLevel;
      rfidUid: string | null;
      cardStatus: CardStatus;
    }
  ) => { success: boolean; error?: string };
  deleteStudent: (id: string) => void;
  // Schedule CRUD & Overrides
  addSchedule: (input: {
    subjectCode: string;
    subjectName: string;
    collegeId: string;
    roomId: string;
    instructorName: string;
    dayOfWeek: DayOfWeek;
    startTime: string;
    endTime: string;
    graceMinutes: number;
  }) => { success: boolean; error?: string };
  updateSchedule: (
    id: string,
    input: {
      subjectCode: string;
      subjectName: string;
      collegeId: string;
      roomId: string;
      instructorName: string;
      dayOfWeek: DayOfWeek;
      startTime: string;
      endTime: string;
      graceMinutes: number;
    }
  ) => { success: boolean; error?: string };
  deleteSchedule: (id: string) => void;
  setAttendanceOverride: (input: {
    scheduleId: string;
    date: string;
    studentId: string;
    status: SheetAttendanceStatus;
    updatedBy: string;
  }) => void;
  // Hardware Ingestion & Simulator
  ingestHardwareTap: (input: {
    deviceUid: string;
    rfidUid: string;
    tappedAt?: string;
    forceStatus?: AttendanceStatus;
  }) => { log: AccessLog | null; captured: boolean; bufferedOffline: boolean };
  simulateLiveTap: (options?: {
    deviceUid?: string;
    mode?: 'present' | 'late' | 'denied' | 'random';
  }) => void;
  purgeOperationalData: () => void;
}

const NormiContext = createContext<NormiContextValue | null>(null);

export function normalizeUid(raw: string): string {
  const hex = raw.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (hex.length >= 8) {
    return hex
      .slice(0, 8)
      .match(/.{1,2}/g)!
      .join(':');
  }
  return raw.trim().toUpperCase();
}

export function generateNormiApiKey(): string {
  const chars = 'abcdef0123456789';
  let out = 'normi_dev_';
  for (let i = 0; i < 24; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function generateRandomUid(existing: Set<string>): string {
  for (let i = 0; i < 40; i++) {
    const parts = Array.from({ length: 4 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0')
        .toUpperCase()
    );
    const uid = parts.join(':');
    if (!existing.has(uid)) return uid;
  }
  return 'F9:A2:10:CC';
}

function isSameLocalDate(iso: string, dateStr: string): boolean {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}` === dateStr;
}

export function getTodayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function getNextSequentialId(items: { id: string }[]): string {
  const max = items.reduce((acc, item) => {
    const num = parseInt(item.id.replace(/\D/g, ''), 10);
    return !isNaN(num) && num > acc ? num : acc;
  }, 0);
  return String(max + 1);
}

function loadState(): PersistedNormiState {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Purge all legacy storage keys from previous builds & seeds
      const legacyKeys = [
        'normi_attendance_system_v1',
        'normi_attendance_system_prod_v1',
        'normi_attendance_system_v2_clean',
        'normi_attendance_system_v4_clean',
        'normi_attendance_system_demo',
        'normi_purge_v4_executed',
      ];
      legacyKeys.forEach((k) => localStorage.removeItem(k));

      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith('normi_attendance_system_v') ||
            k.includes('normi_purge') ||
            k.includes('normi_demo'))
        ) {
          if (k !== STORAGE_KEY) {
            localStorage.removeItem(k);
          }
        }
      }

      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedNormiState;
        if (
          Array.isArray(parsed.colleges) &&
          Array.isArray(parsed.rooms) &&
          Array.isArray(parsed.devices) &&
          Array.isArray(parsed.students) &&
          Array.isArray(parsed.schedules) &&
          Array.isArray(parsed.accessLogs)
        ) {
          return {
            colleges: parsed.colleges,
            rooms: parsed.rooms,
            devices: parsed.devices,
            students: parsed.students,
            schedules: parsed.schedules,
            accessLogs: parsed.accessLogs,
            overrides: parsed.overrides ?? {},
            offlineBuffers: Array.isArray(parsed.offlineBuffers) ? parsed.offlineBuffers : [],
          };
        }
      }
    }
  } catch {
    // Fallback to empty state
  }

  return {
    colleges: [],
    rooms: [],
    devices: [],
    students: [],
    schedules: [],
    accessLogs: [],
    overrides: {},
    offlineBuffers: [],
  };
}

export function NormiProvider({ children }: { children: React.ReactNode }) {
  const [initial] = useState<PersistedNormiState>(() => loadState());
  const [colleges, setColleges] = useState<College[]>(initial.colleges);
  const [rooms, setRooms] = useState<Room[]>(initial.rooms);
  const [devices, setDevices] = useState<DeviceNode[]>(initial.devices);
  const [students, setStudents] = useState<Student[]>(initial.students);
  const [schedules, setSchedules] = useState<SubjectSchedule[]>(initial.schedules);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>(initial.accessLogs);
  const [overrides, setOverrides] = useState<Record<string, AttendanceOverride>>(initial.overrides);
  const [offlineBuffers, setOfflineBuffers] = useState<OfflineTapBufferedItem[]>(
    initial.offlineBuffers
  );
  const [isCapturingRfid, setIsCapturingRfid] = useState(false);

  const captureListenerRef = useRef<((uid: string, deviceUid: string) => void) | null>(null);
  const manuallyOfflineRef = useRef<Set<string>>(
    new Set(initial.devices.filter((d) => d.status === 'offline').map((d) => d.deviceUid))
  );

  // Hard purge check on mount to ensure zero stale mock items exist in user's browser
  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const legacyKeys = [
        'normi_attendance_system_v1',
        'normi_attendance_system_prod_v1',
        'normi_attendance_system_v2_clean',
        'normi_attendance_system_v4_clean',
        'normi_attendance_system_demo',
        'normi_purge_v4_executed',
      ];
      legacyKeys.forEach((k) => localStorage.removeItem(k));
    }
  }, []);

  // Sync operational state directly from MySQL backend
  useEffect(() => {
    fetch('/api/operational/state')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.state) {
          setColleges(Array.isArray(data.state.colleges) ? data.state.colleges : []);
          setRooms(Array.isArray(data.state.rooms) ? data.state.rooms : []);
          setDevices(Array.isArray(data.state.devices) ? data.state.devices : []);
          setStudents(Array.isArray(data.state.students) ? data.state.students : []);
          setSchedules(Array.isArray(data.state.schedules) ? data.state.schedules : []);
          setAccessLogs(Array.isArray(data.state.accessLogs) ? data.state.accessLogs : []);
        }
      })
      .catch(() => {});
  }, []);

  // Persist to localStorage
  useEffect(() => {
    try {
      const payload: PersistedNormiState = {
        colleges,
        rooms,
        devices,
        students,
        schedules,
        accessLogs,
        overrides,
        offlineBuffers,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [colleges, rooms, devices, students, schedules, accessLogs, overrides, offlineBuffers]);

  // 60-second heartbeat watchdog & simulated LAN heartbeats for online ESP32 nodes
  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      setDevices((prev) =>
        prev.map((dev) => {
          // If node is manually offline, verify >60s marks offline
          if (manuallyOfflineRef.current.has(dev.deviceUid)) {
            return dev.status === 'offline' ? dev : { ...dev, status: 'offline' };
          }
          // Active nodes send periodic heartbeat every ~20s; if heartbeat stale > 60s -> offline
          const ageMs = now - new Date(dev.lastHeartbeat).getTime();
          if (dev.status === 'online') {
            return { ...dev, lastHeartbeat: nowIso };
          }
          if (ageMs > 60_000 && dev.status !== 'offline') {
            return { ...dev, status: 'offline' };
          }
          return dev;
        })
      );
    }, 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const setRfidCaptureListener = useCallback(
    (listener: ((uid: string, deviceUid: string) => void) | null) => {
      captureListenerRef.current = listener;
      setIsCapturingRfid(Boolean(listener));
    },
    []
  );

  // Fast relational lookup maps
  const collegeById = useMemo(() => new Map(colleges.map((c) => [c.id, c])), [colleges]);
  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const deviceById = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);
  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const scheduleById = useMemo(() => new Map(schedules.map((s) => [s.id, s])), [schedules]);

  // Compute real-time room occupancy snapshots for Lab Monitoring
  const roomSnapshots = useMemo<RoomLiveSnapshot[]>(() => {
    const todayStr = getTodayDateString();
    const todayLogs = accessLogs.filter((l) => isSameLocalDate(l.tappedAt, todayStr));
    const deviceByRoomId = new Map<string, DeviceNode>();
    devices.forEach((d) => deviceByRoomId.set(d.roomId, d));

    return rooms.map((room) => {
      const college = room.collegeId ? collegeById.get(room.collegeId) ?? null : null;
      const device = deviceByRoomId.get(room.id) ?? null;

      // Active schedule for this room (prefer today's dayOfWeek)
      const roomSchedules = schedules.filter((s) => s.roomId === room.id);
      const activeSchedule =
        roomSchedules.find((s) => s.dayOfWeek === TODAY_DOW) ?? roomSchedules[0] ?? null;

      // Live headcount based on latest IN/OUT per student in this room today
      const roomLogs = todayLogs
        .filter((l) => l.roomId === room.id)
        .sort((a, b) => new Date(a.tappedAt).getTime() - new Date(b.tappedAt).getTime());

      const insideMap = new Map<string, LogType>();
      let lastScanAt: string | null = null;
      for (const l of roomLogs) {
        lastScanAt = l.tappedAt;
        if (l.studentId && l.attendanceStatus !== 'denied') {
          insideMap.set(l.studentId, l.logType);
        }
      }

      let headcount = 0;
      insideMap.forEach((t) => {
        if (t === 'IN') headcount++;
      });

      let status: 'Occupied' | 'Available' | 'Offline' = 'Available';
      if (!device || device.status === 'offline') {
        status = 'Offline';
      } else if (headcount > 0) {
        status = 'Occupied';
      } else {
        status = 'Available';
      }

      return {
        room,
        college,
        device,
        status,
        activeSchedule,
        headcount,
        lastScanAt,
      };
    });
  }, [accessLogs, collegeById, devices, rooms, schedules]);

  // --- COLLEGE CRUD ---
  const addCollege = useCallback(
    (input: { code: string; name: string; deanName: string; status: CollegeStatus }) => {
      const code = input.code.trim().toUpperCase();
      const name = input.name.trim();
      const deanName = input.deanName.trim();
      if (!code || !name || !deanName) {
        return { success: false, error: 'College code, name, and dean/head are required.' };
      }
      if (colleges.some((c) => c.code.toUpperCase() === code)) {
        return { success: false, error: `College code ${code} already exists.` };
      }
      const created: College = {
        id: getNextSequentialId(colleges),
        code,
        name,
        deanName,
        status: input.status,
        createdAt: new Date().toISOString(),
      };
      setColleges((prev) => [...prev, created]);
      toast.success(`Added ${code} — ${name}`);
      return { success: true };
    },
    [colleges]
  );

  const updateCollege = useCallback(
    (
      id: string,
      input: { code: string; name: string; deanName: string; status: CollegeStatus }
    ) => {
      const code = input.code.trim().toUpperCase();
      const name = input.name.trim();
      const deanName = input.deanName.trim();
      if (!code || !name || !deanName) {
        return { success: false, error: 'College code, name, and dean/head are required.' };
      }
      if (colleges.some((c) => c.id !== id && c.code.toUpperCase() === code)) {
        return { success: false, error: `College code ${code} is already in use.` };
      }
      setColleges((prev) =>
        prev.map((c) => (c.id === id ? { ...c, code, name, deanName, status: input.status } : c))
      );
      toast.success(`Updated college ${code}`);
      return { success: true };
    },
    [colleges]
  );

  const toggleCollegeStatus = useCallback((id: string) => {
    setColleges((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const nextStatus: CollegeStatus = c.status === 'Active' ? 'Archived' : 'Active';
        toast(`${c.code} marked as ${nextStatus}`);
        return { ...c, status: nextStatus };
      })
    );
  }, []);

  // --- ROOM CRUD ---
  const addRoom = useCallback(
    (input: {
      roomCode: string;
      name: string;
      building: string;
      capacity: number;
      collegeId: string | null;
    }) => {
      const roomCode = input.roomCode.trim().toUpperCase();
      const name = input.name.trim();
      const building = input.building.trim();
      if (!roomCode || !name || !building) {
        return { success: false, error: 'Room code, room name, and building/floor are required.' };
      }
      if (rooms.some((r) => r.roomCode.toUpperCase() === roomCode)) {
        return { success: false, error: `Room code ${roomCode} already exists.` };
      }
      const created: Room = {
        id: getNextSequentialId(rooms),
        roomCode,
        name,
        building,
        capacity: Math.max(1, Number(input.capacity) || 40),
        collegeId: input.collegeId || null,
      };
      setRooms((prev) => [...prev, created]);
      toast.success(`Created room ${roomCode} (${name})`);
      return { success: true };
    },
    [rooms]
  );

  const updateRoom = useCallback(
    (
      id: string,
      input: {
        roomCode: string;
        name: string;
        building: string;
        capacity: number;
        collegeId: string | null;
      }
    ) => {
      const roomCode = input.roomCode.trim().toUpperCase();
      const name = input.name.trim();
      const building = input.building.trim();
      if (!roomCode || !name || !building) {
        return { success: false, error: 'Room code, room name, and building/floor are required.' };
      }
      if (rooms.some((r) => r.id !== id && r.roomCode.toUpperCase() === roomCode)) {
        return { success: false, error: `Room code ${roomCode} is already in use.` };
      }
      setRooms((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                roomCode,
                name,
                building,
                capacity: Math.max(1, Number(input.capacity) || 40),
                collegeId: input.collegeId || null,
              }
            : r
        )
      );
      toast.success(`Updated room ${roomCode}`);
      return { success: true };
    },
    [rooms]
  );

  const deleteRoom = useCallback(
    (id: string) => {
      if (devices.some((d) => d.roomId === id)) {
        return {
          success: false,
          error: 'Unassign or delete the ESP32 device linked to this room first.',
        };
      }
      setRooms((prev) => prev.filter((r) => r.id !== id));
      toast.success('Room deleted');
      return { success: true };
    },
    [devices]
  );

  // --- DEVICE CRUD & HARDWARE ---
  const addDevice = useCallback(
    (input: { deviceUid: string; roomId: string; firmwareVersion?: string; apiKey?: string }) => {
      const deviceUid = input.deviceUid.trim().toUpperCase();
      if (!deviceUid || !input.roomId) {
        return { success: false, error: 'Device UID and assigned room are required.' };
      }
      if (devices.some((d) => d.deviceUid.toUpperCase() === deviceUid)) {
        return { success: false, error: `Device UID ${deviceUid} is already registered.` };
      }
      if (devices.some((d) => d.roomId === input.roomId)) {
        const rm = roomById.get(input.roomId);
        return {
          success: false,
          error: `${rm?.name ?? 'Selected room'} already has a registered RFID device.`,
        };
      }
      const created: DeviceNode = {
        id: getNextSequentialId(devices),
        deviceUid,
        roomId: input.roomId,
        apiKey: input.apiKey || generateNormiApiKey(),
        status: 'online',
        lastHeartbeat: new Date().toISOString(),
        firmwareVersion: input.firmwareVersion?.trim() || 'v2.5.0-esp32',
        offlineQueueCount: 0,
        createdAt: new Date().toISOString(),
      };
      manuallyOfflineRef.current.delete(deviceUid);
      setDevices((prev) => [...prev, created]);
      toast.success(`Registered node ${deviceUid}`);
      return { success: true };
    },
    [devices, roomById]
  );

  const updateDevice = useCallback(
    (id: string, input: { deviceUid: string; roomId: string; firmwareVersion: string }) => {
      const deviceUid = input.deviceUid.trim().toUpperCase();
      if (!deviceUid || !input.roomId) {
        return { success: false, error: 'Device UID and assigned room are required.' };
      }
      if (devices.some((d) => d.id !== id && d.deviceUid.toUpperCase() === deviceUid)) {
        return { success: false, error: `Device UID ${deviceUid} already exists.` };
      }
      if (devices.some((d) => d.id !== id && d.roomId === input.roomId)) {
        return { success: false, error: 'Another device is already assigned to that room.' };
      }
      setDevices((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                deviceUid,
                roomId: input.roomId,
                firmwareVersion: input.firmwareVersion.trim() || d.firmwareVersion,
              }
            : d
        )
      );
      toast.success(`Updated device ${deviceUid}`);
      return { success: true };
    },
    [devices]
  );

  const deleteDevice = useCallback((id: string) => {
    setDevices((prev) => prev.filter((d) => d.id !== id));
    toast.success('Device node removed');
  }, []);

  const regenerateDeviceApiKey = useCallback((id: string) => {
    const nextKey = generateNormiApiKey();
    setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, apiKey: nextKey } : d)));
    toast.success('Rotated X-Device-Key token');
    return nextKey;
  }, []);

  const sendDeviceHeartbeat = useCallback((deviceUid: string) => {
    const nowIso = new Date().toISOString();
    manuallyOfflineRef.current.delete(deviceUid);
    setDevices((prev) =>
      prev.map((d) =>
        d.deviceUid === deviceUid ? { ...d, status: 'online', lastHeartbeat: nowIso } : d
      )
    );
    toast.success(`Heartbeat received from ${deviceUid}`, {
      description: 'POST /api/hardware/heartbeat · Status online',
    });
  }, []);

  const toggleDeviceConnection = useCallback(
    (deviceUid: string) => {
      const target = devices.find((d) => d.deviceUid === deviceUid);
      if (!target) return;
      if (target.status === 'online') {
        manuallyOfflineRef.current.add(deviceUid);
        const staleIso = new Date(Date.now() - 90_000).toISOString();
        setDevices((prev) =>
          prev.map((d) =>
            d.deviceUid === deviceUid
              ? { ...d, status: 'offline', lastHeartbeat: staleIso }
              : d
          )
        );
        toast(`${deviceUid} marked Offline (heartbeat timeout > 60s)`);
      } else {
        manuallyOfflineRef.current.delete(deviceUid);
        setDevices((prev) =>
          prev.map((d) =>
            d.deviceUid === deviceUid
              ? { ...d, status: 'online', lastHeartbeat: new Date().toISOString() }
              : d
          )
        );
        toast.success(`${deviceUid} back Online`);
      }
    },
    [devices]
  );

  // --- STUDENT CRUD ---
  const addStudent = useCallback(
    (input: {
      studentNumber: string;
      fullName: string;
      collegeId: string;
      program: string;
      yearLevel: YearLevel;
      rfidUid: string | null;
      cardStatus: CardStatus;
    }) => {
      const studentNumber = input.studentNumber.trim();
      const fullName = input.fullName.trim();
      const program = input.program.trim();
      const rfidUid = input.rfidUid?.trim() ? normalizeUid(input.rfidUid) : null;

      if (!studentNumber || !fullName || !input.collegeId || !program) {
        return {
          success: false,
          error: 'Student number, full name, college, and program are required.',
        };
      }
      if (students.some((s) => s.studentNumber.toLowerCase() === studentNumber.toLowerCase())) {
        return { success: false, error: `Student number ${studentNumber} already exists.` };
      }
      if (rfidUid && students.some((s) => s.rfidUid?.toUpperCase() === rfidUid)) {
        return {
          success: false,
          error: `RFID UID ${rfidUid} is already bound to another student.`,
        };
      }

      const created: Student = {
        id: getNextSequentialId(students),
        studentNumber,
        fullName,
        collegeId: input.collegeId,
        program,
        yearLevel: input.yearLevel,
        rfidUid,
        cardStatus: input.cardStatus,
        createdAt: new Date().toISOString(),
      };
      setStudents((prev) => [created, ...prev]);
      toast.success(`Enrolled ${fullName}`);
      return { success: true };
    },
    [students]
  );

  const updateStudent = useCallback(
    (
      id: string,
      input: {
        studentNumber: string;
        fullName: string;
        collegeId: string;
        program: string;
        yearLevel: YearLevel;
        rfidUid: string | null;
        cardStatus: CardStatus;
      }
    ) => {
      const studentNumber = input.studentNumber.trim();
      const fullName = input.fullName.trim();
      const program = input.program.trim();
      const rfidUid = input.rfidUid?.trim() ? normalizeUid(input.rfidUid) : null;

      if (!studentNumber || !fullName || !input.collegeId || !program) {
        return {
          success: false,
          error: 'Student number, full name, college, and program are required.',
        };
      }
      if (
        students.some(
          (s) => s.id !== id && s.studentNumber.toLowerCase() === studentNumber.toLowerCase()
        )
      ) {
        return { success: false, error: `Student number ${studentNumber} is already in use.` };
      }
      if (rfidUid && students.some((s) => s.id !== id && s.rfidUid?.toUpperCase() === rfidUid)) {
        return {
          success: false,
          error: `RFID UID ${rfidUid} is already bound to another student.`,
        };
      }

      setStudents((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                studentNumber,
                fullName,
                collegeId: input.collegeId,
                program,
                yearLevel: input.yearLevel,
                rfidUid,
                cardStatus: input.cardStatus,
              }
            : s
        )
      );
      toast.success(`Updated student ${fullName}`);
      return { success: true };
    },
    [students]
  );

  const deleteStudent = useCallback((id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    setSchedules((prev) =>
      prev.map((sc) => ({
        ...sc,
        enrolledStudentIds: sc.enrolledStudentIds.filter((sid) => sid !== id),
      }))
    );
    toast.success('Student record deleted');
  }, []);

  // --- SCHEDULE CRUD & ATTENDANCE OVERRIDES ---
  const addSchedule = useCallback(
    (input: {
      subjectCode: string;
      subjectName: string;
      collegeId: string;
      roomId: string;
      instructorName: string;
      dayOfWeek: DayOfWeek;
      startTime: string;
      endTime: string;
      graceMinutes: number;
    }) => {
      const subjectCode = input.subjectCode.trim().toUpperCase();
      const subjectName = input.subjectName.trim();
      const instructorName = input.instructorName.trim();
      if (!subjectCode || !subjectName || !instructorName || !input.collegeId || !input.roomId) {
        return { success: false, error: 'All schedule fields are required.' };
      }
      if (input.endTime <= input.startTime) {
        return { success: false, error: 'End time must be after start time.' };
      }

      // Auto-enroll active students in that college for instant attendance tracking
      const collegeStudentIds = students
        .filter((s) => s.collegeId === input.collegeId)
        .map((s) => s.id);

      const created: SubjectSchedule = {
        id: getNextSequentialId(schedules),
        subjectCode,
        subjectName,
        collegeId: input.collegeId,
        roomId: input.roomId,
        instructorName,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        graceMinutes: Math.max(0, Number(input.graceMinutes) || 15),
        enrolledStudentIds: collegeStudentIds,
      };
      setSchedules((prev) => [created, ...prev]);
      toast.success(`Scheduled ${subjectCode} — ${subjectName}`);
      return { success: true };
    },
    [students]
  );

  const updateSchedule = useCallback(
    (
      id: string,
      input: {
        subjectCode: string;
        subjectName: string;
        collegeId: string;
        roomId: string;
        instructorName: string;
        dayOfWeek: DayOfWeek;
        startTime: string;
        endTime: string;
        graceMinutes: number;
      }
    ) => {
      const subjectCode = input.subjectCode.trim().toUpperCase();
      const subjectName = input.subjectName.trim();
      const instructorName = input.instructorName.trim();
      if (!subjectCode || !subjectName || !instructorName || !input.collegeId || !input.roomId) {
        return { success: false, error: 'All schedule fields are required.' };
      }
      if (input.endTime <= input.startTime) {
        return { success: false, error: 'End time must be after start time.' };
      }

      setSchedules((prev) =>
        prev.map((sc) =>
          sc.id === id
            ? {
                ...sc,
                subjectCode,
                subjectName,
                collegeId: input.collegeId,
                roomId: input.roomId,
                instructorName,
                dayOfWeek: input.dayOfWeek,
                startTime: input.startTime,
                endTime: input.endTime,
                graceMinutes: Math.max(0, Number(input.graceMinutes) || 15),
              }
            : sc
        )
      );
      toast.success(`Updated schedule ${subjectCode}`);
      return { success: true };
    },
    []
  );

  const deleteSchedule = useCallback((id: string) => {
    setSchedules((prev) => prev.filter((sc) => sc.id !== id));
    toast.success('Class schedule removed');
  }, []);

  const setAttendanceOverride = useCallback(
    (input: {
      scheduleId: string;
      date: string;
      studentId: string;
      status: SheetAttendanceStatus;
      updatedBy: string;
    }) => {
      const key = `${input.scheduleId}::${input.date}::${input.studentId}`;
      setOverrides((prev) => ({
        ...prev,
        [key]: {
          key,
          scheduleId: input.scheduleId,
          date: input.date,
          studentId: input.studentId,
          status: input.status,
          updatedBy: input.updatedBy,
          updatedAt: new Date().toISOString(),
        },
      }));
      toast.success(`Attendance status updated to ${input.status.toUpperCase()}`);
    },
    []
  );

  // --- HARDWARE INGESTION (/api/hardware/tap & /api/hardware/sync) ---
  const buildLogEntry = useCallback(
    (
      device: DeviceNode,
      rfidUid: string,
      tappedAt: string,
      runningLogs: AccessLog[],
      forceStatus?: AttendanceStatus,
      syncedFromOffline = false
    ): AccessLog => {
      const normalized = normalizeUid(rfidUid);
      const student = students.find((s) => s.rfidUid?.toUpperCase() === normalized) ?? null;
      const roomSchedules = schedules.filter((sc) => sc.roomId === device.roomId);
      const matchedSchedule =
        roomSchedules.find((sc) => sc.dayOfWeek === TODAY_DOW) ?? roomSchedules[0] ?? null;

      if (!student || student.cardStatus !== 'active') {
        return {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          studentId: student?.id ?? null,
          deviceId: device.id,
          roomId: device.roomId,
          scheduleId: matchedSchedule?.id ?? null,
          rfidUid: normalized,
          logType: 'IN',
          attendanceStatus: 'denied',
          tappedAt,
          syncedFromOffline,
        };
      }

      const dateStr = tappedAt.slice(0, 10);
      const prevStudentRoomLogs = runningLogs
        .filter(
          (l) =>
            l.studentId === student.id &&
            l.roomId === device.roomId &&
            l.attendanceStatus !== 'denied' &&
            isSameLocalDate(l.tappedAt, dateStr)
        )
        .sort((a, b) => new Date(b.tappedAt).getTime() - new Date(a.tappedAt).getTime());

      const nextLogType: LogType =
        prevStudentRoomLogs.length > 0 && prevStudentRoomLogs[0].logType === 'IN' ? 'OUT' : 'IN';

      let status: AttendanceStatus = forceStatus ?? 'present';
      if (!forceStatus && nextLogType === 'IN' && matchedSchedule) {
        const tapDate = new Date(tappedAt);
        const tapMins = tapDate.getHours() * 60 + tapDate.getMinutes();
        const startMins = timeToMinutes(matchedSchedule.startTime);
        const endMins = timeToMinutes(matchedSchedule.endTime);
        if (tapMins > startMins + matchedSchedule.graceMinutes && tapMins <= endMins) {
          status = 'late';
        }
      }

      return {
        id: getNextSequentialId(accessLogs),
        studentId: student.id,
        deviceId: device.id,
        roomId: device.roomId,
        scheduleId: matchedSchedule?.id ?? null,
        rfidUid: normalized,
        logType: nextLogType,
        attendanceStatus: status,
        tappedAt,
        syncedFromOffline,
      };
    },
    [schedules, students]
  );

  const ingestHardwareTap = useCallback(
    (input: {
      deviceUid: string;
      rfidUid: string;
      tappedAt?: string;
      forceStatus?: AttendanceStatus;
    }) => {
      const normalized = normalizeUid(input.rfidUid);
      const device =
        devices.find((d) => d.deviceUid === input.deviceUid) ??
        devices.find((d) => d.status === 'online') ??
        devices[0];

      if (!device) {
        return { log: null, captured: false, bufferedOffline: false };
      }

      if (captureListenerRef.current) {
        captureListenerRef.current(normalized, device.deviceUid);
        return { log: null, captured: true, bufferedOffline: false };
      }

      const tappedAt = input.tappedAt ?? new Date().toISOString();

      if (device.status === 'offline') {
        const item: OfflineTapBufferedItem = {
          id: `buf-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          deviceUid: device.deviceUid,
          rfidUid: normalized,
          tappedAt,
        };
        setOfflineBuffers((prev) => [...prev, item]);
        setDevices((prev) =>
          prev.map((d) =>
            d.id === device.id ? { ...d, offlineQueueCount: d.offlineQueueCount + 1 } : d
          )
        );
        toast(`${device.deviceUid} offline — tap buffered for batch sync`, {
          description: `UID ${normalized} queued locally on ESP32 flash.`,
        });
        return { log: null, captured: false, bufferedOffline: true };
      }

      const newLog = buildLogEntry(device, normalized, tappedAt, accessLogs, input.forceStatus);
      setAccessLogs((prev) => [newLog, ...prev]);
      setDevices((prev) =>
        prev.map((d) => (d.id === device.id ? { ...d, lastHeartbeat: tappedAt } : d))
      );

      const room = roomById.get(device.roomId);
      const stu = newLog.studentId ? studentById.get(newLog.studentId) : null;

      if (newLog.attendanceStatus === 'denied') {
        toast.error(`Access Denied — ${normalized}`, {
          description: stu
            ? `${stu.fullName} (card ${stu.cardStatus}) at ${room?.name ?? device.deviceUid}`
            : `Unregistered RFID card at ${room?.name ?? device.deviceUid}`,
        });
      } else if (newLog.attendanceStatus === 'late') {
        toast.warning(`${stu?.fullName ?? normalized} — Late (${newLog.logType})`, {
          description: `${room?.name ?? device.deviceUid} · ${device.deviceUid}`,
        });
      } else {
        toast.success(
          `${stu?.fullName ?? normalized} — ${newLog.logType === 'IN' ? 'Time-In' : 'Time-Out'}`,
          {
            description: `${room?.name ?? device.deviceUid} · ${device.deviceUid}`,
          }
        );
      }

      return { log: newLog, captured: false, bufferedOffline: false };
    },
    [accessLogs, buildLogEntry, devices, roomById, studentById]
  );

  const queueOfflineTap = useCallback(
    (deviceUid: string) => {
      const activeStudents = students.filter((s) => s.rfidUid && s.cardStatus === 'active');
      const pick = activeStudents[Math.floor(Math.random() * activeStudents.length)];
      if (!pick?.rfidUid) return;
      const item: OfflineTapBufferedItem = {
        id: `buf-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        deviceUid,
        rfidUid: pick.rfidUid,
        tappedAt: new Date().toISOString(),
      };
      setOfflineBuffers((prev) => [...prev, item]);
      setDevices((prev) =>
        prev.map((d) =>
          d.deviceUid === deviceUid ? { ...d, offlineQueueCount: d.offlineQueueCount + 1 } : d
        )
      );
      toast(`Buffered offline scan on ${deviceUid}`, {
        description: `${pick.fullName} (${pick.rfidUid})`,
      });
    },
    [students]
  );

  const syncDeviceOfflineBatch = useCallback(
    (deviceUid: string) => {
      const device = devices.find((d) => d.deviceUid === deviceUid);
      if (!device) return;
      const queued = offlineBuffers.filter((b) => b.deviceUid === deviceUid);
      if (queued.length === 0) {
        toast(`No buffered taps pending on ${deviceUid}`);
        return;
      }

      // Deduplicate against existing logs by deviceId + rfidUid + tappedAt
      const existingKeys = new Set(
        accessLogs.map((l) => `${l.deviceId}::${l.rfidUid}::${l.tappedAt}`)
      );

      const syncedLogs: AccessLog[] = [];
      let runningLogs = [...accessLogs];
      for (const item of queued) {
        const dedupeKey = `${device.id}::${normalizeUid(item.rfidUid)}::${item.tappedAt}`;
        if (existingKeys.has(dedupeKey)) continue;
        existingKeys.add(dedupeKey);
        const entry = buildLogEntry(
          device,
          item.rfidUid,
          item.tappedAt,
          runningLogs,
          undefined,
          true
        );
        syncedLogs.push(entry);
        runningLogs = [entry, ...runningLogs];
      }

      manuallyOfflineRef.current.delete(deviceUid);
      setAccessLogs((prev) =>
        [...syncedLogs, ...prev].sort(
          (a, b) => new Date(b.tappedAt).getTime() - new Date(a.tappedAt).getTime()
        )
      );
      setOfflineBuffers((prev) => prev.filter((b) => b.deviceUid !== deviceUid));
      setDevices((prev) =>
        prev.map((d) =>
          d.deviceUid === deviceUid
            ? {
                ...d,
                status: 'online',
                offlineQueueCount: 0,
                lastHeartbeat: new Date().toISOString(),
              }
            : d
        )
      );
      toast.success(`Synced ${syncedLogs.length} buffered tap(s) from ${deviceUid}`, {
        description: 'POST /api/hardware/sync · Duplicates skipped automatically',
      });
    },
    [accessLogs, buildLogEntry, devices, offlineBuffers]
  );

  const simulateLiveTap = useCallback(
    (options?: { deviceUid?: string; mode?: 'present' | 'late' | 'denied' | 'random' }) => {
      const mode = options?.mode ?? 'random';
      const onlineDevices = devices.filter((d) => d.status === 'online');
      const targetDevice =
        (options?.deviceUid ? devices.find((d) => d.deviceUid === options.deviceUid) : null) ??
        onlineDevices[Math.floor(Math.random() * onlineDevices.length)] ??
        devices[0];

      if (!targetDevice) return;

      const existingUids = new Set(
        students.map((s) => s.rfidUid?.toUpperCase()).filter((u): u is string => Boolean(u))
      );

      if (captureListenerRef.current) {
        const freshUid = generateRandomUid(existingUids);
        ingestHardwareTap({ deviceUid: targetDevice.deviceUid, rfidUid: freshUid });
        return;
      }

      const resolvedMode: 'present' | 'late' | 'denied' =
        mode === 'random'
          ? Math.random() < 0.16
            ? 'denied'
            : Math.random() < 0.28
            ? 'late'
            : 'present'
          : mode;

      if (resolvedMode === 'denied') {
        const freshUid = generateRandomUid(existingUids);
        ingestHardwareTap({
          deviceUid: targetDevice.deviceUid,
          rfidUid: freshUid,
          forceStatus: 'denied',
        });
        return;
      }

      const room = roomById.get(targetDevice.roomId);
      const activePool = students.filter((s) => s.cardStatus === 'active' && s.rfidUid);
      const collegePool = room?.collegeId
        ? activePool.filter((s) => s.collegeId === room.collegeId)
        : [];
      const pool = collegePool.length > 0 ? collegePool : activePool;
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      if (!chosen?.rfidUid) return;

      ingestHardwareTap({
        deviceUid: targetDevice.deviceUid,
        rfidUid: chosen.rfidUid,
        forceStatus: resolvedMode,
      });
    },
    [devices, ingestHardwareTap, roomById, students]
  );

  const purgeOperationalData = useCallback(() => {
    setColleges([]);
    setRooms([]);
    setDevices([]);
    setStudents([]);
    setSchedules([]);
    setAccessLogs([]);
    setOverrides({});
    setOfflineBuffers([]);
    fetch('/api/operational/purge', { method: 'POST' }).catch(() => {});
    if (typeof window !== 'undefined' && window.localStorage) {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (
          k &&
          (k.startsWith('normi_') || k.includes('normi')) &&
          k !== 'normi_attendance_auth_token' &&
          k !== 'normi_attendance_user' &&
          k !== 'normi_theme'
        ) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    }
    toast.success('Operational data purged cleanly for production.');
  }, []);

  return (
    <NormiContext.Provider
      value={{
        colleges,
        rooms,
        devices,
        students,
        schedules,
        accessLogs,
        overrides,
        offlineBuffers,
        collegeById,
        roomById,
        deviceById,
        studentById,
        scheduleById,
        roomSnapshots,
        wsConnected: true,
        isCapturingRfid,
        setRfidCaptureListener,
        addCollege,
        updateCollege,
        toggleCollegeStatus,
        addRoom,
        updateRoom,
        deleteRoom,
        addDevice,
        updateDevice,
        deleteDevice,
        regenerateDeviceApiKey,
        sendDeviceHeartbeat,
        toggleDeviceConnection,
        queueOfflineTap,
        syncDeviceOfflineBatch,
        addStudent,
        updateStudent,
        deleteStudent,
        addSchedule,
        updateSchedule,
        deleteSchedule,
        setAttendanceOverride,
        ingestHardwareTap,
        simulateLiveTap,
        purgeOperationalData,
      }}
    >
      {children}
    </NormiContext.Provider>
  );
}

export function useNormi(): NormiContextValue {
  const ctx = useContext(NormiContext);
  if (!ctx) {
    throw new Error('useNormi must be used within NormiProvider');
  }
  return ctx;
}
