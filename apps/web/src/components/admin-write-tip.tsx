export function AdminWriteTip({ children, testId = false }: { children: React.ReactNode; testId?: boolean }) {
  return (
    <p className="text-sm text-muted-foreground" {...(testId ? { 'data-testid': 'pd-light-tip' } : {})}>
      {children}
    </p>
  );
}
