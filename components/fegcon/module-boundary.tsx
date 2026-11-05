"use client";

import { AlertTriangle } from "lucide-react";
import { Component, type ReactNode } from "react";

export class ModuleBoundary extends Component<
  { children: ReactNode; onHome: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="module-failure" role="alert">
        <AlertTriangle size={26} />
        <h1>No pudimos abrir este módulo</h1>
        <p>
          Vuelve a intentarlo. Si el problema continúa, regresa al inicio y
          comunícalo al administrador del fondo.
        </p>
        <div>
          <button onClick={() => this.setState({ failed: false })}>
            Reintentar
          </button>
          <button onClick={this.props.onHome}>Volver al inicio</button>
        </div>
      </section>
    );
  }
}
