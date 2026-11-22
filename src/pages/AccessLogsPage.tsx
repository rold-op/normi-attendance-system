import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, FileText, Printer, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDashboardSearch } from '../components/DashboardLayout';
import { NormiBadge } from '../components/NormiBadge';
import { NormiLogo } from '../components/NormiLogo';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { getTodayDateString, useNormi } from '../context/NormiContext';
import { cn, getInitials } from '../lib/utils';

function formatLogTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function escapeCsvCell(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function AccessLogsPage() {
  const {
    colleges,
    rooms,
    schedules,
    accessLogs,
    collegeById,
    roomById,
    deviceById,
    studentById,
    scheduleById,
    purgeOperationalData,
  } = useNormi();
  const { globalSearch, setGlobalSearch } = useDashboardSearch();

  const [searchParams, setSearchParams] = useSearchParams();

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [collegeFilter, setCollegeFilter] = useState<string>(
    searchParams.get('college') ?? 'all'
  );
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

  useEffect(() => {
    const param = searchParams.get('college');
    if (param) setCollegeFilter(param);
  }, [searchParams]);

  const enrichedLogs = useMemo(() => {
    return accessLogs.map((log) => {
      const student = log.studentId ? studentById.get(log.studentId) ?? null : null;
      const room = roomById.get(log.roomId) ?? null;
      const device = deviceById.get(log.deviceId) ?? null;
      const schedule = log.scheduleId ? scheduleById.get(log.scheduleId) ?? null : null;
      const college = student
        ? collegeById.get(student.collegeId) ?? null
        : room?.collegeId
        ? collegeById.get(room.collegeId) ?? null
        : null;

      return { log, student, room, device, schedule, college };
    });
  }, [accessLogs, studentById, roomById, deviceById, scheduleById, collegeById]);

  const filteredLogs = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return enrichedLogs.filter(({ log, student, room, schedule, college }) => {
      const d = new Date(log.tappedAt);
      const localDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(d.getDate()).padStart(2, '0')}`;

      if (startDate && localDateStr < startDate) return false;
      if (endDate && localDateStr > endDate) return false;
      if (collegeFilter !== 'all' && college?.id !== collegeFilter) return false;
      if (roomFilter !== 'all' && room?.id !== roomFilter) return false;
      if (subjectFilter !== 'all' && schedule?.id !== subjectFilter) return false;
      if (statusFilter !== 'all' && log.attendanceStatus !== statusFilter) return false;
      if (q) {
        const hay = [
          student?.fullName ?? 'Unregistered Card',
          student?.studentNumber ?? '',
          log.rfidUid,
          room?.name ?? '',
          schedule?.subjectCode ?? '',
          college?.code ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    enrichedLogs,
    startDate,
    endDate,
    collegeFilter,
    roomFilter,
    subjectFilter,
    statusFilter,
    globalSearch,
  ]);

  const summaryCounts = useMemo(() => {
    let present = 0;
    let late = 0;
    let denied = 0;
    for (const item of filteredLogs) {
      if (item.log.attendanceStatus === 'present') present++;
      else if (item.log.attendanceStatus === 'late') late++;
      else denied++;
    }
    return { total: filteredLogs.length, present, late, denied };
  }, [filteredLogs]);

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setCollegeFilter('all');
    setRoomFilter('all');
    setSubjectFilter('all');
    setStatusFilter('all');
    setGlobalSearch('');
    searchParams.delete('college');
    setSearchParams(searchParams, { replace: true });
  };

  const handleExportCsv = () => {
    const headers = [
      'Timestamp',
      'Student Number',
      'Student Name',
      'RFID UID',
      'College',
      'Room',
      'Device UID',
      'Subject',
      'Log Type',
      'Attendance Status',
    ];
    const rows = filteredLogs.map(({ log, student, room, device, schedule, college }) => [
      formatLogTimestamp(log.tappedAt),
      student?.studentNumber ?? 'UNREGISTERED',
      student?.fullName ?? 'Unregistered Card',
      log.rfidUid,
      college?.code ?? 'N/A',
      room?.name ?? 'Unknown',
      device?.deviceUid ?? 'N/A',
      schedule ? `${schedule.subjectCode} - ${schedule.subjectName}` : 'Unscheduled',
      log.logType,
      log.attendanceStatus.toUpperCase(),
    ]);

    const csv = [
      headers.map(escapeCsvCell).join(','),
      ...rows.map((r) => r.map(escapeCsvCell).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `normi-attendance-logs-${getTodayDateString()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${filteredLogs.length} audit log(s) to CSV`);
  };

  const generatedTimestamp = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const activeFilterSummary = [
    `Date: ${startDate || 'All'} to ${endDate || 'Present'}`,
    `College: ${
      collegeFilter === 'all' ? 'All Colleges' : collegeById.get(collegeFilter)?.code ?? 'Selected'
    }`,
    `Room: ${roomFilter === 'all' ? 'All Rooms' : roomById.get(roomFilter)?.name ?? 'Selected'}`,
    `Status: ${statusFilter === 'all' ? 'All Statuses' : statusFilter.toUpperCase()}`,
  ].join('  |  ');

  return (
    <div className="space-y-5">
      <section aria-label="Access logs and audit reports" className="normi-card overflow-hidden no-print">
        {/* Card Header Bar */}
        <div className="px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 normi-divider-strong">
          <div>
            <h1 className="text-lg font-bold text-[#0F172A] tracking-tight">
              Access Logs &amp; Reports
            </h1>
            <p className="text-xs text-[#64748B]">
              Historical RFID access audit trail with CSV export and print-ready institutional PDF reports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 shrink-0">
            <div className="flex items-center gap-5 text-[13px]">
              {[
                { key: 'all', label: `All (${summaryCounts.total})` },
                { key: 'present', label: `Present (${summaryCounts.present})` },
                { key: 'late', label: `Late (${summaryCounts.late})` },
                { key: 'denied', label: `Denied (${summaryCounts.denied})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={cn(
                    'transition-colors whitespace-nowrap',
                    statusFilter === tab.key
                      ? 'font-bold text-[#1E5628]'
                      : 'font-medium text-[#64748B] hover:text-[#1E5628]'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="md"
                className="text-[#DC2626] border-[#DC2626]/30 hover:bg-[#DC2626]/10"
                onClick={() => {
                  if (window.confirm('Are you sure you want to completely clear all operational access logs?')) {
                    purgeOperationalData();
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1 text-[#DC2626]" aria-hidden="true" />
                <span>Clear All Logs</span>
              </Button>
              <Button variant="outline" size="md" onClick={handleExportCsv}>
                <Download className="h-3.5 w-3.5 text-[#1E5628]" aria-hidden="true" />
                <span>CSV</span>
              </Button>
              <Button variant="primary" size="md" onClick={() => setPdfPreviewOpen(true)}>
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Export PDF</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Multi-Criteria Filter Strip */}
        <div className="px-6 py-3 bg-[#F2F7F3]/50 border-b border-[#1E5628]/15 flex flex-wrap items-center gap-2.5">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Start date"
            className="h-8 rounded-lg border border-[#1E5628]/30 bg-white px-2.5 font-mono text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
          />
          <span className="text-xs text-[#64748B]">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="End date"
            className="h-8 rounded-lg border border-[#1E5628]/30 bg-white px-2.5 font-mono text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
          />

          <select
            value={collegeFilter}
            onChange={(e) => {
              const val = e.target.value;
              setCollegeFilter(val);
              if (val === 'all') {
                searchParams.delete('college');
                setSearchParams(searchParams, { replace: true });
              } else {
                setSearchParams({ college: val }, { replace: true });
              }
            }}
            aria-label="Filter logs by college"
            className="h-8 rounded-lg border border-[#1E5628]/30 bg-white px-2.5 text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
          >
            <option value="all">All Colleges</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>

          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            aria-label="Filter logs by room"
            className="h-8 rounded-lg border border-[#1E5628]/30 bg-white px-2.5 text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
          >
            <option value="all">All Rooms</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.roomCode})
              </option>
            ))}
          </select>

          <select
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            aria-label="Filter logs by subject"
            className="h-8 rounded-lg border border-[#1E5628]/30 bg-white px-2.5 text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
          >
            <option value="all">All Subjects</option>
            {schedules.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.subjectCode} — {sc.subjectName}
              </option>
            ))}
          </select>

          <Button variant="ghost" size="sm" onClick={handleResetFilters}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset</span>
          </Button>
        </div>

        {/* Horizontal Structured Audit Rows */}
        <div className="normi-row-divider">
          {filteredLogs.length === 0 ? (
            <div className="py-12 px-6 text-center text-xs text-[#64748B]">
              No access logs match your selected criteria.
            </div>
          ) : (
            filteredLogs.map(({ log, student, room, device, schedule, college }) => (
              <div
                key={log.id}
                className="px-6 py-4 grid grid-cols-1 lg:grid-cols-12 items-center gap-4 hover:bg-[#F2F7F3]/55 transition-colors"
              >
                <div className="lg:col-span-4 flex items-center gap-3.5 min-w-0">
                  <div
                    className={cn(
                      'h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
                      log.attendanceStatus === 'denied'
                        ? 'bg-[#DC2626] text-white'
                        : log.attendanceStatus === 'late'
                        ? 'bg-[#F5A61C] text-[#0F172A]'
                        : 'bg-gradient-to-br from-[#1E5628] to-[#16421E] text-white'
                    )}
                  >
                    {student ? getInitials(student.fullName) : '??'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0F172A] truncate">
                      {student ? student.fullName : 'Unregistered Card'}
                    </p>
                    <p className="font-mono text-xs text-[#64748B] truncate tabular-nums">
                      {student ? `${student.studentNumber} · ` : ''}
                      {log.rfidUid}
                    </p>
                  </div>
                </div>

                <div className="lg:col-span-3 min-w-0">
                  <p className="text-sm font-medium text-[#0F172A] truncate">
                    {room?.name ?? 'Unknown'}{' '}
                    <span className="font-mono text-xs text-[#1E5628]">
                      ({college?.code ?? 'N/A'})
                    </span>
                  </p>
                  <p className="font-mono text-xs text-[#64748B] truncate">
                    {device?.deviceUid ?? '—'}
                    {schedule ? ` · ${schedule.subjectCode}` : ''}
                    {log.syncedFromOffline ? ' · Offline Sync' : ''}
                  </p>
                </div>

                <div className="lg:col-span-2 flex lg:justify-center">
                  <NormiBadge variant={log.logType === 'IN' ? 'time-in' : 'time-out'} />
                </div>

                <div className="lg:col-span-1 flex lg:justify-center">
                  <NormiBadge variant={log.attendanceStatus} />
                </div>

                <div className="lg:col-span-2 text-left lg:text-right font-mono text-xs text-[#64748B] tabular-nums whitespace-nowrap">
                  {formatLogTimestamp(log.tappedAt)}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Print-Only Institutional PDF Layout */}
      <section className="hidden print-only space-y-4">
        <div className="flex items-center justify-between border-b-2 border-[#1E5628] pb-3">
          <div className="flex items-center gap-3">
            <NormiLogo size="print" />
            <div>
              <h1 className="text-lg font-bold uppercase tracking-tight text-[#0F172A]">
                NORMI &mdash; Northern Mindanao Colleges, Inc.
              </h1>
              <p className="text-xs font-medium text-[#64748B]">
                NORMI Attendance System &middot; Official RFID Access &amp; Attendance Report
              </p>
            </div>
          </div>
          <div className="text-right text-[11px] text-[#64748B] font-mono tabular-nums">
            <p>Generated: {generatedTimestamp}</p>
            <p>Records: {filteredLogs.length}</p>
          </div>
        </div>

        <p className="text-[11px] text-[#64748B]">{activeFilterSummary}</p>

        <table className="w-full text-left border-collapse text-[11px]">
          <thead>
            <tr className="bg-[#1E5628] text-white">
              <th className="py-2 px-2.5">Timestamp</th>
              <th className="py-2 px-2.5">Student No.</th>
              <th className="py-2 px-2.5">Student Name</th>
              <th className="py-2 px-2.5">College</th>
              <th className="py-2 px-2.5">Room</th>
              <th className="py-2 px-2.5">Subject</th>
              <th className="py-2 px-2.5">Type</th>
              <th className="py-2 px-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0]">
            {filteredLogs.map(({ log, student, room, schedule, college }) => (
              <tr key={log.id}>
                <td className="py-1.5 px-2.5 font-mono tabular-nums">
                  {formatLogTimestamp(log.tappedAt)}
                </td>
                <td className="py-1.5 px-2.5 font-mono tabular-nums">
                  {student?.studentNumber ?? log.rfidUid}
                </td>
                <td className="py-1.5 px-2.5 font-medium">
                  {student?.fullName ?? 'Unregistered Card'}
                </td>
                <td className="py-1.5 px-2.5 font-mono">{college?.code ?? 'N/A'}</td>
                <td className="py-1.5 px-2.5">{room?.name ?? 'Unknown'}</td>
                <td className="py-1.5 px-2.5">{schedule?.subjectCode ?? '—'}</td>
                <td className="py-1.5 px-2.5 font-mono">{log.logType}</td>
                <td className="py-1.5 px-2.5 font-semibold uppercase">{log.attendanceStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* PDF Report Preview & Print Modal */}
      <Modal
        open={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        title="NORMI Attendance PDF Report Preview"
        description="Print-ready institutional layout with Forest Green headers, active filter metadata, and generation timestamp."
        maxWidthClass="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#1E5628] pb-3 gap-4">
              <div className="flex items-center gap-3">
                <NormiLogo size="print" />
                <div>
                  <p className="text-base font-bold uppercase tracking-tight text-[#0F172A]">
                    NORMI
                  </p>
                  <p className="text-xs font-medium text-[#64748B]">
                    Northern Mindanao Colleges, Inc. &middot; NORMI Attendance System
                  </p>
                </div>
              </div>
              <div className="text-right text-[11px] text-[#64748B] font-mono tabular-nums">
                <p>Generated: {generatedTimestamp}</p>
                <p>
                  Total: {summaryCounts.total} (Present: {summaryCounts.present} · Late:{' '}
                  {summaryCounts.late} · Denied: {summaryCounts.denied})
                </p>
              </div>
            </div>

            <p className="text-[11px] text-[#64748B]">{activeFilterSummary}</p>

            <div className="overflow-x-auto max-h-80 border border-[#E2E8F0] rounded-lg">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-[#1E5628] text-white">
                    <th className="py-2 px-3">Timestamp</th>
                    <th className="py-2 px-3">Student</th>
                    <th className="py-2 px-3">College</th>
                    <th className="py-2 px-3">Room</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {filteredLogs.slice(0, 25).map(({ log, student, room, college }) => (
                    <tr key={log.id}>
                      <td className="py-2 px-3 font-mono tabular-nums whitespace-nowrap">
                        {formatLogTimestamp(log.tappedAt)}
                      </td>
                      <td className="py-2 px-3 font-medium text-[#0F172A]">
                        {student?.fullName ?? `Unregistered (${log.rfidUid})`}
                      </td>
                      <td className="py-2 px-3 font-mono">{college?.code ?? 'N/A'}</td>
                      <td className="py-2 px-3">{room?.name ?? 'Unknown'}</td>
                      <td className="py-2 px-3 font-mono">{log.logType}</td>
                      <td className="py-2 px-3 uppercase font-semibold">{log.attendanceStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
            <Button variant="outline" size="md" onClick={() => setPdfPreviewOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setPdfPreviewOpen(false);
                window.setTimeout(() => window.print(), 120);
              }}
            >
              <Printer className="h-4 w-4" aria-hidden="true" />
              <span>Print / Save as PDF</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
