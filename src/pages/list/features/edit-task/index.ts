// Editing the open task's title and due in the detail slot.
import { EditTask } from './EditTask';

export const id = 'edit-task';
export const slots = [{ slot: 'detail', order: 0, Component: EditTask }];
export const routes: string[] = [];
export const storageKeys: string[] = [];
export const shortcuts: string[] = [];
