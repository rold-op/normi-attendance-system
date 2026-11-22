import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  Radio,
  ShieldAlert,
} from 'lucide-react';
import { NormiBadge } from '../components/NormiBadge';
import { NormiLogo } from '../components/NormiLogo';
import { Button } from '../components/ui/Button';
import { useNormi } from '../context/NormiContext';
import { cn, getInitials } from '../lib/utils';

function formatKioskClock(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatKioskDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function KioskPage() {
  const {
    devices,
    accessLogs,
    roomSnapshots,
    roomById,
    studentById,
    collegeById,
    ingestHardwareTap,
    simulateLiveTap,
  } = useNormi();

  const onlineDevices = useMemo(
    () => devices.filter((d) => d.status === 'online'),
    [devices]
  );

  const [selectedDeviceUid, setSelectedDeviceUid] = useState<string>(
    onlineDevices[0]?.deviceUid ?? devices[0]?.deviceUid ?? ''
  );
  const [wedgeInput, setWedgeInput] = useState('');
  const [now, setNow] = useState(() => new Date());
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const activeDevice =
    devices.find((d) => d.deviceUid === selectedDeviceUid) ?? devices[0] ?? null;
  const activeSnapshot = activeDevice
    ? roomSnapshots.find((s) => s.room.id === activeDevice.roomId) ?? null
    : null;

  const kioskLogs = useMemo(() => {
    if (!activeDevice) return accessLogs.slice(0, 10);
    return accessLogs
      .filter((l) => l.deviceId === activeDevice.id || l.roomId === activeDevice.roomId)
      .slice(0, 10);
  }, [accessLogs, activeDevice]);

  const latestScan = kioskLogs[0] ?? null;
  const latestStudent =
    latestScan?.studentId ? studentById.get(latestScan.studentId) ?? null : null;
  const latestCollege = latestStudent
    ? collegeById.get(latestStudent.collegeId) ?? null
    : activeSnapshot?.college ?? null;

  const handleWedgeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const uid = wedgeInput.trim();
    if (!uid || !activeDevice) return;
    ingestHardwareTap({
      deviceUid: activeDevice.deviceUid,
      rfidUid: uid,
    });
    setWedgeInput('');
    inputRef.current?.focus();
  };

  const scanState = latestScan
    ? latestScan.attendanceStatus === 'denied'
      ? 'denied'
      : latestScan.attendanceStatus === 'late'
      ? 'late'
      : 'present'
    : 'idle';

  return (
    <div className="min-h-screen bg-[#F2F7F3] text-[#0F172A] flex flex-col">
      {/* Compact Institutional Kiosk Header with 56x56 Official NORMI Logo */}
      <header className="bg-white border-b border-[#1E5628]/20 px-5 sm:px-8 py-3.5 shrink-0">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <Link
              to="/dashboard/monitoring"
              aria-label="Return to NORMI Dashboard"
              className="shrink-0"
            >
              <NormiLogo size="kiosk" />
            </Link>
            <div className="min-w-0">
              <p className="text-base sm:text-lg font-bold tracking-tight text-[#0F172A] leading-tight truncate">
                Northern Mindanao Colleges, Inc.
              </p>
              <p className="text-xs font-medium text-[#64748B] truncate mt-0.5">
                {activeSnapshot?.activeSchedule
                  ? `${activeSnapshot.activeSchedule.subjectCode} — ${activeSnapshot.activeSchedule.subjectName} (${activeSnapshot.room.name})`
                  : activeSnapshot
                  ? `${activeSnapshot.room.name} · Open RFID Attendance Session`
                  : 'NORMI Attendance System · Live RFID Scanner Kiosk'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <select
              value={activeDevice?.deviceUid ?? ''}
              onChange={(e) => setSelectedDeviceUid(e.target.value)}
              aria-label="Select active kiosk terminal"
              className="h-9 rounded-xl border border-[#1E5628]/30 bg-white px-3 font-mono text-xs font-medium text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
            >
              {devices.map((d) => {
                const rm = roomById.get(d.roomId);
                return (
                  <option key={d.id} value={d.deviceUid}>
                    {d.deviceUid} — {rm?.name ?? 'Room'}
                  </option>
                );
              })}
            </select>

            <div className="text-right tabular-nums hidden sm:block">
              <p className="font-mono text-lg font-bold text-[#1E5628] leading-none">
                {formatKioskClock(now)}
              </p>
              <p className="text-[11px] text-[#64748B] mt-1">{formatKioskDate(now)}</p>
            </div>

            <Link
              to="/dashboard/monitoring"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#1E5628]/30 bg-white px-3.5 text-xs font-semibold text-[#1E5628] hover:bg-[#EAF2EC] transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Dashboard</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Kiosk Viewport: Live Scan Status + Real-Time Feed */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-5 sm:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Columns: Live Scan Hero Card & USB-Wedge Terminal Bar */}
        <section aria-label="Live RFID scan status" className="lg:col-span-7 space-y-5">
          <div className="normi-card overflow-hidden">
            <div
              className={cn(
                'h-2 w-full',
                scanState === 'denied'
                  ? 'bg-[#DC2626]'
                  : scanState === 'late'
                  ? 'bg-[#F5A61C]'
                  : 'bg-[#1E5628]'
              )}
            />

            <div className="p-8 sm:p-10 flex flex-col items-center text-center">
              {scanState === 'idle' || !latestScan ? (
                <>
                  <div className="h-20 w-20 rounded-full bg-[#EAF2EC] text-[#1E5628] flex items-center justify-center mb-5">
                    <Radio className="h-9 w-9" aria-hidden="true" />
                  </div>
                  <h1 className="text-2xl font-bold text-[#0F172A]">Ready for RFID Card Tap</h1>
                  <p className="mt-2 text-sm text-[#64748B] max-w-md">
                    Hold your NORMI student ID near the RC522 terminal to record attendance automatically.
                  </p>
                </>
              ) : (
                <>
                  <div
                    className={cn(
                      'h-20 w-20 rounded-full flex items-center justify-center mb-5 text-white',
                      scanState === 'denied'
                        ? 'bg-[#DC2626]'
                        : scanState === 'late'
                        ? 'bg-[#F5A61C] text-[#0F172A]'
                        : 'bg-[#1E5628]'
                    )}
                  >
                    {scanState === 'denied' ? (
                      <ShieldAlert className="h-10 w-10" aria-hidden="true" />
                    ) : scanState === 'late' ? (
                      <Clock className="h-10 w-10" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
                    )}
                  </div>

                  <p
                    className={cn(
                      'text-xs font-bold uppercase tracking-wider',
                      scanState === 'denied'
                        ? 'text-[#DC2626]'
                        : scanState === 'late'
                        ? 'text-[#B47209]'
                        : 'text-[#1E5628]'
                    )}
                  >
                    {scanState === 'denied'
                      ? 'Access Denied · Unregistered or Inactive Card'
                      : scanState === 'late'
                      ? `Recorded Late · ${latestScan.logType === 'IN' ? 'Time-In' : 'Time-Out'}`
                      : `Attendance Verified · ${latestScan.logType === 'IN' ? 'Time-In' : 'Time-Out'}`}
                  </p>

                  <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0F172A]">
                    {latestStudent ? latestStudent.fullName : 'Unregistered RFID Card'}
                  </h1>

                  <p className="mt-2 font-mono text-sm text-[#64748B] tabular-nums">
                    {latestStudent
                      ? `${latestStudent.studentNumber} · ${latestCollege?.code ?? 'NORMI'} · ${latestStudent.program} (${latestStudent.yearLevel})`
                      : `Card UID: ${latestScan.rfidUid}`}
                  </p>

                  <div className="mt-6 pt-5 border-t border-[#1E5628]/18 w-full max-w-md flex items-center justify-around text-xs tabular-nums">
                    <div>
                      <span className="text-[#64748B] block">Timestamp</span>
                      <span className="font-mono font-semibold text-[#0F172A] mt-0.5 block">
                        {formatKioskClock(new Date(latestScan.tappedAt))}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block">Terminal</span>
                      <span className="font-mono font-semibold text-[#1E5628] mt-0.5 block">
                        {activeDevice?.deviceUid ?? '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#64748B] block">Occupancy</span>
                      <span className="font-mono font-semibold text-[#0F172A] mt-0.5 block">
                        {activeSnapshot?.headcount ?? 0}/{activeSnapshot?.room.capacity ?? 40}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* USB Keyboard-Wedge RFID Input + Quick Simulation Bar */}
          <div className="normi-card p-5 space-y-3">
            <form onSubmit={handleWedgeSubmit} className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[220px]">
                <CreditCard
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1E5628]"
                  aria-hidden="true"
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={wedgeInput}
                  onChange={(e) => setWedgeInput(e.target.value.toUpperCase())}
                  placeholder="Scan USB RFID card or type UID (e.g. A4:3F:91:C2) and press Enter..."
                  className="h-10 w-full rounded-xl border border-[#1E5628]/35 bg-white pl-10 pr-3 font-mono text-xs uppercase text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E5628] focus:outline-none"
                />
              </div>
              <Button type="submit" variant="primary" size="md">
                Record Tap
              </Button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <span className="text-[#64748B]">Simulate scanner events on {activeDevice?.deviceUid}:</span>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    simulateLiveTap({
                      deviceUid: activeDevice?.deviceUid,
                      mode: 'present',
                    })
                  }
                >
                  Test Present
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    simulateLiveTap({
                      deviceUid: activeDevice?.deviceUid,
                      mode: 'late',
                    })
                  }
                >
                  Test Late
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    simulateLiveTap({
                      deviceUid: activeDevice?.deviceUid,
                      mode: 'denied',
                    })
                  }
                >
                  Test Denied
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Right 5 Columns: Live Attendance Feed */}
        <section aria-label="Recent kiosk scans" className="lg:col-span-5 normi-card overflow-hidden">
          <div className="px-6 py-4 border-b-2 normi-divider-strong flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0F172A]">Live Session Feed</h2>
            <span className="font-mono text-xs text-[#1E5628] tabular-nums">
              {kioskLogs.length} recent scan{kioskLogs.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="normi-row-divider max-h-[540px] overflow-y-auto">
            {kioskLogs.length === 0 ? (
              <div className="py-12 px-6 text-center text-xs text-[#64748B]">
                No RFID scans recorded on this terminal yet.
              </div>
            ) : (
              kioskLogs.map((log) => {
                const stu = log.studentId ? studentById.get(log.studentId) : null;
                const badgeVariant =
                  log.attendanceStatus === 'denied'
                    ? 'unauthorized'
                    : log.attendanceStatus === 'late'
                    ? 'late'
                    : 'present';
                return (
                  <div
                    key={log.id}
                    className="px-6 py-3.5 flex items-center justify-between gap-3 hover:bg-[#F2F7F3]/55 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          'h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
                          log.attendanceStatus === 'denied'
                            ? 'bg-[#DC2626] text-white'
                            : log.attendanceStatus === 'late'
                            ? 'bg-[#F5A61C] text-[#0F172A]'
                            : 'bg-gradient-to-br from-[#1E5628] to-[#16421E] text-white'
                        )}
                      >
                        {stu ? getInitials(stu.fullName) : '??'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0F172A] truncate">
                          {stu ? stu.fullName : 'Unregistered Card'}
                        </p>
                        <p className="font-mono text-[11px] text-[#64748B] truncate tabular-nums">
                          {stu ? stu.studentNumber : log.rfidUid} &middot; {log.logType}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-0.5 shrink-0">
                      <NormiBadge variant={badgeVariant} />
                      <time
                        dateTime={log.tappedAt}
                        className="font-mono text-[11px] text-[#64748B] tabular-nums"
                      >
                        {formatKioskClock(new Date(log.tappedAt))}
                      </time>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
