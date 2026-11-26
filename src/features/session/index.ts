// The session feature: the sign-in form on /dang-nhap and "Đăng xuất" in the list header.
import { SignInForm } from './SignInForm';
import { SignOut } from './SignOut';

export const id = 'session';

export const slots = [
  { slot: 'sign-in-form', order: 0, Component: SignInForm },
  { slot: 'header-action', order: 0, Component: SignOut },
];

export const routes: string[] = [];
export const storageKeys: string[] = [];
export const shortcuts: string[] = [];
