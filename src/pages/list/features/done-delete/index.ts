// Marking a task done (row checkbox and detail button) and deleting it.
import { DetailActions } from './DetailActions';
import { RowCheckbox } from './RowCheckbox';

export const id = 'list/done-delete';
export const slots = [
  { slot: 'item-lead', order: 0, Component: RowCheckbox },
  { slot: 'detail-actions', order: 0, Component: DetailActions },
];
export const routes: string[] = [];
export const storageKeys: string[] = [];
export const shortcuts: string[] = [];
