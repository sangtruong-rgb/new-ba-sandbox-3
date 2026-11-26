// Orders the list by due date, marks late tasks and sums them up under the date.
import { setOrder, setTone } from '../../../../shared/list';
import { compareByDue, isLate } from './due';
import { Summary } from './Summary';

setOrder(compareByDue);
setTone((t, now) => (isLate(t, now) ? 'late' : 'normal'));

export const id = 'list/due-order';
export const slots = [{ slot: 'summary', order: 0, Component: Summary }];
export const routes: string[] = [];
export const storageKeys: string[] = [];
export const shortcuts: string[] = [];
