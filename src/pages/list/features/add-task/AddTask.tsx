// The add form of the list page: a title, and an optional due date and time.
import { useRef, useState, type FormEvent } from 'react';
import { createLogger } from '../../../../app/log';
import { api } from '../../../../shared/api';
import { parseDue, validateTitle } from '../../../../shared/tasks/rules';
import { taskStore } from '../../../../shared/tasks/store';
import type { Task } from '../../../../shared/tasks/types';
import { DueFields } from '../../../../shared/ui/DueFields';
import { Button, Field } from '../../../../shared/ui/Field';
import s from './AddTask.module.css';

const log = createLogger('list/add-task');
const FAILED = 'Không thêm được việc. Thử lại.';
const NO_DUE = { date: '', time: '' };

const focus = (id: string) => document.getElementById(id)?.focus();

export function AddTask() {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(NO_DUE);
  const [titleError, setTitleError] = useState('');
  const [dueError, setDueError] = useState('');
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);
  // set at once, so a second submit before the next render adds nothing
  const inFlight = useRef(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    const name = validateTitle(title);
    const when = parseDue(due.date, due.time);
    setTitleError(name.ok ? '' : name.message);
    setDueError(when.ok ? '' : when.message);
    setFailed(false);
    if (!name.ok) return focus('add-title');
    if (!when.ok) return focus(when.message === 'Giờ theo dạng hh:mm' ? 'add-time' : 'add-date');

    inFlight.current = true;
    setSending(true);
    try {
      taskStore.upsert(await api<Task>('POST', '/api/tasks', { title: name.value, dueAt: when.value }));
      setTitle('');
      setDue(NO_DUE);
      focus('add-title');
    } catch (error) {
      log.error('the task was not added', error);
      setFailed(true);
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  // Below 1100px the due fields show only while the form is in use (see the CSS).
  const open = title !== '' || dueError !== '';

  return (
    <>
      <form className={open ? `${s.form} ${s.open}` : s.form} onSubmit={submit} noValidate>
        <Field
          id="add-title"
          label="Việc mới"
          placeholder="Thêm một việc…"
          autoComplete="off"
          value={title}
          onChange={setTitle}
          error={titleError}
        />
        <DueFields idPrefix="add" value={due} onChange={setDue} error={dueError} />
        <Button variant="primary" type="submit" disabled={sending}>
          Thêm
        </Button>
      </form>
      {failed ? (
        <p className={s.failed} role="alert">
          {FAILED}
        </p>
      ) : null}
    </>
  );
}
