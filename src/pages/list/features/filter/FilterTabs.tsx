// The status tabs of the list, each with its count.
import { useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { setFilter, type Filter } from '../../../../shared/list';
import { taskStore } from '../../../../shared/tasks/store';
import s from './FilterTabs.module.css';

type Tab = Filter & { label: string };

// "Tất cả" has no empty text of its own: with no task at all, the page shows its own.
const ALL: Tab = { id: 'all', label: 'Tất cả', test: () => true, emptyText: '' };
const TABS: Tab[] = [
  ALL,
  { id: 'open', label: 'Chưa xong', test: (t) => !t.done, emptyText: 'Không còn việc nào chưa xong.' },
  { id: 'done', label: 'Đã xong', test: (t) => t.done, emptyText: 'Tick một việc ở Chưa xong, nó sẽ hiện ở đây.' },
];

const subscribe = (fn: () => void) => taskStore.subscribe(fn);
const allTasks = () => taskStore.all();

export function FilterTabs() {
  const tasks = useSyncExternalStore(subscribe, allTasks);
  const [chosen, setChosen] = useState(ALL.id);

  // The list keeps the last filter set, so each opening of the page starts from "Tất cả" again.
  useLayoutEffect(() => setFilter(ALL), []);

  if (tasks.length === 0) return null;

  return TABS.map((tab) => (
    <button
      key={tab.id}
      type="button"
      className={s.tab}
      aria-pressed={tab.id === chosen}
      onClick={() => {
        setChosen(tab.id);
        setFilter(tab);
      }}
    >
      {tab.label} <span className={s.count}>{tasks.filter(tab.test).length}</span>
    </button>
  ));
}
