"use client";

import { CircleHelp } from "lucide-react";

/** Native disclosure remains accessible with mouse, touch, and keyboard. */
export function FieldHelp({
  title,
  children,
}: {
  title: string;
  children: string;
}) {
  return (
    <details className="field-help">
      <summary aria-label={`Ayuda: ${title}`}>
        <CircleHelp size={15} />
        <span>{title}</span>
      </summary>
      <p>{children}</p>
    </details>
  );
}
