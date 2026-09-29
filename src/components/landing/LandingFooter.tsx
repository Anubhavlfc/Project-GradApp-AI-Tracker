import { Link } from 'react-router';
import { brand } from '@/config/brand';
import { Container } from './Container';

const link =
  'focus-ring -mx-1 inline-block rounded-sm px-1 py-1.5 text-fg-muted underline-offset-4 hover:text-fg hover:underline';

export function LandingFooter({ signedIn }: { signedIn: boolean }) {
  return (
    <footer>
      <Container className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-fg-muted">
          <span className="font-semibold text-fg">{brand.name}</span> &copy;{' '}
          {new Date().getFullYear()}
        </p>
        <ul role="list" className="flex flex-wrap gap-x-6">
          {signedIn ? (
            <li>
              <Link to="/app" className={link}>
                Open the app
              </Link>
            </li>
          ) : (
            <>
              <li>
                <Link to="/login" className={link}>
                  Sign in
                </Link>
              </li>
              <li>
                <Link to="/signup" className={link}>
                  Create account
                </Link>
              </li>
            </>
          )}
        </ul>
      </Container>
    </footer>
  );
}
