"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  HandCoins,
  LoaderCircle,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { BrandLogo } from "./brand-logo";

export function Login({
  error,
  onLogin,
  serviceUnavailable = false,
}: {
  error: string;
  onLogin: (email: string, password: string) => Promise<void>;
  serviceUnavailable?: boolean;
}) {
  const [sending, setSending] = useState(false),
    [showPassword, setShowPassword] = useState(false),
    [capsLock, setCapsLock] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    const form = new FormData(event.currentTarget);
    setSending(true);
    try {
      await onLogin(
        String(form.get("email") ?? "").trim(),
        String(form.get("password") ?? ""),
      );
    } finally {
      setSending(false);
    }
  };
  return (
    <main className="access-page">
      <div className="access-ambient access-ambient-one" aria-hidden="true" />
      <div className="access-ambient access-ambient-two" aria-hidden="true" />
      <header className="access-header">
        <BrandLogo />
        <span>
          <span className="access-status-dot" />
          Espacio de trabajo del fondo
        </span>
      </header>
      <div className="access-layout">
        <section className="access-story">
          <p className="access-eyebrow">
            <span />
            CERCA DE LAS PERSONAS
          </p>
          <h1>
            Todo el fondo.
            <br />
            <span>
              Una experiencia
              <br />
              más simple.
            </span>
          </h1>
          <p className="access-description">
            Menos pasos para gestionar.
            <br />
            Más tiempo para acompañar a tus asociados.
          </p>
          <div className="access-workflow" aria-label="Áreas del fondo">
            <div>
              <span>
                <Users size={21} />
              </span>
              <b>Personas</b>
              <small>Todo empieza aquí</small>
            </div>
            <i aria-hidden="true" />
            <div>
              <span>
                <WalletCards size={21} />
              </span>
              <b>Ahorro</b>
              <small>Construir juntos</small>
            </div>
            <i aria-hidden="true" />
            <div>
              <span>
                <HandCoins size={21} />
              </span>
              <b>Bienestar</b>
              <small>Hacerlo posible</small>
            </div>
          </div>
          <div className="access-story-foot">
            <ShieldCheck size={18} />
            <p>
              Fondo de Empleados del
              <br />
              <b>Grupo Constructor del Tolima</b>
            </p>
          </div>
        </section>
        <section className="access-panel" aria-labelledby="access-title">
          <div className="access-panel-top">
            <span className="access-panel-icon">
              <ArrowUpRight size={22} />
            </span>
            <span>GESTIÓN FEGCON</span>
            <span className="access-private">
              <ShieldCheck size={13} />
              Acceso del equipo
            </span>
          </div>
          <h2 id="access-title">Qué gusto tenerte aquí.</h2>
          <p className="access-panel-description">
            Un espacio más simple para acompañar a nuestros asociados.
          </p>
          <form className="access-form" onSubmit={submit}>
            <label htmlFor="access-user">Usuario o correo electrónico</label>
            <div className="access-input-wrap">
              <Users size={17} />
              <input
                id="access-user"
                name="email"
                type="text"
                autoComplete="username"
                placeholder="Tu correo o usuario"
                required
                disabled={sending}
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <label htmlFor="access-password">Contraseña</label>
            <div className="access-input-wrap">
              <ShieldCheck size={17} />
              <input
                id="access-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Tu contraseña"
                required
                disabled={sending}
                onKeyUp={(event) =>
                  setCapsLock(event.getModifierState("CapsLock"))
                }
              />
              <button
                type="button"
                className="access-reveal"
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                aria-pressed={showPassword}
                onClick={() => setShowPassword((show) => !show)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {capsLock && (
              <small className="access-caps" role="status">
                Bloqueo de mayúsculas está activado.
              </small>
            )}
            {error && (
              <p className="access-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="access-submit" disabled={sending}>
              <span>
                {sending ? "Verificando acceso…" : "Entrar a mi espacio"}
              </span>
              {sending ? (
                <LoaderCircle size={19} className="access-spinner" />
              ) : (
                <ArrowRight size={19} />
              )}
            </button>
          </form>
          {serviceUnavailable && (
            <p className="access-service-note">
              No pudimos conectar con el servicio de acceso. Inténtalo de nuevo
              en un momento.
            </p>
          )}
          <footer className="access-support">
            ¿Necesitas acceso? Contacta al administrador del fondo.
          </footer>
        </section>
      </div>
      <footer className="access-footer">
        <span>FEGCON · Gestión con sentido humano</span>
        <span>Ahorro, confianza y bienestar.</span>
      </footer>
    </main>
  );
}
