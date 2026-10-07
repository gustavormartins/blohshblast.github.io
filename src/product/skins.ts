export interface SkinDefinition {
  id: string;
  label: string;
  minLevel: number;
}

export const SKINS: readonly SkinDefinition[] = [
  { id: 'skin-blohsh', label: 'Blohsh Original', minLevel: 1 },
  { id: 'skin-tty', label: 'TTY / Shell', minLevel: 2 },
  { id: 'skin-happier', label: 'Era Happier', minLevel: 4 },
  { id: 'skin-sushi', label: 'Sushi Bar', minLevel: 6 },
  { id: 'skin-halley', label: 'Cometa Halley', minLevel: 8 }
];
