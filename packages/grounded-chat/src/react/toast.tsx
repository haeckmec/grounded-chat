import type { WidgetClassNames } from './class-names.js';

/** A short message at the bottom of the screen, such as "To be implemented.". */
export function Toast({ message, classNames }: { message: string; classNames: Pick<WidgetClassNames, 'toastOuter' | 'toast'> }) {
  return (
    <div className={classNames.toastOuter}>
      <div className={classNames.toast}>{message}</div>
    </div>
  );
}
