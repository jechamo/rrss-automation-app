// Tipos compartidos de los conectores de media (REQ-005).

/** Una opcion seleccionable en el modal de generacion (modelo de video, voz, avatar). */
export interface MediaOption {
  id: string;
  label: string;
  hint?: string;
  /** Preescucha de voz (audio) o miniatura de avatar (imagen/video), si el proveedor la da. */
  preview?: string;
}

export type OptionKind = "video" | "voice" | "avatar";
