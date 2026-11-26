// header-action on /: "Đăng xuất" ends the session on the server, then clears it in the page
// whatever the answer (the gate then goes to /dang-nhap with no message).
import { useSession } from '../../app/session';
import { createLogger } from '../../app/log';
import { api } from '../../shared/api';
import { Button } from '../../shared/ui/Field';

const log = createLogger('[session]');

export function SignOut() {
  const { clear } = useSession();

  async function signOut() {
    try {
      await api<void>('POST', '/api/auth/sign-out');
    } catch (e) {
      log.error('sign-out failed; the session is cleared in the page anyway', e);
    } finally {
      clear();
    }
  }

  return (
    <Button variant="link" onClick={() => void signOut()}>
      Đăng xuất
    </Button>
  );
}
