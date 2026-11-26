// The edit form of the open task: its title and due, "Lưu" and "Hủy".
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createLogger } from '../../../../app/log';
import { api, ApiError } from '../../../../shared/api';
import { toneOf } from '../../../../shared/list';
import { formatDue, parseDue, validateTitle } from '../../../../shared/tasks/rules';
import { taskStore } from '../../../../shared/tasks/store';
import type { Task } from '../../../../shared/tasks/types';
import { useNow } from '../../../../shared/time';
import { DueFields, dueToFields } from '../../../../shared/ui/DueFields';
import { Button, Field } from '../../../../shared/ui/Field';
import s from './EditTask.module.css';

const log = createLogger('list/edit-task');
const FAILED = 'Không lưu được. Thử lại.';

type Fields = { title: string; date: string; time: string };

const focus = (id: string) => document.getElementById(id)?.focus();

export function EditTask({ task, close }: { task: Task; close(): void }) {
  const now = useNow();
  // Only what was typed: an untouched field follows the task, also when it changes elsewhere.
  const [edits, setEdits] = useState<Partial<Fields>>({});
  const [titleError, setTitleError] = useState('');
  const [dueError, setDueError] = useState('');
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  // set at once, so a second Enter before the next render sends nothing
  const inFlight = useRef(false);
  const shown = useRef(false);
  useEffect(() => {
    shown.current = true;
    return () => {
      shown.current = false;
    };
  }, []);

  const saved: Fields = { title: task.title, ...dueToFields(task.dueAt) };
  const value: Fields = { ...saved, ...edits };
  const titleChanged = value.title !== saved.title;
  const dueChanged = value.date !== saved.date || value.time !== saved.time;
  const dirty = titleChanged || dueChanged;

  const edit = (patch: Partial<Fields>) => setEdits((e) => ({ ...e, ...patch }));

  async function save() {
    if (!dirty || inFlight.current) return;
    const name = validateTitle(value.title);
    const when = parseDue(value.date, value.time);
    setTitleError(name.ok ? '' : name.message);
    setDueError(when.ok ? '' : when.message);
    setFailed(false);
    if (!name.ok) return focus('edit-title');
    if (!when.ok) return focus(when.message === 'Giờ theo dạng hh:mm' ? 'edit-time' : 'edit-date');

    const sent = value;
    inFlight.current = true;
    setSaving(true);
    try {
      // only what changed, so the rest keeps what was saved elsewhere
      const answer = await api<Task>('PATCH', `/api/tasks/${task.id}`, {
        ...(titleChanged ? { title: name.value } : {}),
        ...(dueChanged ? { dueAt: when.value } : {}),
      });
      taskStore.upsert(answer);
      // the saved values show again; what was typed while saving stays
      setEdits((e) => {
        const rest = { ...e };
        for (const key of ['title', 'date', 'time'] as const) if (rest[key] === sent[key]) delete rest[key];
        return rest;
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // Close only while this detail is still open: a late answer must not close another task's.
        if (shown.current) close();
        taskStore.remove(task.id);
      } else if (!(error instanceof ApiError && error.status === 401)) {
        // A 401 is the session's business: the api client has already left the page.
        log.error('the task was not saved', error);
        setFailed(true);
      }
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void save();
  }

  function saveOnEnter(e: KeyboardEvent) {
    // an Enter that ends an input method's composition is not a save
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void save();
  }

  return (
    <form onSubmit={submit} noValidate>
      <h2 className={s.heading}>Sửa việc</h2>
      <div className={s.name}>
        <Field
          id="edit-title"
          label="Tên việc"
          multiline
          rows={3}
          value={value.title}
          onChange={(title) => edit({ title })}
          onKeyDown={saveOnEnter}
          error={titleError}
        />
      </div>
      <div className={s.due}>
        <DueFields idPrefix="edit" value={{ date: value.date, time: value.time }} onChange={edit} error={dueError} />
      </div>
      {task.dueAt && toneOf(task) === 'late' ? <p className={s.late}>Trễ · {formatDue(task.dueAt, now)}</p> : null}
      <p className={s.created}>Tạo lúc {formatDue(task.createdAt, now)}</p>
      <div className={s.buttons}>
        <Button variant="primary" type="submit" disabled={!dirty || saving}>
          {saving ? 'Đang lưu…' : 'Lưu'}
        </Button>
        <Button variant="quiet" onClick={close}>
          Hủy
        </Button>
      </div>
      {failed ? (
        <p className={s.failed} role="alert">
          {FAILED}
        </p>
      ) : null}
    </form>
  );
}
