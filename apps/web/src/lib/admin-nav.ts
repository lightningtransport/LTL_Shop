export function shouldClientNavigate(event: {
  defaultPrevented: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  button: number;
}): boolean {
  return (
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    event.button === 0
  );
}

export function hrefString(href: string | { pathname?: string; search?: string }): string {
  if (typeof href === 'string') return href;
  return `${href.pathname ?? '/'}${href.search ?? ''}`;
}
