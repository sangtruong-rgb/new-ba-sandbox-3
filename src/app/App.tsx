// The app: the routes, the session gate and the registry of features.
import { useState, type ReactNode } from 'react';
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ListPage } from '../pages/list/page';
import { SignInPage } from '../pages/sign-in/page';
import { SignUpPage } from '../pages/sign-up/page';
import { initSession, useSessionState } from './session';
import { RegistryProvider } from './slots';
import type { Registry } from './registry';

/** / without a user → /dang-nhap (with ?het-phien=1 after a 401 while signed in). */
function ListRoute() {
  const { user, status, expired } = useSessionState();
  if (status === 'ready' && !user) return <Navigate to={expired ? '/dang-nhap?het-phien=1' : '/dang-nhap'} replace />;
  return <ListPage />;
}

/** /dang-nhap and /dang-ky with a user → /. */
function AuthRoute({ page }: { page: 'sign-in' | 'sign-up' }) {
  const { user, status } = useSessionState();
  if (user) return <Navigate to="/" replace />;
  const ready = status === 'ready';
  return page === 'sign-in' ? <SignInPage ready={ready} /> : <SignUpPage ready={ready} />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ListRoute />} />
      <Route path="/dang-nhap" element={<AuthRoute page="sign-in" />} />
      <Route path="/dang-ky" element={<AuthRoute page="sign-up" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

/**
 * `registry`: createRegistry(features found on disk) in the app, fakes in tests.
 * `initialPath`: tests start there in memory; the app uses the browser's location.
 */
export function App({ registry, initialPath }: { registry: Registry; initialPath?: string }) {
  // The session starts with the app, before its first render.
  useState(() => {
    initSession();
    return true;
  });
  let routes: ReactNode = <AppRoutes />;
  routes =
    initialPath === undefined ? (
      // Location changes render at once: a navigation in a transition can wait on the
      // page's resources (fonts) and, on a busy dev server, was seen never to commit.
      <BrowserRouter useTransitions={false}>{routes}</BrowserRouter>
    ) : (
      <MemoryRouter initialEntries={[initialPath]}>{routes}</MemoryRouter>
    );
  return <RegistryProvider registry={registry}>{routes}</RegistryProvider>;
}
