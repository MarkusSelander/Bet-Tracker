import { useMemo, useState } from 'react';
import fixtures from '../data/arsenalFixtures.json';
import {
  daysUntil,
  focusTeamName,
  groupByMonth,
  nextFixture,
  roundLabel,
  sideCounts,
  tournamentOptions,
  withFocus,
} from '../lib/fixtureBoard';
import { Metric, MetricRail } from './ds/Metric';

const cardClass = 'panel';

function formatWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return {
    day: date.toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' }),
    time: date.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }),
    long: date.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' }),
  };
}

function untilLabel(iso) {
  const days = daysUntil(iso);
  if (days < 0) return 'Spilt';
  if (days === 0) return 'I dag';
  if (days === 1) return 'I morgen';
  return `Om ${days} dager`;
}

function ColorDot({ color }) {
  if (!color) return null;
  return <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />;
}

function Stat({ label, value, hint, testId }) {
  return <Metric label={label} value={<span className="block truncate">{value}</span>} hint={hint} testId={testId} />;
}

export default function FixtureBoard() {
  const [tournament, setTournament] = useState('all');
  const focus = useMemo(() => focusTeamName(fixtures), []);
  const options = useMemo(() => tournamentOptions(fixtures), []);
  const visible = useMemo(() => {
    const selected = tournament === 'all' ? fixtures : fixtures.filter((match) => match.tournament === tournament);
    return selected.map((match) => withFocus(match, focus));
  }, [focus, tournament]);
  const next = useMemo(() => nextFixture(visible), [visible]);
  const groups = useMemo(() => groupByMonth(visible.filter((match) => match.id !== next?.id)), [visible, next]);
  const counts = useMemo(() => sideCounts(visible, focus), [visible, focus]);
  const nextWhen = next ? formatWhen(next.start) : null;
  const period = useMemo(() => {
    if (visible.length === 0) return '';
    const first = formatWhen(visible[0].start);
    const last = formatWhen(visible[visible.length - 1].start);
    if (!first || !last || first.long === last.long) return first?.long || '';
    return `${first.long} – ${last.long}`;
  }, [visible]);

  return (
    <div className="space-y-4" data-testid="fixture-board">
      <MetricRail columns="lg:grid-cols-4">
        <Stat label="Kamper" value={visible.length} hint={period} testId="fixture-count" />
        <Stat label="Hjemme" value={counts.home} hint={focus} />
        <Stat label="Borte" value={counts.away} hint={focus} />
        <Stat
          label="Neste"
          value={next?.opponent || '—'}
          hint={next ? untilLabel(next.start) : 'Ingen kamp'}
          testId="fixture-next-name"
        />
      </MetricRail>

      <div className="flex flex-wrap gap-2" data-testid="fixture-filters">
        <button
          type="button"
          onClick={() => setTournament('all')}
          className={`rounded-full border px-3 py-1 text-xs ${
            tournament === 'all'
              ? 'border-border bg-elevated text-text-primary'
              : 'border-hairline text-text-secondary hover:border-border hover:text-text-primary'
          }`}
        >
          Alle {fixtures.length}
        </button>
        {options.map(([name, count]) => (
          <button
            key={name}
            type="button"
            onClick={() => setTournament(name)}
            className={`rounded-full border px-3 py-1 text-xs ${
              tournament === name
                ? 'border-border bg-elevated text-text-primary'
                : 'border-hairline text-text-secondary hover:border-border hover:text-text-primary'
            }`}
          >
            {name} {count}
          </button>
        ))}
      </div>

      {next ? (
        <article className={`${cardClass} overflow-hidden`} data-testid="next-fixture">
          <div className="h-1" style={{ backgroundColor: next.tournamentColor || '#cc0000' }} />
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
              <span>{next.tournament}</span>
              <span>{untilLabel(next.start)}</span>
            </div>
            <div>
              <p className="eyebrow mb-1.5">Neste kamp</p>
              <h2 className="text-xl sm:text-2xl font-semibold">
                {focus}
                <span className="text-text-muted font-normal"> mot </span>
                <span className="inline-flex items-center gap-2">
                  <ColorDot color={next.opponentColor} />
                  {next.opponent}
                </span>
              </h2>
            </div>
            <dl className="grid gap-3 sm:grid-cols-4 text-sm">
              <div>
                <dt className="eyebrow">Når</dt>
                <dd>{nextWhen?.day}</dd>
                <dd className="text-text-secondary tabular-nums">{nextWhen?.time}</dd>
              </div>
              <div>
                <dt className="eyebrow">Bane</dt>
                <dd>{next.side}</dd>
              </div>
              <div>
                <dt className="eyebrow">Runde</dt>
                <dd>{roundLabel(next) || '—'}</dd>
              </div>
              <div>
                <dt className="eyebrow">Stadion</dt>
                <dd>{next.venue || '—'}</dd>
                {next.city ? <dd className="text-text-secondary">{next.city}</dd> : null}
              </div>
            </dl>
          </div>
        </article>
      ) : null}

      {groups.length > 0 ? (
        <div className={`${cardClass} overflow-hidden`}>
          {groups.map((group) => (
            <section key={group.key}>
              <h3 className="border-b border-hairline bg-sunken/60 px-4 py-2 text-[13px] font-medium capitalize">
                {group.label}
              </h3>
              <ul>
                {group.matches.map((match) => {
                  const when = formatWhen(match.start);
                  return (
                    <li
                      key={match.id}
                      className="grid grid-cols-1 sm:grid-cols-[7.5rem_4.5rem_minmax(0,1fr)_auto] gap-1 sm:gap-3 items-center border-b border-hairline px-4 py-2.5 transition-colors last:border-b-0 hover:bg-elevated/40"
                    >
                      <span className="text-xs text-text-muted">
                        <span className="block">{when?.day}</span>
                        <span className="tabular-nums">{when?.time}</span>
                      </span>
                      <span className="text-[11px] uppercase tracking-wide text-text-secondary">{match.side}</span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 text-sm">
                          <ColorDot color={match.opponentColor} />
                          <span className="truncate">{match.opponent}</span>
                        </span>
                        <span className="block text-[11px] text-text-muted truncate">
                          {match.tournament}
                          {roundLabel(match) ? ` · ${roundLabel(match)}` : ''}
                        </span>
                      </span>
                      <span className="text-xs text-text-secondary sm:text-right truncate">
                        {match.city || match.venue}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
