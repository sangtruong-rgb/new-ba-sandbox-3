// The line under today's date: how many tasks are late and how many are due later today.
import { useSyncExternalStore } from 'react';
import { taskStore } from '../../../../shared/tasks/store';
import { useNow } from '../../../../shared/time';
import { isDueLaterToday, isLate } from './due';
import s from './due-order.module.css';

const subscribe = (fn: () => void) => taskStore.subscribe(fn);
const allTasks = () => taskStore.all();

export function Summary() {
  const now = useNow();
  const tasks = useSyncExternalStore(subscribe, allTasks);
  const late = tasks.filter((t) => isLate(t, now)).length;
  const today = tasks.filter((t) => isDueLaterToday(t, now)).length;
  return (
    <>
      {late > 0 ? <span className={s.late}>{`${late} việc trễ hạn`}</span> : null}
      {late > 0 && today > 0 ? ' · ' : null}
      {today > 0 ? `${today} việc hôm nay` : null}
    </>
  );
}
