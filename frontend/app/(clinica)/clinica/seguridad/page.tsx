'use client';

import { useState, useEffect, useRef } from 'react';
import { Shield, ShieldCheck, Copy, Check, Loader2 } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api/client';
import { getMe } from '@/lib/api/auth';
import { useAuthStore } from '@/store/auth';

interface SetupData {
  secret: string;
  qr_uri: string;
}

export default function SecurityPage() {
  const { user, setAuth, accessToken } = useAuthStore();
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Redirect non-admin users
  const isAdmin = user?.role === 'admin';
  const has2fa = user?.has_2fa ?? false;

  // Refresh user data on mount
  useEffect(() => {
    async function refreshUser() {
      try {
        const me = await getMe();
        if (accessToken) {
          setAuth(me, accessToken);
        }
      } catch {
        // Silently fail — user data from store is still valid
      }
    }
    refreshUser();
  }, [accessToken, setAuth]);

  async function handleSetup() {
    setLoadingSetup(true);
    setErrorMsg('');
    try {
      const res = await apiClient.post<SetupData>('/api/v1/auth/2fa/setup');
      setSetupData(res);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `Error ${err.status}: ${err.message}`
          : 'No se pudo iniciar la configuración de 2FA';
      setErrorMsg(msg);
    } finally {
      setLoadingSetup(false);
    }
  }

  async function handleVerify() {
    if (code.length !== 6) return;
    setStatus('loading');
    setErrorMsg('');
    try {
      await apiClient.post('/api/v1/auth/2fa/verify', { code });
      setStatus('success');
      setSetupData(null);
      setCode('');
      // Refresh user to update has_2fa
      try {
        const freshUser = await getMe();
        if (accessToken) {
          setAuth(freshUser, accessToken);
        }
      } catch {
        // User will see success anyway
      }
    } catch (err) {
      setStatus('error');
      const msg =
        err instanceof ApiError
          ? err.status === 400
            ? 'Código inválido. Verifica e intenta de nuevo.'
            : `Error ${err.status}: ${err.message}`
          : 'Error al verificar el código';
      setErrorMsg(msg);
    }
  }

  function handleCodeChange(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (status === 'error') setStatus('idle');
  }

  async function copySecret() {
    if (!setupData) return;
    try {
      await navigator.clipboard.writeText(setupData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text
    }
  }

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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page title */}
      <h1
        className="text-2xl font-semibold text-[#2C2220]"
        style={{ fontFamily: 'Playfair Display, serif' }}
      >
        Seguridad
      </h1>

      {/* 2FA Status card */}
      <div className="bg-white rounded-lg border border-terra-100 p-6 space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck
            className={`h-6 w-6 ${has2fa ? 'text-emerald-600' : 'text-terra-300'}`}
            strokeWidth={1.5}
          />
          <div>
            <h2 className="text-base font-semibold text-[#2C2220]">
              Autenticación de dos factores (2FA)
            </h2>
            <p className="text-sm text-terra-500 mt-0.5">
              Protege tu cuenta con un código temporal de tu aplicación de autenticación.
            </p>
          </div>
        </div>

        {/* Current status badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-terra-600">Estado:</span>
          {has2fa ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Activado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-terra-50 text-terra-500 border border-terra-200">
              <span className="w-1.5 h-1.5 rounded-full bg-terra-300" />
              No configurado
            </span>
          )}
        </div>

        {/* Success message */}
        {status === 'success' && (
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3">
            <Check className="h-4 w-4 text-emerald-600 shrink-0" strokeWidth={1.5} />
            <p className="text-sm text-emerald-700">
              2FA configurado exitosamente. Tu cuenta ahora está protegida.
            </p>
          </div>
        )}

        {/* Error message (top-level) */}
        {errorMsg && status !== 'loading' && !setupData && (
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-700">{errorMsg}</p>
          </div>
        )}

        {/* Setup button (only when 2FA not enabled and no setup in progress) */}
        {!has2fa && !setupData && status !== 'success' && (
          <button
            type="button"
            onClick={handleSetup}
            disabled={loadingSetup}
            className="inline-flex items-center gap-2 rounded-md bg-[#C4704A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#B0613D] focus:outline-none focus:ring-2 focus:ring-[#C4704A] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loadingSetup ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                Generando…
              </>
            ) : (
              <>
                <Shield className="h-4 w-4" strokeWidth={1.5} />
                Configurar 2FA
              </>
            )}
          </button>
        )}

        {/* Setup flow */}
        {setupData && (
          <div className="space-y-5 border-t border-terra-100 pt-5">
            <div>
              <h3 className="text-sm font-semibold text-[#2C2220] mb-1">
                Paso 1: Configura tu aplicación
              </h3>
              <p className="text-sm text-terra-500">
                Abre tu aplicación de autenticación (Google Authenticator, Authy, etc.)
                y escanea el código QR o ingresa la clave secreta manualmente.
              </p>
            </div>

            {/* otpauth link */}
            <div>
              <a
                href={setupData.qr_uri}
                className="inline-flex items-center gap-2 text-sm text-[#C4704A] hover:text-[#B0613D] underline underline-offset-2 transition-colors"
              >
                Abrir en aplicación de autenticación
              </a>
              <p className="text-xs text-terra-400 mt-1">
                Toca el enlace desde tu dispositivo móvil para agregar automáticamente.
              </p>
            </div>

            {/* Secret key */}
            <div>
              <label className="text-xs font-medium text-terra-600 block mb-1.5">
                Clave secreta (entrada manual)
              </label>
              <div className="flex items-center gap-2">
                <code
                  className="flex-1 px-3 py-2.5 rounded-md bg-terra-50 border border-terra-200 text-sm font-mono tracking-wider text-[#2C2220] select-all cursor-text"
                  onClick={(e) => {
                    const range = document.createRange();
                    range.selectNodeContents(e.currentTarget);
                    window.getSelection()?.removeAllRanges();
                    window.getSelection()?.addRange(range);
                  }}
                >
                  {setupData.secret}
                </code>
                <button
                  type="button"
                  onClick={copySecret}
                  title="Copiar clave"
                  className="shrink-0 p-2 rounded-md border border-terra-200 text-terra-500 hover:bg-terra-50 hover:text-terra-700 focus:outline-none focus:ring-2 focus:ring-[#C4704A] transition-colors"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-600" strokeWidth={1.5} />
                  ) : (
                    <Copy className="h-4 w-4" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>

            {/* Verification code input */}
            <div>
              <h3 className="text-sm font-semibold text-[#2C2220] mb-1">
                Paso 2: Verifica el código
              </h3>
              <p className="text-sm text-terra-500 mb-3">
                Ingresa el código de 6 dígitos que aparece en tu aplicación.
              </p>

              <div className="flex items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="totp-code" className="sr-only">
                    Código de verificación
                  </label>
                  <input
                    ref={codeInputRef}
                    id="totp-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && code.length === 6) handleVerify();
                    }}
                    placeholder="000000"
                    className={`w-44 text-center text-2xl tracking-[0.5em] rounded-md border px-3 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-[#C4704A] ${
                      status === 'error'
                        ? 'border-red-300 bg-red-50'
                        : 'border-terra-200 bg-[#FAF7F5]'
                    }`}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={code.length !== 6 || status === 'loading'}
                  className="inline-flex items-center gap-2 rounded-md bg-[#C4704A] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#B0613D] focus:outline-none focus:ring-2 focus:ring-[#C4704A] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {status === 'loading' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                      Verificando…
                    </>
                  ) : (
                    'Verificar'
                  )}
                </button>
              </div>

              {/* Verification error */}
              {status === 'error' && errorMsg && (
                <p className="text-sm text-red-600 mt-2">{errorMsg}</p>
              )}
            </div>
          </div>
        )}

        {/* Already enabled info */}
        {has2fa && !setupData && status !== 'success' && (
          <p className="text-sm text-terra-500">
            Tu cuenta está protegida con autenticación de dos factores.
            Necesitarás tu aplicación de autenticación para iniciar sesión.
          </p>
        )}
      </div>
    </div>
  );
}
