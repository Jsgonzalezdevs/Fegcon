"use client";

import { isModuleLoadError, requestModuleReload } from "@/lib/module-recovery";
import { AlertTriangle } from "lucide-react";
import { Component, type ReactNode } from "react";

export class ModuleBoundary extends Component<
  { children: ReactNode; onHome: () => void; view: string },
  { failed: boolean; outdated: boolean }
> {
  state = { failed: false, outdated: false };
  static getDerivedStateFromError(error: unknown) {
    return { failed: true, outdated: isModuleLoadError(error) };
  }
  componentDidCatch(error: Error) {
    if (isModuleLoadError(error)) requestModuleReload(this.props.view);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="module-failure" role="alert">
        <AlertTriangle size={26} />
        <h1>
          {this.state.outdated
            ? "Hay una versión nueva del sistema"
            : "No pudimos abrir este módulo"}
        </h1>
        <p>
          {this.state.outdated
            ? "Actualiza la página para cargar los archivos nuevos. Tu sesión y los datos guardados se conservarán."
            : "Vuelve a intentarlo. Si el problema continúa, regresa al inicio y comunícalo al administrador del fondo."}
        </p>
        <div>
          <button
            onClick={() =>
              this.state.outdated
                ? requestModuleReload(this.props.view, { force: true })
                : this.setState({ failed: false, outdated: false })
            }
          >
            {this.state.outdated ? "Actualizar y abrir módulo" : "Reintentar"}
          </button>
          <button onClick={this.props.onHome}>Volver al inicio</button>
        </div>
      </section>
    );
  }
}
