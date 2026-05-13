export function DevBranchTag() {
  const branch = import.meta.env.VITE_BRANCH as string | undefined;
  if (!import.meta.env.DEV || !branch) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed top-2 left-1/2 z-[9999] -translate-x-1/2 select-none font-mono text-[11px] uppercase tracking-wider text-muted-foreground/70 bg-background/60 backdrop-blur-sm px-2 py-0.5"
    >
      {branch}
    </div>
  );
}
