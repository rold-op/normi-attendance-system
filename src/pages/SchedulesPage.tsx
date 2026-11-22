import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useDashboardSearch } from '../components/DashboardLayout';
import { NormiBadge } from '../components/NormiBadge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { getTodayDateString, useNormi } from '../context/NormiContext';
import { cn, getInitials } from '../lib/utils';
import type { DayOfWeek, SheetAttendanceStatus, SubjectSchedule } from '../types/normi';

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, '0')} ${suffix}`;
}

function sameLocalDate(iso: string, dateStr: string): boolean {
  const d = new Date(iso);
  const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
  return ds === dateStr;
}

export function SchedulesPage() {
  const { session } = useAuth();
  const {
    colleges,
    rooms,
    schedules,
    students,
    accessLogs,
    overrides,
    collegeById,
    roomById,
    addSchedule,
    updateSchedule,
    deleteSchedule,
    setAttendanceOverride,
  } = useNormi();
  const { globalSearch } = useDashboardSearch();

  const [searchParams, setSearchParams] = useSearchParams();
  const initialCollegeParam = searchParams.get('college') ?? 'all';

  const [activeTab, setActiveTab] = useState<'schedules' | 'attendance'>('schedules');
  const [collegeFilter, setCollegeFilter] = useState<string>(initialCollegeParam);
  const [dayFilter, setDayFilter] = useState<DayOfWeek | 'all'>('all');

  const [selectedScheduleId, setSelectedScheduleId] = useState<string>(schedules[0]?.id ?? '');
  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayDateString());

  // Schedule Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SubjectSchedule | null>(null);
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [collegeId, setCollegeId] = useState(colleges[0]?.id ?? '');
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '');
  const [instructorName, setInstructorName] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>('Mon');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [graceMinutes, setGraceMinutes] = useState(15);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const param = searchParams.get('college');
    if (param) setCollegeFilter(param);
  }, [searchParams]);

  useEffect(() => {
    if (!selectedScheduleId && schedules[0]) {
      setSelectedScheduleId(schedules[0].id);
    }
  }, [schedules, selectedScheduleId]);

  const canModify = session?.role === 'super_admin' || session?.role === 'instructor';

  const filteredSchedules = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return schedules.filter((sc) => {
      if (collegeFilter !== 'all' && sc.collegeId !== collegeFilter) return false;
      if (dayFilter !== 'all' && sc.dayOfWeek !== dayFilter) return false;
      if (!q) return true;
      const col = collegeById.get(sc.collegeId);
      const rm = roomById.get(sc.roomId);
      return (
        sc.subjectCode.toLowerCase().includes(q) ||
        sc.subjectName.toLowerCase().includes(q) ||
        sc.instructorName.toLowerCase().includes(q) ||
        (col?.code ?? '').toLowerCase().includes(q) ||
        (rm?.name ?? '').toLowerCase().includes(q)
      );
    });
  }, [schedules, collegeFilter, dayFilter, globalSearch, collegeById, roomById]);

  const openCreateModal = () => {
    const defaultCol = collegeFilter !== 'all' ? collegeFilter : colleges[0]?.id ?? '';
    const defaultRoom =
      rooms.find((r) => r.collegeId === defaultCol)?.id ?? rooms[0]?.id ?? '';
    setEditing(null);
    setSubjectCode('');
    setSubjectName('');
    setCollegeId(defaultCol);
    setRoomId(defaultRoom);
    setInstructorName('');
    setDayOfWeek('Mon');
    setStartTime('08:00');
    setEndTime('10:00');
    setGraceMinutes(15);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (sc: SubjectSchedule) => {
    setEditing(sc);
    setSubjectCode(sc.subjectCode);
    setSubjectName(sc.subjectName);
    setCollegeId(sc.collegeId);
    setRoomId(sc.roomId);
    setInstructorName(sc.instructorName);
    setDayOfWeek(sc.dayOfWeek);
    setStartTime(sc.startTime);
    setEndTime(sc.endTime);
    setGraceMinutes(sc.graceMinutes);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const payload = {
      subjectCode,
      subjectName,
      collegeId,
      roomId,
      instructorName,
      dayOfWeek,
      startTime,
      endTime,
      graceMinutes,
    };
    const res = editing ? updateSchedule(editing.id, payload) : addSchedule(payload);
    if (!res.success) {
      setFormError(res.error ?? 'Failed to save schedule.');
      return;
    }
    setModalOpen(false);
  };

  const activeSheetSchedule =
    schedules.find((s) => s.id === selectedScheduleId) ?? schedules[0] ?? null;

  const attendanceRows = useMemo(() => {
    if (!activeSheetSchedule) return [];
    const q = globalSearch.trim().toLowerCase();

    const roster = students.filter(
      (s) =>
        activeSheetSchedule.enrolledStudentIds.includes(s.id) ||
        s.collegeId === activeSheetSchedule.collegeId
    );

    const dayLogs = accessLogs.filter(
      (l) =>
        sameLocalDate(l.tappedAt, selectedDate) &&
        l.attendanceStatus !== 'denied' &&
        (l.scheduleId === activeSheetSchedule.id || l.roomId === activeSheetSchedule.roomId)
    );

    return roster
      .filter((s) => {
        if (!q) return true;
        return (
          s.fullName.toLowerCase().includes(q) ||
          s.studentNumber.toLowerCase().includes(q) ||
          s.program.toLowerCase().includes(q)
        );
      })
      .map((student) => {
        const studentLogs = dayLogs
          .filter((l) => l.studentId === student.id)
          .sort((a, b) => new Date(a.tappedAt).getTime() - new Date(b.tappedAt).getTime());

        const firstIn = studentLogs.find((l) => l.logType === 'IN') ?? studentLogs[0] ?? null;
        const lastOut = [...studentLogs].reverse().find((l) => l.logType === 'OUT') ?? null;

        let computedStatus: SheetAttendanceStatus = 'absent';
        if (firstIn) {
          computedStatus = firstIn.attendanceStatus === 'late' ? 'late' : 'present';
        }

        const overrideKey = `${activeSheetSchedule.id}::${selectedDate}::${student.id}`;
        const override = overrides[overrideKey];
        const finalStatus: SheetAttendanceStatus = override?.status ?? computedStatus;

        return {
          student,
          firstIn,
          lastOut,
          finalStatus,
          isOverridden: Boolean(override),
        };
      });
  }, [activeSheetSchedule, students, accessLogs, selectedDate, overrides, globalSearch]);

  const sheetSummary = useMemo(() => {
    let present = 0;
    let late = 0;
    let absent = 0;
    for (const row of attendanceRows) {
      if (row.finalStatus === 'present') present++;
      else if (row.finalStatus === 'late') late++;
      else absent++;
    }
    return { total: attendanceRows.length, present, late, absent };
  }, [attendanceRows]);

  return (
    <div className="space-y-5">
      <section aria-label="Subject schedules and automated attendance" className="normi-card overflow-hidden">
        {/* Card Header Bar */}
        <div className="px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 normi-divider-strong">
          <div>
            <h1 className="text-lg font-bold text-[#0F172A] tracking-tight">
              Subject Schedule &amp; Attendance
            </h1>
            <p className="text-xs text-[#64748B]">
              Class schedules with configurable late grace periods and live automated RFID rosters.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 shrink-0">
            <div className="flex items-center gap-5 text-[13px]">
              <button
                type="button"
                onClick={() => setActiveTab('schedules')}
                className={cn(
                  'transition-colors whitespace-nowrap',
                  activeTab === 'schedules'
                    ? 'font-bold text-[#1E5628]'
                    : 'font-medium text-[#64748B] hover:text-[#1E5628]'
                )}
              >
                Class Schedules ({schedules.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('attendance')}
                className={cn(
                  'transition-colors whitespace-nowrap',
                  activeTab === 'attendance'
                    ? 'font-bold text-[#1E5628]'
                    : 'font-medium text-[#64748B] hover:text-[#1E5628]'
                )}
              >
                Automated Attendance
              </button>
            </div>

            {canModify && (
              <Button variant="primary" size="md" onClick={openCreateModal}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add Schedule</span>
              </Button>
            )}
          </div>
        </div>

        {/* TAB 1: Class Schedules */}
        {activeTab === 'schedules' && (
          <>
            <div className="px-6 py-3 bg-[#F2F7F3]/50 border-b border-[#1E5628]/15 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
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
                  aria-label="Filter schedules by college"
                  className="h-8 rounded-lg border border-[#1E5628]/30 bg-white px-2.5 text-xs font-medium text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
                >
                  <option value="all">All Colleges</option>
                  {colleges.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </select>

                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => setDayFilter('all')}
                    className={cn(
                      'transition-colors',
                      dayFilter === 'all'
                        ? 'font-bold text-[#1E5628]'
                        : 'font-medium text-[#64748B] hover:text-[#1E5628]'
                    )}
                  >
                    All Days
                  </button>
                  {DAYS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDayFilter(d)}
                      className={cn(
                        'transition-colors',
                        dayFilter === d
                          ? 'font-bold text-[#1E5628]'
                          : 'font-medium text-[#64748B] hover:text-[#1E5628]'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <span className="text-xs text-[#64748B] tabular-nums">
                {filteredSchedules.length} scheduled class{filteredSchedules.length === 1 ? '' : 'es'}
              </span>
            </div>

            <div className="normi-row-divider">
              {filteredSchedules.length === 0 ? (
                <div className="py-12 px-6 text-center text-xs text-[#64748B]">
                  No schedules match the selected filter.
                </div>
              ) : (
                filteredSchedules.map((sc) => {
                  const col = collegeById.get(sc.collegeId);
                  const rm = roomById.get(sc.roomId);

                  return (
                    <div
                      key={sc.id}
                      className="px-6 py-4 grid grid-cols-1 lg:grid-cols-12 items-center gap-4 hover:bg-[#F2F7F3]/55 transition-colors"
                    >
                      <div className="lg:col-span-4 flex items-center gap-3.5 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#1E5628] to-[#16421E] text-white font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                          {col?.code ?? 'CLS'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[#0F172A] truncate">
                            {sc.subjectName}
                          </p>
                          <p className="font-mono text-xs text-[#1E5628] truncate">
                            {sc.subjectCode} &middot;{' '}
                            <span className="font-sans text-[#64748B]">{sc.instructorName}</span>
                          </p>
                        </div>
                      </div>

                      <div className="lg:col-span-2 min-w-0">
                        <p className="text-sm font-medium text-[#0F172A] truncate">
                          {rm?.name ?? 'Unassigned'}
                        </p>
                        <p className="font-mono text-xs text-[#64748B]">{rm?.roomCode ?? '—'}</p>
                      </div>

                      <div className="lg:col-span-3 tabular-nums">
                        <p className="text-sm font-medium text-[#0F172A]">{sc.dayOfWeek}</p>
                        <p className="font-mono text-xs text-[#64748B]">
                          {formatTime12h(sc.startTime)} – {formatTime12h(sc.endTime)}
                        </p>
                      </div>

                      <div className="lg:col-span-1 text-left lg:text-right font-mono text-xs text-[#0F172A] tabular-nums">
                        {sc.graceMinutes}m grace
                      </div>

                      <div className="lg:col-span-2 flex items-center lg:justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedScheduleId(sc.id);
                            setActiveTab('attendance');
                          }}
                          className="text-xs font-semibold text-[#1E5628] hover:underline underline-offset-4 whitespace-nowrap mr-1"
                        >
                          View Sheet
                        </button>
                        {canModify && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(sc)}
                              aria-label={`Edit ${sc.subjectCode}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E5628]/25 bg-white text-[#64748B] hover:text-[#1E5628]"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSchedule(sc.id)}
                              aria-label={`Delete ${sc.subjectCode}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E5628]/25 bg-white text-[#64748B] hover:text-[#DC2626]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* TAB 2: Automated Attendance Sheet */}
        {activeTab === 'attendance' && (
          <>
            <div className="px-6 py-4 bg-[#F2F7F3]/50 border-b border-[#1E5628]/15 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <select
                  aria-label="Select scheduled class"
                  value={activeSheetSchedule?.id ?? ''}
                  onChange={(e) => setSelectedScheduleId(e.target.value)}
                  className="h-9 min-w-[260px] flex-1 max-w-md rounded-xl border border-[#1E5628]/30 bg-white px-3 text-xs font-medium text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
                >
                  {schedules.map((sc) => {
                    const col = collegeById.get(sc.collegeId);
                    const rm = roomById.get(sc.roomId);
                    return (
                      <option key={sc.id} value={sc.id}>
                        [{col?.code}] {sc.subjectCode} — {sc.subjectName} ({rm?.name})
                      </option>
                    );
                  })}
                </select>

                <input
                  type="date"
                  aria-label="Session date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-9 rounded-xl border border-[#1E5628]/30 bg-white px-3 font-mono text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-5 text-xs tabular-nums">
                <span className="text-[#64748B]">
                  Enrolled <strong className="font-mono text-[#0F172A]">{sheetSummary.total}</strong>
                </span>
                <span className="text-[#64748B]">
                  Present <strong className="font-mono text-[#1E5628]">{sheetSummary.present}</strong>
                </span>
                <span className="text-[#64748B]">
                  Late <strong className="font-mono text-[#B47209]">{sheetSummary.late}</strong>
                </span>
                <span className="text-[#64748B]">
                  Absent <strong className="font-mono text-[#DC2626]">{sheetSummary.absent}</strong>
                </span>
              </div>
            </div>

            <div className="normi-row-divider">
              {attendanceRows.length === 0 ? (
                <div className="py-12 px-6 text-center text-xs text-[#64748B]">
                  No students enrolled in this schedule match your search.
                </div>
              ) : (
                attendanceRows.map((row) => (
                  <div
                    key={row.student.id}
                    className="px-6 py-4 grid grid-cols-1 lg:grid-cols-12 items-center gap-4 hover:bg-[#F2F7F3]/55 transition-colors"
                  >
                    <div className="lg:col-span-4 flex items-center gap-3.5 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#1E5628] to-[#16421E] text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {getInitials(row.student.fullName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#0F172A] truncate">
                          {row.student.fullName}
                        </p>
                        <p className="font-mono text-xs text-[#64748B] truncate tabular-nums">
                          {row.student.studentNumber} &middot; {row.student.program} ({row.student.yearLevel})
                        </p>
                      </div>
                    </div>

                    <div className="lg:col-span-3 font-mono text-xs tabular-nums">
                      <p className="text-[#0F172A]">
                        In:{' '}
                        {row.firstIn
                          ? new Date(row.firstIn.tappedAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : '—'}
                      </p>
                      <p className="text-[#64748B]">
                        Out:{' '}
                        {row.lastOut
                          ? new Date(row.lastOut.tappedAt).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : '—'}
                      </p>
                    </div>

                    <div className="lg:col-span-2 flex items-center gap-2">
                      <NormiBadge variant={row.finalStatus} />
                      {row.isOverridden && (
                        <span className="text-[11px] text-[#64748B]">(Manual)</span>
                      )}
                    </div>

                    <div className="lg:col-span-3 flex items-center lg:justify-end gap-2">
                      {canModify && activeSheetSchedule ? (
                        (['present', 'late', 'absent'] as SheetAttendanceStatus[]).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() =>
                              setAttendanceOverride({
                                scheduleId: activeSheetSchedule.id,
                                date: selectedDate,
                                studentId: row.student.id,
                                status: st,
                                updatedBy: session?.name ?? 'Admin',
                              })
                            }
                            className={cn(
                              'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors capitalize',
                              row.finalStatus === st
                                ? 'bg-[#1E5628] border-[#1E5628] text-white'
                                : 'bg-white border-[#1E5628]/25 text-[#64748B] hover:text-[#1E5628]'
                            )}
                          >
                            {st}
                          </button>
                        ))
                      ) : (
                        <span className="text-[11px] text-[#64748B]">Read-only</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </section>

      {/* Schedule Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Subject Schedule' : 'Add Subject Schedule'}
        description="Link a class schedule to a NORMI college, room, instructor, and late grace window."
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSaveSchedule} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="sc-code"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Subject Code
              </label>
              <input
                id="sc-code"
                type="text"
                required
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value.toUpperCase())}
                placeholder="IT 301"
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 font-mono text-xs uppercase text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label
                htmlFor="sc-name"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Subject Name
              </label>
              <input
                id="sc-name"
                type="text"
                required
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                placeholder="Web Systems & Technologies"
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="sc-college"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                College
              </label>
              <select
                id="sc-college"
                value={collegeId}
                onChange={(e) => setCollegeId(e.target.value)}
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              >
                {colleges.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="sc-room"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Room / Laboratory
              </label>
              <select
                id="sc-room"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              >
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.roomCode})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="sc-instructor"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Instructor Name
              </label>
              <input
                id="sc-instructor"
                type="text"
                required
                value={instructorName}
                onChange={(e) => setInstructorName(e.target.value)}
                placeholder="Prof. Carlo M. Reyes"
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="sc-day"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Day of Week
              </label>
              <select
                id="sc-day"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value as DayOfWeek)}
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="sc-start"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Start Time
              </label>
              <input
                id="sc-start"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 font-mono text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="sc-end"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                End Time
              </label>
              <input
                id="sc-end"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 font-mono text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="sc-grace"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Late Grace (min)
              </label>
              <input
                id="sc-grace"
                type="number"
                min={0}
                max={60}
                required
                value={graceMinutes}
                onChange={(e) => setGraceMinutes(Number(e.target.value))}
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 font-mono text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              />
            </div>
          </div>

          {formError && (
            <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#DC2626]">
              {formError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <Button variant="outline" size="md" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md">
              {editing ? 'Save Schedule' : 'Create Schedule'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
