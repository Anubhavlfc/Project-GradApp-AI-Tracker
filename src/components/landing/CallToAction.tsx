import { ButtonLink } from '@/components/ui';
import { cn } from '@/lib/cn';

// A step up from the app's 36px buttons, since here they are the main thing to notice. min-h adds
// height without clashing with the button's own h-9: Tailwind orders classes that set the same
// property by name, not by where they are written, so h-11 or text-base would lose.
const large = 'min-h-11 px-6';

type CallToActionProps = {
  signedIn: boolean;
  /** What the sign-up link says for a visitor. */
  signUpLabel: string;
  className?: string;
};

/** The two ways in for a visitor, or the one way on for someone already signed in. */
export function CallToAction({ signedIn, signUpLabel, className }: CallToActionProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:justify-center', className)}>
      {signedIn ? (
        <ButtonLink to="/app" variant="primary" className={large}>
          Open the app
        </ButtonLink>
      ) : (
        <>
          <ButtonLink to="/signup" variant="primary" className={large}>
            {signUpLabel}
          </ButtonLink>
          <ButtonLink to="/login" className={large}>
            Sign in
          </ButtonLink>
        </>
      )}
    </div>
  );
}
