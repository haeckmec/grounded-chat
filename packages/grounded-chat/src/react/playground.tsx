import { useEffect, useState, type ReactNode } from 'react';

/** One tally on the playground: its label and the key of the stats endpoint's field. */
export type PlaygroundFigure = [label: string, key: string];

/** Classes for the `PlaygroundStats` tally, by slot. */
export interface PlaygroundStatsClassNames {
  list: string;
  item: string;
  label: string;
  value: string;
}

const DEFAULT_STATS_CLASSES: PlaygroundStatsClassNames = {
  list: 'gc-stats',
  item: 'gc-stat',
  label: 'gc-stat-label',
  value: 'gc-stat-value',
};

/**
 * The live tally of red-team attempts, refreshed while the page is open. Reads a JSON object of
 * counts from the host's stats endpoint (the `/admin` stats handler serves one) and shows the
 * figures in the given order; a count not loaded yet shows as a dash.
 */
export function PlaygroundStats({
  statsUrl,
  figures,
  refreshMs = 10_000,
  classNames,
  fetch: fetcher,
}: {
  statsUrl: string;
  figures: readonly PlaygroundFigure[];
  refreshMs?: number;
  classNames?: Partial<PlaygroundStatsClassNames>;
  /** The host's fetch, usually the global one. */
  fetch: typeof fetch;
}) {
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const classes = { ...DEFAULT_STATS_CLASSES, ...classNames };

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetcher(statsUrl, { cache: 'no-store' })
        .then((response) => (response.ok ? response.json() : null))
        .then((next: Record<string, number> | null) => {
          if (!cancelled && next) setStats(next);
        })
        .catch(() => {});
    void load();
    const timer = setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [statsUrl, refreshMs, fetcher]);

  return (
    <dl aria-live="polite" className={classes.list}>
      {figures.map(([label, key]) => (
        <div key={label} className={classes.item}>
          <dt className={classes.label}>{label}</dt>
          <dd className={classes.value}>{stats?.[key] ?? '–'}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Classes for the `Playground` frame, by slot. */
export interface PlaygroundClassNames {
  root: string;
  header: string;
  title: string;
  intro: string;
}

const DEFAULT_PLAYGROUND_CLASSES: PlaygroundClassNames = {
  root: 'gc-playground',
  header: 'gc-playground-header',
  title: 'gc-playground-title',
  intro: 'gc-playground-intro',
};

/**
 * The red-team page's frame: a title, what counts as a failure, the live tally, and the chat
 * (a `ChatWidget` whose turns the host marks as attempts) as children.
 */
export function Playground({
  title,
  intro,
  stats,
  classNames,
  children,
}: {
  title: string;
  intro: ReactNode;
  stats?: ReactNode;
  classNames?: Partial<PlaygroundClassNames>;
  children: ReactNode;
}) {
  const classes = { ...DEFAULT_PLAYGROUND_CLASSES, ...classNames };
  return (
    <div className={classes.root}>
      <header className={classes.header}>
        <h1 className={classes.title}>{title}</h1>
        <p className={classes.intro}>{intro}</p>
        {stats}
      </header>
      {children}
    </div>
  );
}
