import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Cpu,
  Pause,
  Play,
  Radio,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts';
import { useDashboardSearch } from '../components/DashboardLayout';
import { NormiBadge } from '../components/NormiBadge';
import { Sparkline } from '../components/Sparkline';
import { Button } from '../components/ui/Button';
import { getTodayDateString, useNormi } from '../context/NormiContext';
import { cn, getInitials } from '../lib/utils';

type Timeframe = 'Hourly' | 'Daily' | 'Monthly' | 'Yearly';
type ListViewTab = 'active' | 'all' | 'feed';

const DONUT_SHADES = ['#16421E', '#1E5628', '#2F7A3E', '#4E9F5D', '#84C48F', '#A7D7B0'];

function formatTapTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function buildDeterministicTrend(seedStr: string, base: number, active: boolean): number[] {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) % 997;
  }
  const points: number[] = [];
  for (let i = 0; i < 10; i++) {
    const wave = Math.sin((hash + i * 19) * 0.45) * 6 + Math.cos((hash + i * 7) * 0.7) * 4;
    const slope = active ? i * 1.1 : -i * 0.4;
    points.push(Math.max(4, Math.round(16 + base * 0.6 + wave + slope)));
  }
  return points;
}

export function LabMonitoringPage() {
  const {
    colleges,
    devices,
    students,
    accessLogs,
    roomSnapshots,
    collegeById,
    roomById,
    studentById,
    simulateLiveTap,
  } = useNormi();
  const { globalSearch } = useDashboardSearch();
  const navigate = useNavigate();

  const [timeframe, setTimeframe] = useState<Timeframe>('Daily');
  const [listTab, setListTab] = useState<ListViewTab>('active');
  const [collegeFilter, setCollegeFilter] = useState<string>('all');
  const [autoStream, setAutoStream] = useState<boolean>(false);
  const [hoveredSliceIndex, setHoveredSliceIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!autoStream) return;
    const timer = window.setInterval(() => {
      simulateLiveTap({ mode: 'random' });
    }, 5500);
    return () => window.clearInterval(timer);
  }, [autoStream, simulateLiveTap]);

  const activeColleges = useMemo(
    () => colleges.filter((c) => c.status === 'Active'),
    [colleges]
  );

  const todayStr = getTodayDateString();
  const todayLogs = useMemo(
    () =>
      accessLogs.filter((l) => {
        const d = new Date(l.tappedAt);
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
          d.getDate()
        ).padStart(2, '0')}`;
        return ds === todayStr;
      }),
    [accessLogs, todayStr]
  );

  const liveHeadcount = useMemo(
    () => roomSnapshots.reduce((sum, s) => sum + s.headcount, 0),
    [roomSnapshots]
  );

  const onlineNodes = useMemo(
    () => devices.filter((d) => d.status === 'online').length,
    [devices]
  );

  // Smooth spline chart data synchronized with timeframe & real live tap records
  const chartData = useMemo(() => {
    if (timeframe === 'Hourly') {
      const hours = ['07:30', '08:30', '09:30', '10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30'];
      return hours.map((label) => {
        const slotHour = parseInt(label.split(':')[0], 10);
        const count = todayLogs.filter((l) => new Date(l.tappedAt).getHours() === slotHour).length;
        return { label, value: count };
      });
    }
    if (timeframe === 'Daily') {
      const slots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
      return slots.map((label) => {
        const slotHour = parseInt(label.split(':')[0], 10);
        const count = todayLogs.filter((l) => new Date(l.tappedAt).getHours() === slotHour).length;
        return { label, value: count };
      });
    }
    if (timeframe === 'Monthly') {
      return [
        { label: 'Wk 1', value: 0 },
        { label: 'Wk 2', value: 0 },
        { label: 'Wk 3', value: 0 },
        { label: 'Wk 4', value: todayLogs.length },
      ];
    }
    return [
      { label: 'Aug', value: 0 },
      { label: 'Sep', value: 0 },
      { label: 'Oct', value: 0 },
      { label: 'Nov', value: accessLogs.length },
      { label: 'Dec', value: 0 },
      { label: 'Jan', value: 0 },
    ];
  }, [timeframe, todayLogs, accessLogs.length]);

  const heroFigure = useMemo(() => {
    if (timeframe === 'Hourly') return `${liveHeadcount} Inside`;
    if (timeframe === 'Daily') return `${todayLogs.length} Taps`;
    if (timeframe === 'Monthly') return `${accessLogs.length} Scans`;
    return `${accessLogs.length} Scans`;
  }, [timeframe, liveHeadcount, todayLogs.length, accessLogs.length]);

  // Segmented Donut Ring data by NORMI College (Monochromatic Forest Green shades)
  const collegeDistribution = useMemo(() => {
    return activeColleges.map((col, idx) => {
      const stuCount = students.filter((s) => s.collegeId === col.id).length;
      const colHeadcount = roomSnapshots
        .filter((s) => s.room.collegeId === col.id)
        .reduce((acc, s) => acc + s.headcount, 0);
      return {
        id: col.id,
        code: col.code,
        name: col.name,
        value: Math.max(1, stuCount + colHeadcount),
        students: stuCount,
        headcount: colHeadcount,
        color: DONUT_SHADES[idx % DONUT_SHADES.length],
      };
    });
  }, [activeColleges, students, roomSnapshots]);

  const hoveredSlice =
    hoveredSliceIndex !== null ? collegeDistribution[hoveredSliceIndex] ?? null : null;

  // Filtered rooms for the structured row list
  const filteredSnapshots = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return roomSnapshots.filter((snap) => {
      if (listTab === 'active' && !snap.device) return false;
      if (collegeFilter !== 'all' && snap.room.collegeId !== collegeFilter) return false;
      if (!q) return true;
      return (
        snap.room.name.toLowerCase().includes(q) ||
        snap.room.roomCode.toLowerCase().includes(q) ||
        snap.room.building.toLowerCase().includes(q) ||
        (snap.college?.code ?? '').toLowerCase().includes(q) ||
        (snap.device?.deviceUid ?? '').toLowerCase().includes(q) ||
        (snap.activeSchedule?.subjectCode ?? '').toLowerCase().includes(q)
      );
    });
  }, [roomSnapshots, listTab, collegeFilter, globalSearch]);

  // Filtered live tap feed
  const filteredFeed = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return accessLogs
      .filter((log) => {
        const room = roomById.get(log.roomId);
        const stu = log.studentId ? studentById.get(log.studentId) : null;
        if (collegeFilter !== 'all') {
          if (room?.collegeId !== collegeFilter && stu?.collegeId !== collegeFilter) return false;
        }
        if (!q) return true;
        const hay = [
          stu?.fullName ?? 'Unregistered Card',
          stu?.studentNumber ?? '',
          log.rfidUid,
          room?.name ?? '',
          room?.roomCode ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 24);
  }, [accessLogs, collegeFilter, globalSearch, roomById, studentById]);

  return (
    <div className="space-y-5">
      {/* TOP HERO ROW: 2/3 Smooth Area Chart Card + 1/3 Segmented Donut Card */}
      <section
        aria-label="Campus attendance analytics"
        className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch"
      >
        {/* Left 8 Columns: Campus Activity Area Chart */}
        <div className="xl:col-span-8 normi-card p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
            <div>
              <p className="text-sm font-medium text-[#64748B]">Campus RFID Activity</p>
              <div className="mt-1 flex items-baseline gap-3">
                <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] tabular-nums">
                  {heroFigure}
                </h1>
                <span className="text-xs font-medium text-[#1E5628] tabular-nums">
                  {onlineNodes}/{devices.length} scanners online &middot; {liveHeadcount} in labs
                </span>
              </div>
            </div>

            {/* Clean Typographic Timeframe Switcher (Zero Pills) */}
            <div className="flex items-center gap-5 text-xs sm:text-[13px]">
              {(['Hourly', 'Daily', 'Monthly', 'Yearly'] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    'transition-colors whitespace-nowrap',
                    timeframe === tf
                      ? 'font-bold text-[#1E5628]'
                      : 'font-medium text-[#334155] hover:text-[#1E5628]'
                  )}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[210px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="normiForestGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1E5628" stopOpacity={0.28} />
                    <stop offset="65%" stopColor="#1E5628" stopOpacity={0.07} />
                    <stop offset="100%" stopColor="#1E5628" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#334155', fontSize: 11, fontWeight: 500 }}
                  dy={8}
                />
                <Tooltip
                  cursor={{ stroke: '#1E5628', strokeWidth: 1, strokeDasharray: '3 3' }}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid rgba(30,86,40,0.2)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 24px rgba(30,86,40,0.1)',
                    fontSize: '12px',
                  }}
                  formatter={(value) => [`${value} scans`, 'RFID Activity']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#1E5628"
                  strokeWidth={1.75}
                  fill="url(#normiForestGradient)"
                  activeDot={{ r: 5, fill: '#1E5628', stroke: '#FFFFFF', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 4 Columns: Segmented Donut Ring Card */}
        <div className="xl:col-span-4 normi-card p-6 flex flex-col items-center justify-between min-h-[280px]">
          {collegeDistribution.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-6 my-auto">
              <div className="h-10 w-10 rounded-full bg-[#1E5628]/10 text-[#1E5628] flex items-center justify-center mb-2.5">
                <Building2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="text-sm font-semibold text-[#0F172A]">No Colleges Registered</p>
              <p className="text-xs text-[#64748B] mt-1 max-w-[240px]">
                Operational database is cleared. Register departments under Colleges to monitor distribution.
              </p>
            </div>
          ) : (
            <>
              <div className="relative h-[220px] w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={collegeDistribution}
                      dataKey="value"
                      nameKey="code"
                      cx="50%"
                      cy="50%"
                      innerRadius={66}
                      outerRadius={90}
                      paddingAngle={4}
                      stroke="none"
                      onMouseEnter={(_, idx) => setHoveredSliceIndex(idx)}
                      onMouseLeave={() => setHoveredSliceIndex(null)}
                    >
                      {collegeDistribution.map((entry, idx) => (
                        <Cell
                          key={entry.id}
                          fill={entry.color}
                          opacity={hoveredSliceIndex === null || hoveredSliceIndex === idx ? 1 : 0.45}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {/* Centered Donut Callout */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                  <span className="text-xs font-medium text-[#64748B]">
                    {hoveredSlice ? hoveredSlice.code : 'Enrolled Students'}
                  </span>
                  <span className="mt-0.5 text-2xl font-bold text-[#0F172A] tabular-nums">
                    {hoveredSlice ? hoveredSlice.students : students.length}
                  </span>
                  <span className="mt-0.5 text-[11px] font-medium text-[#1E5628] tabular-nums">
                    {hoveredSlice
                      ? `${hoveredSlice.headcount} inside now`
                      : `${activeColleges.length} colleges`}
                  </span>
                </div>
              </div>

              {/* Subtle Clean Legend Row */}
              <div className="w-full pt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-[#64748B]">
                {collegeDistribution.map((col, idx) => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() =>
                      setCollegeFilter((prev) => (prev === col.id ? 'all' : col.id))
                    }
                    onMouseEnter={() => setHoveredSliceIndex(idx)}
                    onMouseLeave={() => setHoveredSliceIndex(null)}
                    className={cn(
                      'inline-flex items-center gap-1.5 transition-opacity',
                      collegeFilter !== 'all' && collegeFilter !== col.id && 'opacity-45'
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: col.color }}
                    />
                    <span className="font-semibold text-[#0F172A]">{col.code}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* BOTTOM FULL-WIDTH STRUCTURED ROW CARD (Rooms & Real-Time Tap Stream) */}
      <section aria-label="Monitored rooms and live feed" className="normi-card overflow-hidden">
        {/* Card Header Bar with Typographic Tabs */}
        <div className="px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b-2 normi-divider-strong">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-base font-semibold text-[#0F172A]">
              {listTab === 'feed' ? 'Real-Time RFID Tap Feed' : 'Campus Laboratories & Rooms'}
            </h2>

            <select
              value={collegeFilter}
              onChange={(e) => setCollegeFilter(e.target.value)}
              aria-label="Filter by college"
              className="h-8 rounded-lg border border-[#1E5628]/30 bg-white px-2.5 text-xs font-medium text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
            >
              <option value="all">All Colleges</option>
              {activeColleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between lg:justify-end gap-5">
            {/* Typographic View Tabs matching Owned / Watchlist / See all */}
            <div className="flex items-center gap-6 text-[13px]">
              <button
                type="button"
                onClick={() => setListTab('active')}
                className={cn(
                  'transition-colors whitespace-nowrap',
                  listTab === 'active'
                    ? 'font-bold text-[#0F172A]'
                    : 'font-medium text-[#64748B] hover:text-[#1E5628]'
                )}
              >
                Active Scanners
              </button>
              <button
                type="button"
                onClick={() => setListTab('all')}
                className={cn(
                  'transition-colors whitespace-nowrap',
                  listTab === 'all'
                    ? 'font-bold text-[#0F172A]'
                    : 'font-medium text-[#64748B] hover:text-[#1E5628]'
                )}
              >
                All Rooms ({roomSnapshots.length})
              </button>
              <button
                type="button"
                onClick={() => setListTab('feed')}
                className={cn(
                  'transition-colors whitespace-nowrap inline-flex items-center gap-1.5',
                  listTab === 'feed'
                    ? 'font-bold text-[#1E5628]'
                    : 'font-medium text-[#64748B] hover:text-[#1E5628]'
                )}
              >
                <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Live Feed ({accessLogs.length})</span>
              </button>
            </div>

            {/* Live Tap Simulation & Kiosk Launch Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/kiosk')}
              >
                <Radio className="h-3.5 w-3.5 text-[#1E5628]" aria-hidden="true" />
                <span>Kiosk View</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => simulateLiveTap({ mode: 'present' })}
              >
                Present Tap
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => simulateLiveTap({ mode: 'late' })}
              >
                Late Tap
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => simulateLiveTap({ mode: 'denied' })}
              >
                Denied
              </Button>
              <Button
                variant={autoStream ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => setAutoStream((prev) => !prev)}
              >
                {autoStream ? (
                  <>
                    <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Auto-Stream</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* ROOMS LIST MODE */}
        {listTab !== 'feed' && (
          <div className="normi-row-divider">
            {filteredSnapshots.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <p className="text-sm font-semibold text-[#0F172A]">No matching campus rooms</p>
                <p className="mt-1 text-xs text-[#64748B]">
                  Try clearing your search query or switching to All Rooms.
                </p>
              </div>
            ) : (
              filteredSnapshots.map((snap) => {
                const isOnline = snap.device?.status === 'online';
                const occupancyPct = Math.min(
                  100,
                  Math.round((snap.headcount / Math.max(1, snap.room.capacity)) * 100)
                );
                const statusVariant =
                  snap.status === 'Occupied'
                    ? 'occupied'
                    : snap.status === 'Offline'
                    ? 'offline'
                    : 'available';
                const sparkData = buildDeterministicTrend(
                  snap.room.id,
                  snap.headcount + (isOnline ? 10 : 0),
                  isOnline && snap.headcount > 0
                );

                return (
                  <div
                    key={snap.room.id}
                    className="px-6 py-4 grid grid-cols-1 md:grid-cols-12 items-center gap-4 hover:bg-[#F2F7F3]/55 transition-colors"
                  >
                    {/* Col 1: Circular Forest Green Emblem + Room Name & Sub-code */}
                    <div className="md:col-span-3 flex items-center gap-3.5 min-w-0">
                      <div
                        className={cn(
                          'h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-white font-mono text-[11px] font-bold',
                          snap.status === 'Offline'
                            ? 'bg-[#DC2626]'
                            : snap.device
                            ? 'bg-gradient-to-br from-[#1E5628] to-[#16421E]'
                            : 'bg-[#64748B]'
                        )}
                      >
                        {snap.college?.code ?? <Building2 className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0F172A] truncate">
                          {snap.room.name}
                        </p>
                        <p className="text-xs text-[#64748B] truncate">
                          {snap.room.roomCode} &middot; {snap.room.building}
                        </p>
                      </div>
                    </div>

                    {/* Col 2: Stacked Tabular Metrics */}
                    <div className="md:col-span-2 text-left md:text-right tabular-nums">
                      <p className="text-sm font-semibold text-[#0F172A]">
                        {snap.headcount} / {snap.room.capacity}
                      </p>
                      <p className="font-mono text-[11px] text-[#64748B]">
                        {snap.device ? snap.device.deviceUid : 'No Scanner'}
                      </p>
                    </div>

                    {/* Col 3: Inline Trend Sparkline */}
                    <div className="md:col-span-2 flex md:justify-center">
                      <Sparkline data={sparkData} active={isOnline && snap.headcount > 0} />
                    </div>

                    {/* Col 4: Circular Arrow Indicator + Utilization */}
                    <div className="md:col-span-2 flex items-center md:justify-center gap-2">
                      <NormiBadge
                        variant={statusVariant}
                        label={
                          snap.status === 'Occupied'
                            ? `${occupancyPct}% Full`
                            : snap.status
                        }
                      />
                    </div>

                    {/* Col 5: Active Schedule */}
                    <div className="md:col-span-2 text-left md:text-right min-w-0">
                      {snap.activeSchedule ? (
                        <>
                          <p className="text-xs font-semibold text-[#0F172A] truncate font-mono">
                            {snap.activeSchedule.subjectCode}
                          </p>
                          <p className="text-[11px] text-[#64748B] truncate">
                            {snap.activeSchedule.instructorName}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-[#64748B]">Open Lab</p>
                      )}
                    </div>

                    {/* Col 6: Right Clean Action */}
                    <div className="md:col-span-1 flex md:justify-end">
                      {snap.device && isOnline ? (
                        <button
                          type="button"
                          onClick={() =>
                            simulateLiveTap({
                              deviceUid: snap.device!.deviceUid,
                              mode: 'random',
                            })
                          }
                          className="text-xs font-semibold text-[#1E5628] hover:text-[#16421E] hover:underline underline-offset-4 whitespace-nowrap"
                        >
                          Simulate Tap
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigate('/dashboard/devices')}
                          className="text-xs font-medium text-[#64748B] hover:text-[#1E5628] hover:underline underline-offset-4 whitespace-nowrap inline-flex items-center gap-1"
                        >
                          <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Configure</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* LIVE TAP FEED MODE */}
        {listTab === 'feed' && (
          <div className="normi-row-divider">
            {filteredFeed.length === 0 ? (
              <div className="py-12 px-6 text-center">
                <p className="text-sm font-semibold text-[#0F172A]">No matching RFID scans</p>
                <p className="mt-1 text-xs text-[#64748B]">
                  Use the tap simulation buttons above or clear the search input.
                </p>
              </div>
            ) : (
              filteredFeed.map((log) => {
                const stu = log.studentId ? studentById.get(log.studentId) : null;
                const room = roomById.get(log.roomId);
                const col = stu?.collegeId
                  ? collegeById.get(stu.collegeId)
                  : room?.collegeId
                  ? collegeById.get(room.collegeId)
                  : null;

                const statusVariant =
                  log.attendanceStatus === 'denied'
                    ? 'unauthorized'
                    : log.attendanceStatus === 'late'
                    ? 'late'
                    : 'present';

                return (
                  <div
                    key={log.id}
                    className="px-6 py-4 grid grid-cols-1 md:grid-cols-12 items-center gap-4 hover:bg-[#F2F7F3]/55 transition-colors"
                  >
                    <div className="md:col-span-4 flex items-center gap-3.5 min-w-0">
                      <div
                        className={cn(
                          'h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold',
                          log.attendanceStatus === 'denied'
                            ? 'bg-[#DC2626]'
                            : log.attendanceStatus === 'late'
                            ? 'bg-[#F5A61C] text-[#0F172A]'
                            : 'bg-gradient-to-br from-[#1E5628] to-[#16421E]'
                        )}
                      >
                        {stu ? getInitials(stu.fullName) : '??'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0F172A] truncate">
                          {stu ? stu.fullName : 'Unregistered Card'}
                        </p>
                        <p className="font-mono text-xs text-[#64748B] truncate tabular-nums">
                          {stu ? `${stu.studentNumber} · ${log.rfidUid}` : log.rfidUid}
                        </p>
                      </div>
                    </div>

                    <div className="md:col-span-3 min-w-0">
                      <p className="text-sm font-medium text-[#0F172A] truncate">
                        {room?.name ?? 'Unknown Room'}
                      </p>
                      <p className="text-xs text-[#64748B] truncate">
                        {col?.code ?? 'Shared'} &middot; {room?.roomCode ?? '—'}
                      </p>
                    </div>

                    <div className="md:col-span-2 flex md:justify-center">
                      <NormiBadge variant={log.logType === 'IN' ? 'time-in' : 'time-out'} />
                    </div>

                    <div className="md:col-span-2 flex md:justify-center">
                      <NormiBadge variant={statusVariant} />
                    </div>

                    <div className="md:col-span-1 text-left md:text-right font-mono text-xs text-[#64748B] tabular-nums whitespace-nowrap">
                      {formatTapTime(log.tappedAt)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>
    </div>
  );
}
