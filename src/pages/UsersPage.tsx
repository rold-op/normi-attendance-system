import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Power,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDashboardSearch } from '../components/DashboardLayout';
import { NormiBadge } from '../components/NormiBadge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { cn, getInitials } from '../lib/utils';
import {
  formatRoleLabel,
  type CreatableUserRole,
  type ManagedUser,
  type UserRole,
} from '../types/normi';

type RoleFilter = 'all' | 'dean' | 'instructor';

function RoleBadge({ role }: { role: UserRole }) {
  if (role === 'super_admin') {
    return (
      <span className="inline-flex items-center rounded-md bg-[#1E5628] px-2.5 py-0.5 text-[11px] font-semibold text-white whitespace-nowrap">
        Super Admin
      </span>
    );
  }
  if (role === 'dean') {
    return (
      <span className="inline-flex items-center rounded-md border border-[#1E5628]/30 bg-[#EAF2EC] px-2.5 py-0.5 text-[11px] font-semibold text-[#1E5628] whitespace-nowrap">
        Dean
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-0.5 text-[11px] font-semibold text-[#334155] whitespace-nowrap">
      Instructor
    </span>
  );
}

export function UsersPage() {
  const { session, authFetch } = useAuth();
  const { globalSearch } = useDashboardSearch();

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [localSearch, setLocalSearch] = useState('');

  // Create / Edit User Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<CreatableUserRole>('instructor');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Delete Confirmation Modal state
  const [deletingUser, setDeletingUser] = useState<ManagedUser | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const combinedSearch = (localSearch || globalSearch).trim();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== 'all') params.set('role', roleFilter);
      if (combinedSearch) params.set('search', combinedSearch);
      const query = params.toString();
      const res = await authFetch(`/api/users${query ? `?${query}` : ''}`);
      const data = (await res.json().catch(() => ({}))) as {
        users?: ManagedUser[];
        error?: string;
      };
      if (!res.ok) {
        setLoadError(data.error ?? 'Failed to load user accounts.');
        return;
      }
      setUsers(data.users ?? []);
    } catch {
      setLoadError('Unable to reach server to load user accounts.');
    } finally {
      setLoading(false);
    }
  }, [authFetch, roleFilter, combinedSearch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchUsers();
    }, 140);
    return () => window.clearTimeout(timer);
  }, [fetchUsers]);

  const roleCounts = useMemo(() => {
    let deans = 0;
    let instructors = 0;
    for (const u of users) {
      if (u.role === 'dean') deans++;
      else if (u.role === 'instructor') instructors++;
    }
    return { total: users.length, deans, instructors };
  }, [users]);

  const openCreateModal = () => {
    setEditingUser(null);
    setFullName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setRole('instructor');
    setIsActive(true);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditModal = (user: ManagedUser) => {
    setEditingUser(user);
    setFullName(user.full_name);
    setEmail(user.email);
    setPassword('');
    setShowPassword(false);
    setRole(user.role === 'dean' ? 'dean' : 'instructor');
    setIsActive(user.is_active);
    setFormError(null);
    setFormOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    const cleanedName = fullName.trim();
    const cleanedEmail = email.trim().toLowerCase();

    if (cleanedName.length < 2) {
      setFormError('Full name must be at least 2 characters.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (!editingUser && password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }
    if (editingUser && password && password.length < 8) {
      setFormError('New password must be at least 8 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingUser) {
        const body: Record<string, unknown> = {
          full_name: cleanedName,
          email: cleanedEmail,
          is_active: isActive,
        };
        if (editingUser.role !== 'super_admin') {
          body.role = role;
        }
        if (password) {
          body.password = password;
        }

        const res = await authFetch(`/api/users/${encodeURIComponent(editingUser.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = (await res.json().catch(() => ({}))) as {
          user?: ManagedUser;
          error?: string;
        };
        if (!res.ok) {
          setFormError(data.error ?? 'Failed to update user account.');
          return;
        }
        toast.success(`Updated ${data.user?.full_name ?? cleanedName}`);
        setFormOpen(false);
        void fetchUsers();
      } else {
        const res = await authFetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: cleanedName,
            email: cleanedEmail,
            password,
            role,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          user?: ManagedUser;
          error?: string;
        };
        if (!res.ok) {
          setFormError(data.error ?? 'Failed to create user account.');
          return;
        }
        toast.success(`Created ${formatRoleLabel(role)} account`, {
          description: `${cleanedName} (${cleanedEmail}) can now sign in immediately.`,
        });
        setFormOpen(false);
        void fetchUsers();
      }
    } catch {
      setFormError('Network error while saving user account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: ManagedUser) => {
    if (user.id === session?.id) return;
    try {
      const res = await authFetch(`/api/users/${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        user?: ManagedUser;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? 'Could not update account status.');
        return;
      }
      toast.success(
        `${user.full_name} is now ${data.user?.is_active ? 'Active' : 'Inactive'}`
      );
      void fetchUsers();
    } catch {
      toast.error('Network error while updating account status.');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser || deletingBusy) return;
    setDeletingBusy(true);
    try {
      const res = await authFetch(`/api/users/${encodeURIComponent(deletingUser.id)}`, {
        method: 'DELETE',
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to delete user account.');
        return;
      }
      toast.success(`Deleted ${deletingUser.full_name}`);
      setDeletingUser(null);
      void fetchUsers();
    } catch {
      toast.error('Network error while deleting user account.');
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <section aria-label="Super Admin user management" className="normi-card overflow-hidden">
        {/* Card Header Bar */}
        <div className="px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 normi-divider-strong">
          <div>
            <h1 className="text-lg font-bold text-[#0F172A] tracking-tight">Users</h1>
            <p className="text-xs text-[#64748B]">
              Super Admin account management — create and govern Dean and Instructor accounts with strict role access.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 shrink-0">
            {/* Typographic Role Filter Tabs */}
            <div className="flex items-center gap-5 text-[13px]">
              {(
                [
                  { key: 'all', label: `All (${roleCounts.total})` },
                  { key: 'dean', label: 'Dean' },
                  { key: 'instructor', label: 'Instructor' },
                ] as { key: RoleFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setRoleFilter(tab.key)}
                  className={cn(
                    'transition-colors whitespace-nowrap',
                    roleFilter === tab.key
                      ? 'font-bold text-[#1E5628]'
                      : 'font-medium text-[#64748B] hover:text-[#1E5628]'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <Button variant="primary" size="md" onClick={openCreateModal}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add User</span>
            </Button>
          </div>
        </div>

        {/* Local Search Strip */}
        <div className="px-6 py-3 bg-[#F2F7F3]/50 border-b border-[#1E5628]/15 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#1E5628]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Filter users by full name or email..."
              aria-label="Filter users by name or email"
              className="h-8 w-full rounded-lg border border-[#1E5628]/30 bg-white pl-8 pr-3 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E5628] focus:outline-none"
            />
          </div>

          <span className="text-xs text-[#64748B] tabular-nums">
            {users.length} account{users.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1E5628]/18 bg-[#F2F7F3]/35 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
                <th className="py-3 px-6">Full Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E5628]/15 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 px-6 text-center text-xs text-[#64748B]">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[#1E5628]" />
                      <span>Loading user accounts...</span>
                    </span>
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={5} className="py-12 px-6 text-center text-xs text-[#DC2626]">
                    {loadError}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 px-6 text-center">
                    <p className="text-sm font-semibold text-[#0F172A]">No user accounts found</p>
                    <p className="mt-1 text-xs text-[#64748B]">
                      Click &ldquo;Add User&rdquo; to create a Dean or Instructor account.
                    </p>
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const isSelf = user.id === session?.id;
                  const isSuperAdmin = user.role === 'super_admin';

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-[#F2F7F3]/55 transition-colors"
                    >
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={cn(
                              'h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white',
                              !user.is_active
                                ? 'bg-[#94A3B8]'
                                : isSuperAdmin
                                ? 'bg-[#16421E]'
                                : 'bg-gradient-to-br from-[#1E5628] to-[#16421E]'
                            )}
                          >
                            {getInitials(user.full_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#0F172A] truncate">
                              {user.full_name}
                              {isSelf && (
                                <span className="ml-1.5 text-[11px] font-normal text-[#64748B]">
                                  (You)
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-[#64748B] tabular-nums">
                              Created {new Date(user.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-[#0F172A]">
                        {user.email}
                      </td>

                      <td className="py-3.5 px-4">
                        <RoleBadge role={user.role} />
                      </td>

                      <td className="py-3.5 px-4">
                        <NormiBadge
                          variant={user.is_active ? 'active' : 'deactivated'}
                          label={user.is_active ? 'Active' : 'Inactive'}
                        />
                      </td>

                      <td className="py-3.5 px-6 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(user)}
                            title={`Edit ${user.full_name}`}
                            aria-label={`Edit ${user.full_name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E5628]/25 bg-white text-[#64748B] hover:text-[#1E5628] hover:border-[#1E5628] transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          {!isSelf && !isSuperAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleToggleActive(user)}
                                title={user.is_active ? 'Deactivate account' : 'Activate account'}
                                aria-label={
                                  user.is_active
                                    ? `Deactivate ${user.full_name}`
                                    : `Activate ${user.full_name}`
                                }
                                className={cn(
                                  'inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-white transition-colors',
                                  user.is_active
                                    ? 'border-[#1E5628]/25 text-[#1E5628] hover:border-[#F5A61C] hover:text-[#B47209]'
                                    : 'border-[#E2E8F0] text-[#64748B] hover:border-[#1E5628] hover:text-[#1E5628]'
                                )}
                              >
                                <Power className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeletingUser(user)}
                                title={`Delete ${user.full_name}`}
                                aria-label={`Delete ${user.full_name}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#1E5628]/25 bg-white text-[#64748B] hover:border-[#DC2626] hover:text-[#DC2626] transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Create / Edit User Modal */}
      <Modal
        open={formOpen}
        onClose={() => !submitting && setFormOpen(false)}
        title={editingUser ? 'Edit User Account' : 'Add User Account'}
        description={
          editingUser
            ? 'Update account details, assigned role, active status, or optionally reset the password.'
            : 'Provision a new Instructor or Dean account. The user can sign in immediately with these credentials.'
        }
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="usr-full-name"
              className="block text-xs font-semibold text-[#0F172A] mb-1.5"
            >
              Full Name
            </label>
            <input
              id="usr-full-name"
              type="text"
              required
              disabled={submitting}
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="Prof. Carlo M. Reyes"
              className="h-10 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E5628] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="usr-email"
              className="block text-xs font-semibold text-[#0F172A] mb-1.5"
            >
              Email Address
            </label>
            <input
              id="usr-email"
              type="email"
              required
              disabled={submitting}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="c.reyes@normi.edu.ph"
              className="h-10 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E5628] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="usr-password"
              className="block text-xs font-semibold text-[#0F172A] mb-1.5"
            >
              {editingUser ? 'New Password (optional — leave blank to keep current)' : 'Password'}
            </label>
            <div className="relative">
              <input
                id="usr-password"
                type={showPassword ? 'text' : 'password'}
                required={!editingUser}
                disabled={submitting}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder={
                  editingUser ? 'Min. 8 characters to reset' : 'Minimum 8 characters'
                }
                className="h-10 w-full rounded-xl border border-[#1E5628]/30 bg-white pl-3 pr-10 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#1E5628] focus:outline-none"
              />
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#64748B] hover:text-[#1E5628]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Role dropdown: STRICTLY only Instructor and Dean */}
          {(!editingUser || editingUser.role !== 'super_admin') && (
            <div>
              <label
                htmlFor="usr-role"
                className="block text-xs font-semibold text-[#0F172A] mb-1.5"
              >
                Role
              </label>
              <select
                id="usr-role"
                disabled={submitting}
                value={role}
                onChange={(e) => setRole(e.target.value as CreatableUserRole)}
                className="h-10 w-full rounded-xl border border-[#1E5628]/30 bg-white px-3 text-sm text-[#0F172A] focus:border-[#1E5628] focus:outline-none"
              >
                <option value="instructor">Instructor</option>
                <option value="dean">Dean</option>
              </select>
              <p className="mt-1 text-[11px] text-[#64748B]">
                {role === 'dean'
                  ? 'Department-level oversight: view attendance reports, summaries, and logs across classes.'
                  : 'Class-level access: manage attendance sessions and view attendance records for assigned classes.'}
              </p>
            </div>
          )}

          {editingUser && editingUser.id !== session?.id && (
            <label className="inline-flex items-center gap-2.5 text-xs font-medium text-[#0F172A] cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-[#CBD5E1] accent-[#1E5628]"
              />
              <span>Account is active and permitted to sign in</span>
            </label>
          )}

          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-medium text-[#DC2626]"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
            <Button
              variant="outline"
              size="md"
              disabled={submitting}
              onClick={() => setFormOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : editingUser ? (
                'Save Changes'
              ) : (
                'Create User'
              )}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={Boolean(deletingUser)}
        onClose={() => !deletingBusy && setDeletingUser(null)}
        title="Delete User Account"
        description="This permanently removes the user account and immediately revokes system sign-in."
        maxWidthClass="max-w-sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-[#0F172A] leading-relaxed">
            Are you sure you want to delete{' '}
            <strong>{deletingUser?.full_name}</strong> (
            <span className="font-mono">{deletingUser?.email}</span>)?
          </p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2E8F0]">
            <Button
              variant="outline"
              size="md"
              disabled={deletingBusy}
              onClick={() => setDeletingUser(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="md"
              disabled={deletingBusy}
              onClick={() => void handleConfirmDelete()}
            >
              {deletingBusy ? 'Deleting...' : 'Delete Account'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
