import type { Task } from '../../../../shared/tasks/types';
import { toggleDone, usePending } from './change';
import s from './done-delete.module.css';

export function RowCheckbox({ task, showMessage }: { task: Task; showMessage(text: string | null): void }) {
  const busy = usePending(task.id);
  return (
    <input
      type="checkbox"
      className={s.tick}
      aria-label={`Đánh dấu xong: ${task.title}`}
      checked={task.done}
      disabled={busy}
      onChange={() => void toggleDone(task, showMessage)}
    />
  );
}
