export const TABLE_THEMES = ["river", "walnut", "garden"] as const;
export type TableTheme = (typeof TABLE_THEMES)[number];

export function TableBackground({ theme }: { theme: TableTheme }) {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <img
        src={`assets/theme-${theme}.png`}
        alt=""
        className="pixelated size-full object-cover"
        draggable={false}
      />
      <div className="absolute inset-0 bg-background/25" />
    </div>
  );
}
