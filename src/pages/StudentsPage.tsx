import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Pencil,
  Plus,
  Radio,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDashboardSearch } from '../components/DashboardLayout';
import { NormiBadge } from '../components/NormiBadge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { normalizeUid, useNormi } from '../context/NormiContext';
import { cn, getInitials } from '../lib/utils';
import type { CardStatus, Student, YearLevel } from '../types/normi';

const YEAR_LEVELS: YearLevel[] = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const PAGE_SIZE = 10;

export function StudentsPage() {
  const {
    colleges,
    students,
    collegeById,
    addStudent,
    updateStudent,
    deleteStudent,
    setRfidCaptureListener,
    simulateLiveTap,
  } = useNormi();
  const { globalSearch } = useDashboardSearch();

  const [searchParams, setSearchParams] = useSearchParams();
  const [collegeFilter, setCollegeFilter] = useState<string>(
    searchParams.get('college') ?? 'all'
  );
  const [programFilter, setProgramFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [cardStatusFilter, setCardStatusFilter] = useState<'all' | CardStatus>('all');
  const [page, setPage] = useState(1);

  // Student Form Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [studentNumber, setStudentNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [collegeId, setCollegeId] = useState(colleges[0]?.id ?? '');
  const [program, setProgram] = useState('');
  const [yearLevel, setYearLevel] = useState<YearLevel>('1st Year');
  const [rfidUid, setRfidUid] = useState('');
  const [cardStatus, setCardStatus] = useState<CardStatus>('active');
  const [listeningLiveTap, setListeningLiveTap] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const param = searchParams.get('college');
    if (param) {
      setCollegeFilter(param);
      setPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [globalSearch]);

  useEffect(() => {
    if (!modalOpen || !listeningLiveTap) {
      setRfidCaptureListener(null);
      return;
    }

    setRfidCaptureListener((uid, deviceUid) => {
      setRfidUid(uid);
      setListeningLiveTap(false);
      toast.success(`Captured RFID UID ${uid}`, {
        description: `Scanned from terminal ${deviceUid}`,
      });
    });

    return () => setRfidCaptureListener(null);
  }, [modalOpen, listeningLiveTap, setRfidCaptureListener]);

  const programOptions = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (collegeFilter === 'all' || s.collegeId === collegeFilter) {
        if (s.program.trim()) set.add(s.program.trim());
      }
    });
    return Array.from(set).sort();
  }, [students, collegeFilter]);

  const filteredStudents = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return students.filter((s) => {
      if (collegeFilter !== 'all' && s.collegeId !== collegeFilter) return false;
      if (programFilter !== 'all' && s.program !== programFilter) return false;
      if (yearFilter !== 'all' && s.yearLevel !== yearFilter) return false;
      if (cardStatusFilter !== 'all' && s.cardStatus !== cardStatusFilter) return false;
      if (!q) return true;
      const col = collegeById.get(s.collegeId);
      return (
        s.fullName.toLowerCase().includes(q) ||
        s.studentNumber.toLowerCase().includes(q) ||
        (s.rfidUid ?? '').toLowerCase().includes(q) ||
        s.program.toLowerCase().includes(q) ||
        (col?.code ?? '').toLowerCase().includes(q)
      );
    });
  }, [
    students,
    globalSearch,
    collegeFilter,
    programFilter,
    yearFilter,
    cardStatusFilter,
    collegeById,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredStudents.slice(start, start + PAGE_SIZE);
  }, [filteredStudents, currentPage]);

  const openAddModal = () => {
    setEditing(null);
    setStudentNumber('');
    setFullName('');
    setCollegeId(collegeFilter !== 'all' ? collegeFilter : colleges[0]?.id ?? '');
    setProgram('');
    setYearLevel('1st Year');
    setRfidUid('');
    setCardStatus('active');
    setListeningLiveTap(false);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (stu: Student) => {
    setEditing(stu);
    setStudentNumber(stu.studentNumber);
    setFullName(stu.fullName);
    setCollegeId(stu.collegeId);
    setProgram(stu.program);
    setYearLevel(stu.yearLevel);
    setRfidUid(stu.rfidUid ?? '');
    setCardStatus(stu.cardStatus);
    setListeningLiveTap(false);
    setFormError(null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setListeningLiveTap(false);
    setRfidCaptureListener(null);
    setModalOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const payload = {
      studentNumber,
      fullName,
      collegeId,
      program,
      yearLevel,
      rfidUid: rfidUid.trim() ? normalizeUid(rfidUid) : null,
      cardStatus,
    };
    const res = editing ? updateStudent(editing.id, payload) : addStudent(payload);
    if (!res.success) {
      setFormError(res.error ?? 'Could not save student.');
      return;
    }
    handleCloseModal();
  };

  return (
    <div className="space-y-5">
      <section aria-label="Students and RFID directory" className="normi-card overflow-hidden">
        {/* Card Header Bar */}
        <div className="px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 normi-divider-strong">
          <div>
            <h1 className="text-lg font-bold text-[#0F172A] tracking-tight">
              Students &amp; RFID
            </h1>
            <p className="text-xs text-[#64748B]">
              Student directory with USB-wedge RFID binding, live scanner capture, and card lifecycle controls.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 shrink-0">
            <div className="flex items-center gap-5 text-[13px]">
              {(['all', 'active', 'lost', 'deactivated'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setCardStatusFilter(st);
                    setPage(1);
                  }}
                  className={cn(
                    'transition-colors whitespace-nowrap capitalize',
                    cardStatusFilter === st
                      ? 'font-bold text-[#1E5628]'
                      : 'font-medium text-[#64748B] hover:text-[#1E5628]'
                  )}
                >
                  {st === 'all' ? `All (${students.length})` : st}
                </button>
              ))}
            </div>

            <Button variant="primary" size="md" onClick={openAddModal}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Enroll Student</span>
            </Button>
          </div>
        </div>

        {/* Secondary Compact Filter Row */}
        <div className="px-6 py-3 bg-[#F2F7F3]/50 border-b border-[#1E5628]/15 flex flex-wrap items-center gap-2.5">
          <select
            value={collegeFilter}
            onChange={(e) => {
              const val = e.target.value;
              setCollegeFilter(val);
              setProgramFilter('all');
              setPage(1);
              if (val === 'all') {
                searchParams.delete('college');
                setSearchParams(searchParams, { replace: true });
              } else {
                setSearchParams({ college: val }, { replace: true });
              }
            }}
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

          <select
            value={programFilter}
            onChange={(e) => {
              setProgramFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by program"
            className="h-8 rounded-lg border border-[#1E5628]/30 bg-white px-2.5 text-xs font-medium text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
          >
            <option value="all">All Programs</option>
            {programOptions.map((prog) => (
              <option key={prog} value={prog}>
                {prog}
              </option>
            ))}
          </select>

          <select
            value={yearFilter}
            onChange={(e) => {
              setYearFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by year level"
            className="h-8 rounded-lg border border-[#1E5628]/30 bg-white px-2.5 text-xs font-medium text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
          >
            <option value="all">All Year Levels</option>
            {YEAR_LEVELS.map((yl) => (
              <option key={yl} value={yl}>
                {yl}
              </option>
            ))}
          </select>
        </div>

        {/* Horizontal Structured Rows */}
        <div className="normi-row-divider">
          {paginatedStudents.length === 0 ? (
            <div className="py-12 px-6 text-center text-xs text-[#64748B]">
              No students match your active filters.
            </div>
          ) : (
            paginatedStudents.map((stu) => {
              const col = collegeById.get(stu.collegeId);
              return (
                <div
                  key={stu.id}
                  className="px-6 py-4 grid grid-cols-1 lg:grid-cols-12 items-center gap-4 hover:bg-[#F2F7F3]/55 transition-colors"
                >
                  <div className="lg:col-span-4 flex items-center gap-3.5 min-w-0">
                    <div
                      className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold',
                        stu.cardStatus === 'lost'
                          ? 'bg-[#DC2626]'
                          : stu.cardStatus === 'deactivated'
                          ? 'bg-[#64748B]'
                          : 'bg-gradient-to-br from-[#1E5628] to-[#16421E]'
                      )}
                    >
                      {getInitials(stu.fullName)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A] truncate">
                        {stu.fullName}
                      </p>
                      <p className="font-mono text-xs text-[#64748B] tabular-nums">
                        {stu.studentNumber}
                      </p>
                    </div>
                  </div>

                  <div className="lg:col-span-3 min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] truncate">
                      <span className="font-mono font-semibold text-[#1E5628]">
                        {col?.code ?? 'N/A'}
                      </span>{' '}
                      &middot; {stu.program}
                    </p>
                    <p className="text-xs text-[#64748B]">{stu.yearLevel}</p>
                  </div>

                  <div className="lg:col-span-2 font-mono text-xs tabular-nums">
                    {stu.rfidUid ? (
                      <span className="font-medium text-[#0F172A]">{stu.rfidUid}</span>
                    ) : (
                      <span className="text-[#94A3B8]">Unassigned RFID</span>
                    )}
                  </div>

                  <div className="lg:col-span-2 flex lg:justify-center">
                    <NormiBadge variant={stu.cardStatus} />
                  </div>

                  <div className="lg:col-span-1 flex items-center lg:justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(stu)}
                      aria-label={`Edit ${stu.fullName}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E5628]/25 bg-white text-[#64748B] hover:text-[#1E5628]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteStudent(stu.id)}
                      aria-label={`Delete ${stu.fullName}`}
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

        {/* Pagination Footer */}
        <div className="px-6 py-3.5 border-t border-[#1E5628]/18 bg-[#F2F7F3]/40 flex items-center justify-between text-xs text-[#64748B]">
          <span className="tabular-nums">
            Showing{' '}
            <strong className="text-[#0F172A]">
              {filteredStudents.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}
            </strong>
            –
            <strong className="text-[#0F172A]">
              {Math.min(currentPage * PAGE_SIZE, filteredStudents.length)}
            </strong>{' '}
            of <strong className="text-[#0F172A]">{filteredStudents.length}</strong> students
          </span>

          <div className="inline-flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Prev</span>
            </Button>
            <span className="px-2 font-mono tabular-nums text-[#0F172A]">
              {currentPage}/{totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Student Enrollment & RFID Binding Modal */}
      <Modal
        open={modalOpen}
        onClose={handleCloseModal}
        title={editing ? 'Edit Student & RFID Binding' : 'Enroll Student & Bind RFID'}
        description="Enter student profile information and assign a unique RFID card UID via USB reader or live hardware scan."
        maxWidthClass="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="stu-number"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Student Number
              </label>
              <input
                id="stu-number"
                type="text"
                required
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                placeholder="2026-00412"
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 font-mono text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="stu-name"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Full Name
              </label>
              <input
                id="stu-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Juan Miguel Dela Cruz"
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="stu-college"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                College
              </label>
              <select
                id="stu-college"
                value={collegeId}
                onChange={(e) => setCollegeId(e.target.value)}
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-2.5 text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
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
                htmlFor="stu-program"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Program
              </label>
              <input
                id="stu-program"
                type="text"
                required
                value={program}
                onChange={(e) => setProgram(e.target.value)}
                placeholder="BSIT / BSED"
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="stu-year"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Year Level
              </label>
              <select
                id="stu-year"
                value={yearLevel}
                onChange={(e) => setYearLevel(e.target.value as YearLevel)}
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-2.5 text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              >
                {YEAR_LEVELS.map((yl) => (
                  <option key={yl} value={yl}>
                    {yl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-[#1E5628]/25 bg-[#F2F7F3]/70 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="stu-rfid"
                className="text-xs font-semibold text-[#0F172A] flex items-center gap-1.5"
              >
                <CreditCard className="h-3.5 w-3.5 text-[#1E5628]" aria-hidden="true" />
                <span>RFID Card UID (USB Wedge or Live Tap)</span>
              </label>
              <select
                value={cardStatus}
                onChange={(e) => setCardStatus(e.target.value as CardStatus)}
                aria-label="RFID Card Status"
                className="h-7 rounded-lg border border-[#1E5628]/30 bg-white px-2 text-[11px] font-medium text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              >
                <option value="active">Card: Active</option>
                <option value="lost">Card: Lost</option>
                <option value="deactivated">Card: Deactivated</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                id="stu-rfid"
                type="text"
                value={rfidUid}
                onChange={(e) => setRfidUid(e.target.value.toUpperCase())}
                placeholder="Scan USB RFID reader or type e.g. A4:3F:91:C2"
                className="h-9 flex-1 min-w-[180px] rounded-xl border border-[#1E5628]/30 bg-white px-3 font-mono text-xs uppercase text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E5628] focus:outline-none"
              />
              <Button
                variant={listeningLiveTap ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setListeningLiveTap((prev) => !prev)}
              >
                <Radio className="h-3.5 w-3.5 text-[#1E5628]" aria-hidden="true" />
                <span>{listeningLiveTap ? 'Listening...' : 'Live Tap Capture'}</span>
              </Button>
            </div>

            {listeningLiveTap && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-[#1E5628]/25 bg-[#EAF2EC] px-3 py-2 text-[11px] text-[#1E5628]">
                <span>Waiting for an ESP32 scanner tap on the LAN...</span>
                <button
                  type="button"
                  onClick={() => simulateLiveTap({ mode: 'denied' })}
                  className="font-semibold underline underline-offset-2 whitespace-nowrap"
                >
                  Simulate Card Scan
                </button>
              </div>
            )}
          </div>

          {formError && (
            <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#DC2626]">
              {formError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <Button variant="outline" size="md" onClick={handleCloseModal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md">
              {editing ? 'Save Student' : 'Enroll Student'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
