// /: the list page frame. Header (Việc, the email, header-action), today's date, summary,
// filters, input, the list (item-lead in each row) and the detail column (detail and
// detail-actions while a task is selected).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { reloadTasks, useSessionState } from '../../app/session';
import { Slot } from '../../app/slots';
import { useListSettings, useSelection } from '../../shared/list';
import { formatDue, WEEKDAYS } from '../../shared/tasks/rules';
import { taskStore } from '../../shared/tasks/store';
import type { Task } from '../../shared/tasks/types';
import { useNow } from '../../shared/time';
import { Button } from '../../shared/ui/Field';
import s from './page.module.css';

const PAGE = 'list';
const HINT = 'Chọn một việc để xem và sửa.';
const EMPTY = 'Chưa có việc nào. Thêm việc đầu tiên ở ô phía trên.';
const LOADING = 'Đang tải…';
const LOAD_FAILED = 'Không tải được danh sách.';

/** "Thứ Sáu, 27 tháng 11": weekday, day and month, no padding, local time. */
export function dateTitle(d: Date): string {
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}`;
}

const subscribeTasks = (fn: () => void) => taskStore.subscribe(fn);
const allTasks = () => taskStore.all();

type HistoryState = { viecSelected?: boolean } | null;

/**
 * Opening a task from the list adds a history entry (in the click, not in an effect),
 * so the browser's Back clears the selection; the "← Danh sách" button and close()
 * go back over that entry.
 */
function useSelectionHistory(selectedId: string | null, select: (id: string | null) => void) {
  const location = useLocation();
  const navigate = useNavigate();
  const inEntry = !!(location.state as HistoryState)?.viecSelected;
  const wasInEntry = useRef(inEntry);

  // Back out of the entry: the selection clears.
  useEffect(() => {
    const was = wasInEntry.current;
    wasInEntry.current = inEntry;
    if (was && !inEntry && selectedId !== null) select(null);
  }, [selectedId, inEntry, select]);

  const open = useCallback(
    (id: string) => {
      select(id);
      if (!inEntry) navigate(location.pathname + location.search, { state: { viecSelected: true } });
    },
    [select, navigate, inEntry, location.pathname, location.search],
  );

  const close = useCallback(() => {
    select(null);
    if (inEntry) navigate(-1);
  }, [select, navigate, inEntry]);

  return { open, close };
}

function Row({
  task,
  now,
  late,
  selected,
  message,
  onSelect,
  showMessage,
}: {
  task: Task;
  now: Date;
  late: boolean;
  selected: boolean;
  message: string | null;
  onSelect(): void;
  showMessage(text: string | null): void;
}) {
  const classes = [s.row, task.done ? s.done : '', late ? s.late : '', selected ? s.selected : ''].filter(Boolean).join(' ');
  return (
    <div className={classes}>
      <Slot name="item-lead" page={PAGE} as="span" className={s.lead} props={{ task, showMessage }} />
      <span className={s.due}>{task.dueAt ? `${late ? 'Trễ · ' : ''}${formatDue(task.dueAt, now)}` : ''}</span>
      <button type="button" className={s.title} onClick={onSelect} aria-current={selected ? 'true' : undefined}>
        {task.title}
      </button>
      {message ? <p className={s.rowMessage}>{message}</p> : null}
    </div>
  );
}

export function ListPage() {
  const { user, status, load } = useSessionState();
  const now = useNow();
  const tasks = useSyncExternalStore(subscribeTasks, allTasks);
  const { order, tone, filter } = useListSettings();
  const { selectedId, select } = useSelection();
  const { open, close } = useSelectionHistory(selectedId, select);
  const [rowMessages, setRowMessages] = useState<Record<string, string>>({});
  const [actionMessage, setActionMessage] = useState<{ id: string; text: string } | null>(null);

  const mounted = status === 'ready' && user !== null && load !== 'idle' && load !== 'pending';
  const hasTasks = mounted && tasks.length > 0;
  const selected = mounted && selectedId !== null ? (tasks.find((t) => t.id === selectedId) ?? null) : null;

  const showRowMessage = useCallback((id: string, text: string | null) => {
    setRowMessages((m) => {
      const next = { ...m };
      if (text === null || text === '') delete next[id];
      else next[id] = text;
      return next;
    });
  }, []);

  const shown = tasks.filter((t) => filter.test(t)).sort((a, b) => order(a, b, now));

  let list;
  if (load === 'failed') {
    list = (
      <div className={s.empty}>
        <p className={s.emptyText}>{LOAD_FAILED}</p>
        <Button variant="quiet" onClick={() => void reloadTasks()}>
          Thử lại
        </Button>
      </div>
    );
  } else if (load === 'reloading') {
    list = <p className={s.empty}>{LOADING}</p>;
  } else if (tasks.length === 0) {
    list = <p className={s.empty}>{EMPTY}</p>;
  } else if (shown.length === 0) {
    list = <p className={s.empty}>{filter.emptyText}</p>;
  } else {
    list = shown.map((t) => (
      <Row
        key={t.id}
        task={t}
        now={now}
        late={tone(t, now) === 'late'}
        selected={t.id === selectedId}
        message={rowMessages[t.id] ?? null}
        onSelect={() => open(t.id)}
        showMessage={(text) => showRowMessage(t.id, text)}
      />
    ));
  }

  const wrapClasses = [s.wrap, hasTasks ? '' : s.solo, selected ? s.alone : ''].filter(Boolean).join(' ');

  return (
    <div className={s.page}>
      <header className={s.top}>
        <p className={s.logo}>Việc</p>
        {user ? (
          <div className={s.who}>
            <span className={s.email}>{user.email}</span>
            {mounted ? <Slot name="header-action" page={PAGE} as="span" /> : null}
          </div>
        ) : null}
      </header>
      <div className={wrapClasses}>
        <main className={s.main}>
          <h1 className={s.heading}>{dateTitle(now)}</h1>
          {mounted ? (
            <>
              <Slot name="summary" page={PAGE} className={s.summary} />
              <div className={s.tabs}>
                <Slot name="filters" page={PAGE} className={s.filters} />
              </div>
              <Slot name="input" page={PAGE} className={s.input} />
              <div className={s.list}>{list}</div>
            </>
          ) : (
            <p className={s.loading}>{LOADING}</p>
          )}
        </main>
        {hasTasks ? (
          <aside className={s.side} aria-label="Chi tiết">
            {selected ? (
              <>
                <button type="button" className={s.back} onClick={close}>
                  ← Danh sách
                </button>
                <Slot key={`detail:${selected.id}`} name="detail" page={PAGE} props={{ task: selected, close }} />
                <div className={s.more}>
                  <Slot
                    key={`actions:${selected.id}`}
                    name="detail-actions"
                    page={PAGE}
                    className={s.actions}
                    props={{
                      task: selected,
                      close,
                      showMessage: (text: string | null) => setActionMessage(text ? { id: selected.id, text } : null),
                    }}
                  />
                  {actionMessage && actionMessage.id === selected.id ? (
                    <p className={s.actionMessage}>{actionMessage.text}</p>
                  ) : null}
                </div>
              </>
            ) : (
              <p className={s.hint}>{HINT}</p>
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
