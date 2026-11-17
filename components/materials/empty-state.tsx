export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[22px] border-2 border-dashed border-border bg-card p-8 text-center font-semibold text-muted-foreground">
      {children}
    </div>
  );
}
