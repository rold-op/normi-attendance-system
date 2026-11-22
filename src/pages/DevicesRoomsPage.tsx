import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  Check,
  Code2,
  Copy,
  Cpu,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UploadCloud,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDashboardSearch } from '../components/DashboardLayout';
import { NormiBadge } from '../components/NormiBadge';
import { Sparkline } from '../components/Sparkline';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { generateNormiApiKey, useNormi } from '../context/NormiContext';
import { cn } from '../lib/utils';
import type { DeviceNode, Room } from '../types/normi';

function formatRelativeSeconds(iso: string, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function buildDeviceSignalTrend(uid: string, online: boolean): number[] {
  let seed = 0;
  for (let i = 0; i < uid.length; i++) seed += uid.charCodeAt(i) * (i + 2);
  return Array.from({ length: 10 }, (_, idx) =>
    online
      ? Math.round(24 + Math.sin((seed + idx * 11) * 0.5) * 4 + idx * 0.4)
      : Math.max(4, Math.round(18 - idx * 1.4 + Math.cos(idx) * 2))
  );
}

export function DevicesRoomsPage() {
  const {
    colleges,
    rooms,
    devices,
    collegeById,
    roomById,
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
  } = useNormi();
  const { globalSearch } = useDashboardSearch();

  const [activeTab, setActiveTab] = useState<'rooms' | 'devices'>('devices');
  const [collegeFilter, setCollegeFilter] = useState<string>('all');
  const [showApiContract, setShowApiContract] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Room Modal State
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [roomName, setRoomName] = useState('');
  const [building, setBuilding] = useState('Main Building · 2nd Floor');
  const [capacity, setCapacity] = useState(45);
  const [roomCollegeId, setRoomCollegeId] = useState<string>('');
  const [roomError, setRoomError] = useState<string | null>(null);

  // Device Modal State
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceNode | null>(null);
  const [deviceUid, setDeviceUid] = useState('');
  const [deviceRoomId, setDeviceRoomId] = useState('');
  const [firmwareVersion, setFirmwareVersion] = useState('v2.5.0-esp32');
  const [apiKey, setApiKey] = useState('');
  const [deviceError, setDeviceError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const deviceByRoomId = useMemo(() => {
    const map = new Map<string, DeviceNode>();
    devices.forEach((d) => map.set(d.roomId, d));
    return map;
  }, [devices]);

  const filteredRooms = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return rooms.filter((r) => {
      if (collegeFilter !== 'all' && r.collegeId !== collegeFilter) return false;
      if (!q) return true;
      const col = r.collegeId ? collegeById.get(r.collegeId) : null;
      return (
        r.roomCode.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.building.toLowerCase().includes(q) ||
        (col?.code ?? '').toLowerCase().includes(q)
      );
    });
  }, [rooms, collegeFilter, globalSearch, collegeById]);

  const filteredDevices = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return devices.filter((d) => {
      const rm = roomById.get(d.roomId);
      if (collegeFilter !== 'all' && rm?.collegeId !== collegeFilter) return false;
      if (!q) return true;
      return (
        d.deviceUid.toLowerCase().includes(q) ||
        (rm?.name ?? '').toLowerCase().includes(q) ||
        (rm?.roomCode ?? '').toLowerCase().includes(q)
      );
    });
  }, [devices, roomById, collegeFilter, globalSearch]);

  const openCreateRoom = () => {
    setEditingRoom(null);
    setRoomCode('');
    setRoomName('');
    setBuilding('Main Building · 2nd Floor');
    setCapacity(45);
    setRoomCollegeId(collegeFilter !== 'all' ? collegeFilter : colleges[0]?.id ?? '');
    setRoomError(null);
    setRoomModalOpen(true);
  };

  const openEditRoom = (rm: Room) => {
    setEditingRoom(rm);
    setRoomCode(rm.roomCode);
    setRoomName(rm.name);
    setBuilding(rm.building);
    setCapacity(rm.capacity);
    setRoomCollegeId(rm.collegeId ?? '');
    setRoomError(null);
    setRoomModalOpen(true);
  };

  const handleSaveRoom = (e: React.FormEvent) => {
    e.preventDefault();
    setRoomError(null);
    const payload = {
      roomCode,
      name: roomName,
      building,
      capacity,
      collegeId: roomCollegeId || null,
    };
    const res = editingRoom ? updateRoom(editingRoom.id, payload) : addRoom(payload);
    if (!res.success) {
      setRoomError(res.error ?? 'Could not save room.');
      return;
    }
    setRoomModalOpen(false);
  };

  const handleDeleteRoom = (rm: Room) => {
    const res = deleteRoom(rm.id);
    if (!res.success && res.error) {
      toast.error(res.error);
    }
  };

  const openCreateDevice = (preselectedRoomId?: string) => {
    const availableRoom =
      (preselectedRoomId ? roomById.get(preselectedRoomId) : null) ??
      rooms.find((r) => !deviceByRoomId.has(r.id)) ??
      rooms[0];

    setEditingDevice(null);
    setDeviceRoomId(availableRoom?.id ?? '');
    setDeviceUid(availableRoom ? `NODE-${availableRoom.roomCode}` : 'NODE-01');
    setFirmwareVersion('v2.5.0-esp32');
    setApiKey(generateNormiApiKey());
    setDeviceError(null);
    setDeviceModalOpen(true);
  };

  const openEditDevice = (dev: DeviceNode) => {
    setEditingDevice(dev);
    setDeviceUid(dev.deviceUid);
    setDeviceRoomId(dev.roomId);
    setFirmwareVersion(dev.firmwareVersion);
    setApiKey(dev.apiKey);
    setDeviceError(null);
    setDeviceModalOpen(true);
  };

  const handleSaveDevice = (e: React.FormEvent) => {
    e.preventDefault();
    setDeviceError(null);
    const res = editingDevice
      ? updateDevice(editingDevice.id, { deviceUid, roomId: deviceRoomId, firmwareVersion })
      : addDevice({ deviceUid, roomId: deviceRoomId, firmwareVersion, apiKey });
    if (!res.success) {
      setDeviceError(res.error ?? 'Failed to register device.');
      return;
    }
    setDeviceModalOpen(false);
  };

  const copyText = async (id: string, value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(id);
      toast.success(`Copied ${label}`);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      toast.error('Clipboard permission unavailable');
    }
  };

  return (
    <div className="space-y-5">
      {/* Collapsible ESP32 Hardware Contract Panel */}
      {showApiContract && (
        <div className="normi-card p-5 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-[#0F172A]">
              ESP32 Hardware Ingestion Endpoints (Header:{' '}
              <span className="font-mono text-[#1E5628]">X-Device-Key</span>)
            </p>
            <span className="font-mono text-[11px] text-[#64748B]">
              Auto-offline timeout: 60s
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-[11px]">
            <div className="rounded-xl border border-[#1E5628]/20 bg-[#F2F7F3]/60 p-3.5 space-y-1">
              <p className="font-semibold text-[#1E5628]">POST /api/hardware/tap</p>
              <p className="text-[#64748B]">{`{ device_uid, rfid_uid, tapped_at }`}</p>
            </div>
            <div className="rounded-xl border border-[#1E5628]/20 bg-[#F2F7F3]/60 p-3.5 space-y-1">
              <p className="font-semibold text-[#1E5628]">POST /api/hardware/sync</p>
              <p className="text-[#64748B]">{`{ device_uid, taps: [...] } (deduped)`}</p>
            </div>
            <div className="rounded-xl border border-[#1E5628]/20 bg-[#F2F7F3]/60 p-3.5 space-y-1">
              <p className="font-semibold text-[#1E5628]">POST /api/hardware/heartbeat</p>
              <p className="text-[#64748B]">{`{ device_uid, firmware_version }`}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Floating Card Container */}
      <section aria-label="Devices and rooms management" className="normi-card overflow-hidden">
        <div className="px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 normi-divider-strong">
          <div>
            <h1 className="text-lg font-bold text-[#0F172A] tracking-tight">
              Devices &amp; Rooms
            </h1>
            <p className="text-xs text-[#64748B]">
              Campus room facilities across 4 floors and ESP32 + RC522 RFID terminals with 60s heartbeat monitoring.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 shrink-0">
            <div className="flex items-center gap-5 text-[13px]">
              <button
                type="button"
                onClick={() => setActiveTab('devices')}
                className={cn(
                  'transition-colors whitespace-nowrap',
                  activeTab === 'devices'
                    ? 'font-bold text-[#1E5628]'
                    : 'font-medium text-[#64748B] hover:text-[#1E5628]'
                )}
              >
                ESP32 Devices ({devices.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('rooms')}
                className={cn(
                  'transition-colors whitespace-nowrap',
                  activeTab === 'rooms'
                    ? 'font-bold text-[#1E5628]'
                    : 'font-medium text-[#64748B] hover:text-[#1E5628]'
                )}
              >
                Rooms ({rooms.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowApiContract((prev) => !prev)}
              >
                <Code2 className="h-3.5 w-3.5 text-[#1E5628]" aria-hidden="true" />
                <span>{showApiContract ? 'Hide API' : 'API Contract'}</span>
              </Button>
              {activeTab === 'rooms' ? (
                <Button variant="primary" size="md" onClick={openCreateRoom}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Add Room</span>
                </Button>
              ) : (
                <Button variant="primary" size="md" onClick={() => openCreateDevice()}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Register Device</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* College Filter Strip */}
        <div className="px-6 py-3 bg-[#F2F7F3]/50 border-b border-[#1E5628]/15 flex items-center justify-between gap-3">
          <select
            value={collegeFilter}
            onChange={(e) => setCollegeFilter(e.target.value)}
            aria-label="Filter by college"
            className="h-8 rounded-lg border border-[#1E5628]/30 bg-white px-2.5 text-xs font-medium text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
          >
            <option value="all">All Colleges</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>

          <span className="text-xs text-[#64748B] tabular-nums">
            {activeTab === 'devices'
              ? `${filteredDevices.length} registered scanner node${filteredDevices.length === 1 ? '' : 's'}`
              : `${filteredRooms.length} campus room${filteredRooms.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {/* TAB 1: ESP32 DEVICES */}
        {activeTab === 'devices' && (
          <div className="normi-row-divider">
            {filteredDevices.length === 0 ? (
              <div className="py-12 px-6 text-center text-xs text-[#64748B]">
                No registered ESP32 devices match your filter.
              </div>
            ) : (
              filteredDevices.map((dev) => {
                const rm = roomById.get(dev.roomId);
                const col = rm?.collegeId ? collegeById.get(rm.collegeId) : null;
                const maskedKey = `${dev.apiKey.slice(0, 12)}••••${dev.apiKey.slice(-4)}`;
                const isOnline = dev.status === 'online';

                return (
                  <div
                    key={dev.id}
                    className="px-6 py-4 grid grid-cols-1 xl:grid-cols-12 items-center gap-4 hover:bg-[#F2F7F3]/55 transition-colors"
                  >
                    <div className="xl:col-span-3 flex items-center gap-3.5 min-w-0">
                      <div
                        className={cn(
                          'h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-white',
                          isOnline
                            ? 'bg-gradient-to-br from-[#1E5628] to-[#16421E]'
                            : 'bg-[#DC2626]'
                        )}
                      >
                        <Cpu className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-[#0F172A] truncate">
                          {dev.deviceUid}
                        </p>
                        <p className="text-xs text-[#64748B] truncate">
                          {rm?.name ?? 'Unassigned'} &middot; {col?.code ?? 'GEN'}
                        </p>
                      </div>
                    </div>

                    <div className="xl:col-span-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-[#0F172A]">{maskedKey}</span>
                        <button
                          type="button"
                          onClick={() =>
                            void copyText(dev.id, dev.apiKey, `API Key for ${dev.deviceUid}`)
                          }
                          title="Copy API key"
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-[#64748B] hover:bg-[#EAF2EC] hover:text-[#1E5628]"
                        >
                          {copiedId === dev.id ? (
                            <Check className="h-3.5 w-3.5 text-[#1E5628]" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => regenerateDeviceApiKey(dev.id)}
                          title="Rotate API key"
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-[#64748B] hover:bg-[#EAF2EC] hover:text-[#1E5628]"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="font-mono text-[11px] text-[#64748B]">{dev.firmwareVersion}</p>
                    </div>

                    <div className="xl:col-span-2 flex xl:justify-center">
                      <Sparkline
                        data={buildDeviceSignalTrend(dev.deviceUid, isOnline)}
                        active={isOnline}
                      />
                    </div>

                    <div className="xl:col-span-2 flex flex-col xl:items-center gap-0.5">
                      <NormiBadge variant={dev.status} />
                      <span className="font-mono text-[11px] text-[#64748B] tabular-nums">
                        Ping {formatRelativeSeconds(dev.lastHeartbeat, nowMs)}
                      </span>
                    </div>

                    <div className="xl:col-span-1 text-left xl:text-right">
                      <p className="font-mono text-xs font-semibold text-[#0F172A] tabular-nums">
                        {dev.offlineQueueCount} queued
                      </p>
                      {dev.offlineQueueCount > 0 ? (
                        <button
                          type="button"
                          onClick={() => syncDeviceOfflineBatch(dev.deviceUid)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E5628] hover:underline whitespace-nowrap"
                        >
                          <UploadCloud className="h-3 w-3" />
                          <span>Sync Batch</span>
                        </button>
                      ) : (
                        !isOnline && (
                          <button
                            type="button"
                            onClick={() => queueOfflineTap(dev.deviceUid)}
                            className="text-[11px] text-[#64748B] hover:text-[#1E5628] underline whitespace-nowrap"
                          >
                            + Queue Tap
                          </button>
                        )
                      )}
                    </div>

                    <div className="xl:col-span-2 flex items-center xl:justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendDeviceHeartbeat(dev.deviceUid)}
                      >
                        <Activity className="h-3.5 w-3.5 text-[#1E5628]" />
                        <span>Ping</span>
                      </Button>
                      <button
                        type="button"
                        onClick={() => toggleDeviceConnection(dev.deviceUid)}
                        title={isOnline ? 'Simulate offline' : 'Reconnect'}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E5628]/25 bg-white text-[#64748B] hover:border-[#1E5628]"
                      >
                        {isOnline ? (
                          <WifiOff className="h-3.5 w-3.5 text-[#DC2626]" />
                        ) : (
                          <Wifi className="h-3.5 w-3.5 text-[#1E5628]" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditDevice(dev)}
                        aria-label={`Edit ${dev.deviceUid}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E5628]/25 bg-white text-[#64748B] hover:text-[#1E5628]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDevice(dev.id)}
                        aria-label={`Delete ${dev.deviceUid}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E5628]/25 bg-white text-[#64748B] hover:text-[#DC2626]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: ROOMS */}
        {activeTab === 'rooms' && (
          <div className="normi-row-divider">
            {filteredRooms.length === 0 ? (
              <div className="py-12 px-6 text-center text-xs text-[#64748B]">
                No rooms match your filter criteria.
              </div>
            ) : (
              filteredRooms.map((rm) => {
                const col = rm.collegeId ? collegeById.get(rm.collegeId) : null;
                const dev = deviceByRoomId.get(rm.id);

                return (
                  <div
                    key={rm.id}
                    className="px-6 py-4 grid grid-cols-1 lg:grid-cols-12 items-center gap-4 hover:bg-[#F2F7F3]/55 transition-colors"
                  >
                    <div className="lg:col-span-4 flex items-center gap-3.5 min-w-0">
                      <div
                        className={cn(
                          'h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-white font-mono text-[11px] font-bold',
                          dev
                            ? 'bg-gradient-to-br from-[#1E5628] to-[#16421E]'
                            : 'bg-[#64748B]'
                        )}
                      >
                        {col?.code ?? <Building2 className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0F172A] truncate">{rm.name}</p>
                        <p className="font-mono text-xs text-[#64748B] truncate">
                          {rm.roomCode} &middot; {rm.building}
                        </p>
                      </div>
                    </div>

                    <div className="lg:col-span-2 text-left lg:text-right tabular-nums">
                      <p className="text-sm font-semibold text-[#0F172A]">
                        Cap. {rm.capacity}
                      </p>
                      <p className="text-xs text-[#64748B]">{col ? col.code : 'Shared'}</p>
                    </div>

                    <div className="lg:col-span-4 flex items-center lg:justify-center gap-3">
                      {dev ? (
                        <>
                          <span className="font-mono text-xs font-semibold text-[#0F172A]">
                            {dev.deviceUid}
                          </span>
                          <NormiBadge variant={dev.status} />
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openCreateDevice(rm.id)}
                          className="text-xs font-semibold text-[#1E5628] hover:underline underline-offset-4"
                        >
                          + Assign ESP32 Scanner
                        </button>
                      )}
                    </div>

                    <div className="lg:col-span-2 flex items-center lg:justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditRoom(rm)}
                        aria-label={`Edit ${rm.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E5628]/25 bg-white text-[#64748B] hover:text-[#1E5628]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRoom(rm)}
                        aria-label={`Delete ${rm.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E5628]/25 bg-white text-[#64748B] hover:text-[#DC2626]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>

      {/* Room Create/Edit Modal */}
      <Modal
        open={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        title={editingRoom ? 'Edit Room Facility' : 'Add Room Facility'}
        description="Register a physical campus laboratory or classroom."
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSaveRoom} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="rm-code"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Room Code
              </label>
              <input
                id="rm-code"
                type="text"
                required
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="RM-215"
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 font-mono text-xs uppercase text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="rm-cap"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Capacity
              </label>
              <input
                id="rm-cap"
                type="number"
                min={1}
                max={300}
                required
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 font-mono text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="rm-name"
              className="block text-xs font-semibold text-[#0F172A] mb-1.5"
            >
              Room Name
            </label>
            <input
              id="rm-name"
              type="text"
              required
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Computer Laboratory 3"
              className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="rm-bldg"
              className="block text-xs font-semibold text-[#0F172A] mb-1.5"
            >
              Building / Floor
            </label>
            <input
              id="rm-bldg"
              type="text"
              required
              value={building}
              onChange={(e) => setBuilding(e.target.value)}
              placeholder="Main Building · 2nd Floor"
              className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="rm-col"
              className="block text-xs font-semibold text-[#0F172A] mb-1.5"
            >
              Assigned College (Optional)
            </label>
            <select
              id="rm-col"
              value={roomCollegeId}
              onChange={(e) => setRoomCollegeId(e.target.value)}
              className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
            >
              <option value="">Shared / General Purpose</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          {roomError && (
            <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#DC2626]">
              {roomError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <Button variant="outline" size="md" onClick={() => setRoomModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md">
              {editingRoom ? 'Save Room' : 'Add Room'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Device Create/Edit Modal */}
      <Modal
        open={deviceModalOpen}
        onClose={() => setDeviceModalOpen(false)}
        title={editingDevice ? 'Edit ESP32 RFID Device' : 'Register ESP32 RFID Device'}
        description="Provision an ESP32 + RC522 scanner node and link it to a campus room."
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSaveDevice} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="dev-uid"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Device UID
              </label>
              <input
                id="dev-uid"
                type="text"
                required
                value={deviceUid}
                onChange={(e) => setDeviceUid(e.target.value.toUpperCase())}
                placeholder="CIT-LAB2"
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 font-mono text-xs uppercase text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="dev-fw"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Firmware
              </label>
              <input
                id="dev-fw"
                type="text"
                required
                value={firmwareVersion}
                onChange={(e) => setFirmwareVersion(e.target.value)}
                placeholder="v2.5.0-esp32"
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 font-mono text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="dev-room"
              className="block text-xs font-semibold text-[#0F172A] mb-1.5"
            >
              Assigned Room
            </label>
            <select
              id="dev-room"
              value={deviceRoomId}
              onChange={(e) => setDeviceRoomId(e.target.value)}
              className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
            >
              {rooms.map((rm) => {
                const col = rm.collegeId ? collegeById.get(rm.collegeId) : null;
                const taken =
                  deviceByRoomId.has(rm.id) && deviceByRoomId.get(rm.id)?.id !== editingDevice?.id;
                return (
                  <option key={rm.id} value={rm.id}>
                    [{col?.code ?? 'GEN'}] {rm.name} ({rm.roomCode})
                    {taken ? ' — Assigned' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {!editingDevice && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#0F172A]">
                  Generated API Key (<span className="font-mono">X-Device-Key</span>)
                </label>
                <button
                  type="button"
                  onClick={() => setApiKey(generateNormiApiKey())}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1E5628] hover:underline"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Regenerate</span>
                </button>
              </div>
              <input
                type="text"
                readOnly
                value={apiKey}
                className="h-9 w-full rounded-xl border border-[#1E5628]/25 bg-[#F2F7F3] px-3 font-mono text-[11px] text-[#0F172A] focus:outline-none"
              />
            </div>
          )}

          {deviceError && (
            <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#DC2626]">
              {deviceError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <Button variant="outline" size="md" onClick={() => setDeviceModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md">
              {editingDevice ? 'Save Device' : 'Register Node'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
