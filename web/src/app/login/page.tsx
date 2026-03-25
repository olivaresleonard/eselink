'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { setStoredSession, type AuthSession, getStoredSession } from '../../lib/auth';
import { ApiError, postApi } from '../../lib/api';

type LoginResponse = AuthSession;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getStoredSession()) {
      router.replace('/dashboard');
    }
  }, [router]);

  const loginMutation = useMutation({
    mutationFn: (payload: { email: string; password: string }) =>
      postApi<LoginResponse>('/auth/login', payload),
    onSuccess: (session) => {
      setStoredSession(session);
      router.replace('/dashboard');
    },
    onError: (mutationError) => {
      if (mutationError instanceof ApiError) {
        setError(mutationError.message);
        return;
      }

      setError('No pudimos iniciar sesión.');
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    loginMutation.mutate({
      email: email.trim(),
      password,
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f5fafc_0%,#eef5f9_100%)] px-4 py-10">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2.2rem] border border-white/50 bg-[rgba(255,255,255,0.72)] shadow-panel backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative overflow-hidden bg-night p-8 text-white sm:p-10 lg:p-12">
          <div className="absolute inset-0 bg-gradient-to-br from-sky/28 via-transparent to-moss/18" />
          <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-white/0 via-white/18 to-white/0" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.34em] text-white/70">EseLink</p>
            <h1 className="mt-5 max-w-xl font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              Todo tu trabajo operativo, en un solo lugar.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-white/72 sm:text-base">
              Entra a una vista pensada para ordenar ventas, mensajes, catálogo y entregas del
              día sin perder tiempo cambiando de pantalla.
            </p>

            <div className="mt-10 grid gap-4">
              {[
                'Detecta prioridades rápido y actúa sin dar vueltas.',
                'Mantén órdenes, mensajes y flex bajo la misma operación.',
                'Trabaja con acceso por usuario y más control interno.',
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[1.5rem] border border-white/10 bg-white/7 px-4 py-4 text-sm text-white/78"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="p-8 sm:p-10 lg:p-12">
          <div className="max-w-md">
            <div className="inline-flex items-center rounded-full border border-sky/15 bg-sky/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-sky">
              Acceso seguro
            </div>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-night">
              Accede a tu workspace
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink/60">
              Inicia sesión para entrar a tu panel de trabajo y continuar con la operación del día.
            </p>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink/70">
                  Correo corporativo
                </label>
                <input
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition placeholder:text-ink/30 focus:border-sky focus:ring-4 focus:ring-sky/10"
                  type="email"
                  placeholder="correo@empresa.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-ink/70">
                  Contraseña
                </label>
                <input
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 outline-none transition placeholder:text-ink/30 focus:border-sky focus:ring-4 focus:ring-sky/10"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              {error ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="w-full rounded-2xl bg-gradient-to-r from-sky to-moss px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky/15 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loginMutation.isPending ? 'Ingresando...' : 'Ingresar al panel'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
