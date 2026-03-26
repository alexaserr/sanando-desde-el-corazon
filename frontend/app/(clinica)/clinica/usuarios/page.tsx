'use client';

import { useState, useEffect } from 'react';
import { UserCog, Shield, Plus, Pencil, KeyRound, UserX, UserCheck, Loader2, X } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';

// ── Types ─────────────────────────────────────────────────

interface UserItem {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  totp_enabled: boolean;
  created_at: string;
}

interface UserListResponse {
  data: UserItem[];
}

interface UserCreateResponse {
  data: UserItem;
}

interface UserUpdateResponse {
  data: UserItem;
}

type ModalType = 'create' | 'edit' | 'reset-password' | null;

// ── Role helpers ──────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  sanador: 'Sanador',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-[#C4704A]/10 text-[#C4704A] border border-[#C4704A]/20',
  sanador: 'bg-[#B7BFB3]/20 text-[#4A3628] border border-[#B7BFB3]/40',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// ── Page ──────────────────────────────────────────────────

export default function UsuariosPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modal, setModal] = useState<ModalType>(null);
  const [editTarget, setEditTarget] = useState<UserItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Create form
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createConfirm, setCreateConfirm] = useState('');
  const [createRole, setCreateRole] = useState('sanador');

  // Edit form
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editActive, setEditActive] = useState(true);

  // Reset password form
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');

  // ── Load users ────────────────────────────────────────

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<UserListResponse>('/api/v1/admin/users');
      setUsers(res.data);
    } catch (err) {
      setError(
        err instanceof ApiError ? `Error ${err.status}: ${err.message}` : 'Error al cargar usuarios',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin]);

  // ── Modal helpers ─────────────────────────────────────

  function openCreate() {
    setCreateName('');
    setCreateEmail('');
    setCreatePassword('');
    setCreateConfirm('');
    setCreateRole('sanador');
    setModalError('');
    setModal('create');
  }

  function openEdit(u: UserItem) {
    setEditTarget(u);
    setEditName(u.full_name);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditActive(u.is_active);
    setModalError('');
    setModal('edit');
  }

  function openResetPassword(u: UserItem) {
    setEditTarget(u);
    setResetPassword('');
    setResetConfirm('');
    setModalError('');
    setModal('reset-password');
  }

  function closeModal() {
    setModal(null);
    setEditTarget(null);
    setModalError('');
  }

  // ── Create user ───────────────────────────────────────

  async function handleCreate() {
    setModalError('');

    if (!createName.trim() || !createEmail.trim() || !createPassword) {
      setModalError('Todos los campos son obligatorios');
      return;
    }
    if (createPassword.length < 12) {
      setModalError('La contraseña debe tener al menos 12 caracteres');
      return;
    }
    if (createPassword !== createConfirm) {
      setModalError('Las contraseñas no coinciden');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post<UserCreateResponse>('/api/v1/admin/users', {
        full_name: createName.trim(),
        email: createEmail.trim(),
        password: createPassword,
        role: createRole,
      });
      setSuccessMsg('Usuario creado exitosamente');
      closeModal();
      await loadUsers();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setModalError('Este correo ya está registrado');
      } else {
        setModalError(err instanceof ApiError ? err.message : 'Error al crear usuario');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Update user ───────────────────────────────────────

  async function handleUpdate() {
    if (!editTarget) return;
    setModalError('');

    const body: Record<string, unknown> = {};
    if (editName.trim() !== editTarget.full_name) body.full_name = editName.trim();
    if (editEmail.trim() !== editTarget.email) body.email = editEmail.trim();
    if (editRole !== editTarget.role) body.role = editRole;
    if (editActive !== editTarget.is_active) body.is_active = editActive;

    if (Object.keys(body).length === 0) {
      setModalError('No hay cambios para guardar');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.patch<UserUpdateResponse>(`/api/v1/admin/users/${editTarget.id}`, body);
      setSuccessMsg('Usuario actualizado');
      closeModal();
      await loadUsers();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setModalError('Este correo ya está registrado');
      } else if (err instanceof ApiError && err.status === 400) {
        setModalError(err.message);
      } else {
        setModalError(err instanceof ApiError ? err.message : 'Error al actualizar');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Toggle active ─────────────────────────────────────

  async function handleToggleActive(u: UserItem) {
    try {
      await apiClient.patch<UserUpdateResponse>(`/api/v1/admin/users/${u.id}`, {
        is_active: !u.is_active,
      });
      setSuccessMsg(u.is_active ? 'Usuario desactivado' : 'Usuario activado');
      await loadUsers();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Error al cambiar estado');
    }
  }

  // ── Reset password ────────────────────────────────────

  async function handleResetPassword() {
    if (!editTarget) return;
    setModalError('');

    if (resetPassword.length < 12) {
      setModalError('La contraseña debe tener al menos 12 caracteres');
      return;
    }
    if (resetPassword !== resetConfirm) {
      setModalError('Las contraseñas no coinciden');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post(`/api/v1/admin/users/${editTarget.id}/reset-password`, {
        new_password: resetPassword,
      });
      setSuccessMsg('Contraseña actualizada');
      closeModal();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'Error al resetear contraseña');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Guards ────────────────────────────────────────────

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-terra-200 border-t-[#C4704A]" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Shield className="h-12 w-12 text-terra-300 mb-4" strokeWidth={1.5} />
        <p className="text-sm text-terra-500">
          Solo los administradores pueden acceder a esta página.
        </p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1
          className="text-2xl font-semibold text-[#2C2220]"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          Usuarios
        </h1>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-md bg-[#C4704A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#B0613D] focus:outline-none focus:ring-2 focus:ring-[#C4704A] focus:ring-offset-2 transition-colors"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          Nuevo Usuario
        </button>
      </div>

      {/* Success message */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3">
          <p className="text-sm text-emerald-700">{successMsg}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-terra-200 border-t-[#C4704A]" />
        </div>
      )}

      {/* User cards */}
      {!loading && users.length === 0 && (
        <div className="text-center py-12">
          <UserCog className="h-10 w-10 text-terra-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-terra-500">No hay usuarios registrados.</p>
        </div>
      )}

      {!loading && users.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="bg-[#FAF7F5] rounded-lg p-5 space-y-4"
              style={{ boxShadow: '0 2px 8px rgba(44,34,32,0.06)' }}
            >
              {/* Avatar + info */}
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C4704A] text-white text-sm font-semibold shrink-0">
                  {getInitials(u.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#2C2220] truncate">{u.full_name}</p>
                  <p className="text-xs text-[#4A3628]/70 truncate">{u.email}</p>
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[u.role] ?? 'bg-gray-100 text-gray-600'}`}
                >
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                    u.is_active
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-gray-100 text-gray-500 border border-gray-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`}
                  />
                  {u.is_active ? 'Activo' : 'Inactivo'}
                </span>
                {u.totp_enabled && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    2FA
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-[#D4A592]/20">
                <button
                  type="button"
                  onClick={() => openEdit(u)}
                  title="Editar"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#D4A592]/30 px-3 py-1.5 text-xs font-medium text-[#4A3628] hover:bg-[#F2E8E4] transition-colors"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => openResetPassword(u)}
                  title="Resetear contraseña"
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#D4A592]/30 px-3 py-1.5 text-xs font-medium text-[#4A3628] hover:bg-[#F2E8E4] transition-colors"
                >
                  <KeyRound className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Contraseña
                </button>
                {u.id !== user?.id && (
                  <button
                    type="button"
                    onClick={() => handleToggleActive(u)}
                    title={u.is_active ? 'Desactivar' : 'Activar'}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      u.is_active
                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                        : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    {u.is_active ? (
                      <>
                        <UserX className="h-3.5 w-3.5" strokeWidth={1.5} />
                        Desactivar
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
                        Activar
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal overlay ──────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div
            className="w-full max-w-md mx-4 bg-white rounded-lg shadow-xl"
            style={{ boxShadow: '0 8px 30px rgba(44,34,32,0.15)' }}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-terra-100 px-6 py-4">
              <h2 className="text-base font-semibold text-[#2C2220]">
                {modal === 'create' && 'Nuevo Usuario'}
                {modal === 'edit' && 'Editar Usuario'}
                {modal === 'reset-password' && 'Resetear Contraseña'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1 text-[#4A3628]/60 hover:text-[#2C2220] hover:bg-[#FAF7F5] transition-colors"
              >
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              {modalError && (
                <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2">
                  <p className="text-sm text-red-700">{modalError}</p>
                </div>
              )}

              {/* ── Create form ──────────────────────── */}
              {modal === 'create' && (
                <>
                  <div>
                    <label className="block text-xs font-medium tracking-[0.1em] uppercase text-[#4A3628] mb-1.5">
                      Nombre completo
                    </label>
                    <input
                      type="text"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      className="w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-4 py-3 text-[15px] text-[#2C2220] placeholder:text-gray-400 focus:border-b-2 focus:border-[#C4704A] focus:outline-none transition-colors"
                      placeholder="Nombre del usuario"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium tracking-[0.1em] uppercase text-[#4A3628] mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      className="w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-4 py-3 text-[15px] text-[#2C2220] placeholder:text-gray-400 focus:border-b-2 focus:border-[#C4704A] focus:outline-none transition-colors"
                      placeholder="correo@ejemplo.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium tracking-[0.1em] uppercase text-[#4A3628] mb-1.5">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      value={createPassword}
                      onChange={(e) => setCreatePassword(e.target.value)}
                      className="w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-4 py-3 text-[15px] text-[#2C2220] placeholder:text-gray-400 focus:border-b-2 focus:border-[#C4704A] focus:outline-none transition-colors"
                      placeholder="Mínimo 12 caracteres"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium tracking-[0.1em] uppercase text-[#4A3628] mb-1.5">
                      Confirmar contraseña
                    </label>
                    <input
                      type="password"
                      value={createConfirm}
                      onChange={(e) => setCreateConfirm(e.target.value)}
                      className="w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-4 py-3 text-[15px] text-[#2C2220] placeholder:text-gray-400 focus:border-b-2 focus:border-[#C4704A] focus:outline-none transition-colors"
                      placeholder="Repite la contraseña"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium tracking-[0.1em] uppercase text-[#4A3628] mb-1.5">
                      Rol
                    </label>
                    <select
                      value={createRole}
                      onChange={(e) => setCreateRole(e.target.value)}
                      className="w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-4 py-3 text-[15px] text-[#2C2220] focus:border-b-2 focus:border-[#C4704A] focus:outline-none transition-colors"
                    >
                      <option value="sanador">Sanador</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </>
              )}

              {/* ── Edit form ────────────────────────── */}
              {modal === 'edit' && editTarget && (
                <>
                  <div>
                    <label className="block text-xs font-medium tracking-[0.1em] uppercase text-[#4A3628] mb-1.5">
                      Nombre completo
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-4 py-3 text-[15px] text-[#2C2220] placeholder:text-gray-400 focus:border-b-2 focus:border-[#C4704A] focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium tracking-[0.1em] uppercase text-[#4A3628] mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-4 py-3 text-[15px] text-[#2C2220] placeholder:text-gray-400 focus:border-b-2 focus:border-[#C4704A] focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium tracking-[0.1em] uppercase text-[#4A3628] mb-1.5">
                      Rol
                    </label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-4 py-3 text-[15px] text-[#2C2220] focus:border-b-2 focus:border-[#C4704A] focus:outline-none transition-colors"
                    >
                      <option value="sanador">Sanador</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium tracking-[0.1em] uppercase text-[#4A3628]">
                      Activo
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditActive(!editActive)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        editActive ? 'bg-emerald-500' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                          editActive ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="text-sm text-[#4A3628]">
                      {editActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </>
              )}

              {/* ── Reset password form ──────────────── */}
              {modal === 'reset-password' && editTarget && (
                <>
                  <p className="text-sm text-[#4A3628]">
                    Cambiar contraseña de <span className="font-semibold">{editTarget.full_name}</span>
                  </p>
                  <div>
                    <label className="block text-xs font-medium tracking-[0.1em] uppercase text-[#4A3628] mb-1.5">
                      Nueva contraseña
                    </label>
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      className="w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-4 py-3 text-[15px] text-[#2C2220] placeholder:text-gray-400 focus:border-b-2 focus:border-[#C4704A] focus:outline-none transition-colors"
                      placeholder="Mínimo 12 caracteres"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium tracking-[0.1em] uppercase text-[#4A3628] mb-1.5">
                      Confirmar contraseña
                    </label>
                    <input
                      type="password"
                      value={resetConfirm}
                      onChange={(e) => setResetConfirm(e.target.value)}
                      className="w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-4 py-3 text-[15px] text-[#2C2220] placeholder:text-gray-400 focus:border-b-2 focus:border-[#C4704A] focus:outline-none transition-colors"
                      placeholder="Repite la contraseña"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 border-t border-terra-100 px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="rounded-md border border-[#D4A592]/40 px-4 py-2 text-sm font-medium text-[#4A3628] hover:bg-[#FAF7F5] transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (modal === 'create') handleCreate();
                  else if (modal === 'edit') handleUpdate();
                  else if (modal === 'reset-password') handleResetPassword();
                }}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-md bg-[#C4704A] px-4 py-2 text-sm font-medium text-white hover:bg-[#B0613D] focus:outline-none focus:ring-2 focus:ring-[#C4704A] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />}
                {modal === 'create' && 'Crear'}
                {modal === 'edit' && 'Guardar'}
                {modal === 'reset-password' && 'Actualizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
