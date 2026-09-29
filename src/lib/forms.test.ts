import { z } from 'zod';
import { parseForm } from './forms';

function buildForm(html: string) {
  const form = document.createElement('form');
  form.innerHTML = html;
  return form;
}

describe('parseForm', () => {
  const schema = z.object({ name: z.string().min(1, 'Enter a name.'), when: z.string() });

  it('returns the parsed values when everything is valid', () => {
    const form = buildForm('<input name="name" value="Ada"><input name="when" value="">');
    expect(parseForm(schema, form)).toEqual({ ok: true, data: { name: 'Ada', when: '' } });
  });

  it('returns one message per invalid field, the first one found', () => {
    const form = buildForm('<input name="name" value=""><input name="when" value="">');
    expect(parseForm(schema, form)).toEqual({ ok: false, errors: { name: 'Enter a name.' } });
  });

  it('catches a date the browser could not read instead of treating it as blank', () => {
    const form = buildForm('<input name="name" value="Ada"><input name="when" type="date">');
    const when = form.elements.namedItem('when') as HTMLInputElement;
    // jsdom does not model half-typed dates, so stand in for what a browser reports.
    Object.defineProperty(when, 'validity', { value: { badInput: true } });
    expect(parseForm(schema, form)).toEqual({
      ok: false,
      errors: { when: 'Enter a valid date.' },
    });
  });

  it('words the message for the kind of box', () => {
    const form = buildForm(
      '<input name="name" value="Ada"><input name="when" type="datetime-local"><input name="n" type="number">',
    );
    for (const name of ['when', 'n']) {
      Object.defineProperty(form.elements.namedItem(name), 'validity', {
        value: { badInput: true },
      });
    }
    const result = parseForm(z.object({ name: z.string(), when: z.string().default('') }), form);
    expect(result).toEqual({
      ok: false,
      errors: { when: 'Enter a valid date and time.', n: 'Enter a valid number.' },
    });
  });
});
