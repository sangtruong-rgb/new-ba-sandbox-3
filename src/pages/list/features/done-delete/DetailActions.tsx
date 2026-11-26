import { useEffect, useRef } from 'react';
import { taskStore } from '../../../../shared/tasks/store';
import type { Task } from '../../../../shared/tasks/types';
import { Button } from '../../../../shared/ui/Field';
import { deleteTask, toggleDone, usePending } from './change';

type Props = { task: Task; close(): void; showMessage(text: string | null): void };

export function DetailActions({ task, close, showMessage }: Props) {
  const busy = usePending(task.id);
  const shown = useRef(false);
  useEffect(() => {
    shown.current = true;
    return () => {
      shown.current = false;
    };
  }, []);

  // Close only while this detail is still open: a late answer must not close another task's.
  const gone = () => {
    if (shown.current) close();
    taskStore.remove(task.id);
  };

  return (
    <>
      <Button variant="quiet" disabled={busy} onClick={() => void toggleDone(task, showMessage, gone)}>
        {task.done ? 'Bỏ đánh dấu xong' : 'Đánh dấu xong'}
      </Button>
      <Button variant="link" disabled={busy} onClick={() => void deleteTask(task, showMessage, gone)}>
        Xóa việc
      </Button>
    </>
  );
}
