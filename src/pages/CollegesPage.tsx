import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, Pencil, Plus, RotateCcw } from 'lucide-react';
import { useDashboardSearch } from '../components/DashboardLayout';
import { NormiBadge } from '../components/NormiBadge';
import { Sparkline } from '../components/Sparkline';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useNormi } from '../context/NormiContext';
import { cn } from '../lib/utils';
import type { College, CollegeStatus } from '../types/normi';

function buildCollegeTrend(code: string, count: number): number[] {
  let seed = 0;
  for (let i = 0; i < code.length; i++) seed += code.charCodeAt(i) * (i + 3);
  return Array.from({ length: 10 }, (_, idx) =>
    Math.max(5, Math.round(14 + count * 1.4 + Math.sin((seed + idx * 13) * 0.5) * 6 + idx * 0.8))
  );
}

export function CollegesPage() {
  const {
    colleges,
    students,
    schedules,
    rooms,
    devices,
    addCollege,
    updateCollege,
    toggleCollegeStatus,
  } = useNormi();
  const { globalSearch } = useDashboardSearch();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<'all' | CollegeStatus>('all');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<College | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [deanName, setDeanName] = useState('');
  const [status, setStatus] = useState<CollegeStatus>('Active');
  const [error, setError] = useState<string | null>(null);

  const filteredColleges = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return colleges.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.deanName.toLowerCase().includes(q)
      );
    });
  }, [colleges, statusFilter, globalSearch]);

  const metricsByCollege = useMemo(() => {
    const map = new Map<
      string,
      { studentsCount: number; schedulesCount: number; roomsCount: number; onlineDevices: number }
    >();
    const roomIdsByCollege = new Map<string, Set<string>>();
    colleges.forEach((c) => {
      roomIdsByCollege.set(c.id, new Set());
      map.set(c.id, { studentsCount: 0, schedulesCount: 0, roomsCount: 0, onlineDevices: 0 });
    });

    students.forEach((s) => {
      const m = map.get(s.collegeId);
      if (m) m.studentsCount++;
    });
    schedules.forEach((sc) => {
      const m = map.get(sc.collegeId);
      if (m) m.schedulesCount++;
    });
    rooms.forEach((r) => {
      if (!r.collegeId) return;
      const m = map.get(r.collegeId);
      if (m) m.roomsCount++;
      roomIdsByCollege.get(r.collegeId)?.add(r.id);
    });
    devices.forEach((d) => {
      if (d.status !== 'online') return;
      for (const [colId, rSet] of roomIdsByCollege.entries()) {
        if (rSet.has(d.roomId)) {
          const m = map.get(colId);
          if (m) m.onlineDevices++;
        }
      }
    });

    return map;
  }, [colleges, students, schedules, rooms, devices]);

  const openAddModal = () => {
    setEditing(null);
    setCode('');
    setName('');
    setDeanName('');
    setStatus('Active');
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (col: College) => {
    setEditing(col);
    setCode(col.code);
    setName(col.name);
    setDeanName(col.deanName);
    setStatus(col.status);
    setError(null);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = editing
      ? updateCollege(editing.id, { code, name, deanName, status })
      : addCollege({ code, name, deanName, status });
    if (!res.success) {
      setError(res.error ?? 'Failed to save college.');
      return;
    }
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Unified Floating White Card List matching Inspiration Row Rhythm */}
      <section aria-label="Academic colleges directory" className="normi-card overflow-hidden">
        <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 normi-divider-strong">
          <div>
            <h1 className="text-lg font-bold text-[#0F172A] tracking-tight">Colleges</h1>
            <p className="text-xs text-[#64748B]">
              Academic departments powering campus rooms, student rosters, schedules, and audit reports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 shrink-0">
            <div className="flex items-center gap-5 text-[13px]">
              {(['all', 'Active', 'Archived'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={cn(
                    'transition-colors whitespace-nowrap',
                    statusFilter === st
                      ? 'font-bold text-[#1E5628]'
                      : 'font-medium text-[#64748B] hover:text-[#1E5628]'
                  )}
                >
                  {st === 'all' ? `All (${colleges.length})` : st}
                </button>
              ))}
            </div>

            <Button variant="primary" size="md" onClick={openAddModal}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add College</span>
            </Button>
          </div>
        </div>

        <div className="normi-row-divider">
          {filteredColleges.length === 0 ? (
            <div className="py-12 px-6 text-center">
              <p className="text-sm font-semibold text-[#0F172A]">No colleges found</p>
              <p className="mt-1 text-xs text-[#64748B]">
                Add a new academic department or clear your search query.
              </p>
            </div>
          ) : (
            filteredColleges.map((col) => {
              const metrics = metricsByCollege.get(col.id) ?? {
                studentsCount: 0,
                schedulesCount: 0,
                roomsCount: 0,
                onlineDevices: 0,
              };
              const isActive = col.status === 'Active';

              return (
                <div
                  key={col.id}
                  className="px-6 py-4 grid grid-cols-1 lg:grid-cols-12 items-center gap-4 hover:bg-[#F2F7F3]/55 transition-colors"
                >
                  {/* Circular Emblem + Name + Dean */}
                  <div className="lg:col-span-4 flex items-center gap-3.5 min-w-0">
                    <div
                      className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center shrink-0 font-mono text-xs font-bold text-white',
                        isActive
                          ? 'bg-gradient-to-br from-[#1E5628] to-[#16421E]'
                          : 'bg-[#64748B]'
                      )}
                    >
                      {col.code}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0F172A] truncate">{col.name}</p>
                      <p className="text-xs text-[#64748B] truncate">Dean: {col.deanName}</p>
                    </div>
                  </div>

                  {/* Stacked Relational Metrics */}
                  <div className="lg:col-span-2 text-left lg:text-right tabular-nums">
                    <p className="text-sm font-semibold text-[#0F172A]">
                      {metrics.studentsCount} Students
                    </p>
                    <p className="text-xs text-[#64748B]">
                      {metrics.roomsCount} Rooms &middot; {metrics.schedulesCount} Classes
                    </p>
                  </div>

                  {/* Inline Activity Sparkline */}
                  <div className="lg:col-span-2 flex lg:justify-center">
                    <Sparkline
                      data={buildCollegeTrend(col.code, metrics.studentsCount + metrics.roomsCount)}
                      active={isActive}
                    />
                  </div>

                  {/* Status Indicator */}
                  <div className="lg:col-span-1 flex lg:justify-center">
                    <NormiBadge variant={isActive ? 'active' : 'archived'} />
                  </div>

                  {/* Cross-Module Quick Filter Links */}
                  <div className="lg:col-span-2 flex flex-wrap items-center lg:justify-end gap-3 text-xs font-medium text-[#1E5628]">
                    <button
                      type="button"
                      onClick={() => navigate(`/dashboard/students?college=${col.id}`)}
                      className="hover:underline underline-offset-4"
                    >
                      Students
                    </button>
                    <span className="text-[#CBD5E1]" aria-hidden="true">
                      /
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/dashboard/schedules?college=${col.id}`)}
                      className="hover:underline underline-offset-4"
                    >
                      Schedules
                    </button>
                    <span className="text-[#CBD5E1]" aria-hidden="true">
                      /
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/dashboard/logs?college=${col.id}`)}
                      className="hover:underline underline-offset-4"
                    >
                      Reports
                    </button>
                  </div>

                  {/* CRUD Actions */}
                  <div className="lg:col-span-1 flex items-center lg:justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(col)}
                      aria-label={`Edit ${col.name}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E5628]/25 bg-white text-[#64748B] hover:text-[#1E5628] hover:border-[#1E5628] transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleCollegeStatus(col.id)}
                      aria-label={isActive ? `Archive ${col.name}` : `Restore ${col.name}`}
                      title={isActive ? 'Archive college' : 'Restore college'}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E5628]/25 bg-white text-[#64748B] hover:text-[#1E5628] hover:border-[#1E5628] transition-colors"
                    >
                      {isActive ? (
                        <Archive className="h-3.5 w-3.5" />
                      ) : (
                        <RotateCcw className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* College Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Academic College' : 'Add Academic College'}
        description="Register a NORMI college department used to categorize rooms, students, schedules, and audit reports."
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="col-code"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                College Code
              </label>
              <input
                id="col-code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="CIT"
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 font-mono text-xs uppercase text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              />
            </div>
            <div className="col-span-2">
              <label
                htmlFor="col-status"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Status
              </label>
              <select
                id="col-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as CollegeStatus)}
                className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              >
                <option value="Active">Active</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="col-name"
              className="block text-xs font-semibold text-[#0F172A] mb-1.5"
            >
              College Name
            </label>
            <input
              id="col-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="College of Information Technology"
              className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="col-dean"
              className="block text-xs font-semibold text-[#0F172A] mb-1.5"
            >
              Dean / Department Head
            </label>
            <input
              id="col-dean"
              type="text"
              required
              value={deanName}
              onChange={(e) => setDeanName(e.target.value)}
              placeholder="Dr. Roberto M. Villanueva"
              className="h-9 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 text-xs text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#DC2626]">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <Button variant="outline" size="md" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md">
              {editing ? 'Save Changes' : 'Add College'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
