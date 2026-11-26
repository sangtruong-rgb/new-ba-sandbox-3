// The sign-up rules, shared by the form and POST /api/auth/sign-up.

export const MIN_PASSWORD = 8;

export type SignUpProblem = 'invalid_email' | 'password_too_short';

/** After trimming: an "@" and a dot somewhere after it. */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  return at >= 0 && trimmed.slice(at + 1).includes('.');
}

export function isLongEnough(password: string): boolean {
  return password.length >= MIN_PASSWORD;
}

/** The first problem, the email first when both are wrong; null when both are good. */
export function signUpProblem(email: string, password: string): SignUpProblem | null {
  if (!isValidEmail(email)) return 'invalid_email';
  if (!isLongEnough(password)) return 'password_too_short';
  return null;
}
