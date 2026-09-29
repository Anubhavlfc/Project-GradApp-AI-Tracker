import { NOTES_MAX, notesChanged, parseNotes } from './notes';

describe('parseNotes', () => {
  it('keeps what was typed', () => {
    expect(parseNotes('Ask Dr. Lee about funding.')).toEqual({
      ok: true,
      notes: 'Ask Dr. Lee about funding.',
    });
  });

  it('drops blank space at both ends and makes line endings plain', () => {
    expect(parseNotes('  first\r\nsecond\rthird \n\n')).toEqual({
      ok: true,
      notes: 'first\nsecond\nthird',
    });
  });

  it('keeps blank lines and indentation inside the text', () => {
    expect(parseNotes('a\n\n  b')).toEqual({ ok: true, notes: 'a\n\n  b' });
  });

  it('saves nothing at all for an empty box or one with only spaces', () => {
    expect(parseNotes('')).toEqual({ ok: true, notes: null });
    expect(parseNotes(' \n\t ')).toEqual({ ok: true, notes: null });
  });

  it('allows exactly the limit and refuses one more, with a message', () => {
    expect(parseNotes('x'.repeat(NOTES_MAX))).toMatchObject({ ok: true });
    expect(parseNotes('x'.repeat(NOTES_MAX + 1))).toEqual({
      ok: false,
      message: 'Notes must be 10000 characters or fewer.',
    });
  });
});

describe('notesChanged', () => {
  it('is false when the box shows what is stored, however it is spaced', () => {
    expect(notesChanged('Same', 'Same')).toBe(false);
    expect(notesChanged('  Same \n', 'Same')).toBe(false);
    expect(notesChanged('', null)).toBe(false);
    expect(notesChanged('   ', null)).toBe(false);
  });

  it('is true when saving would store something different', () => {
    expect(notesChanged('Different', 'Same')).toBe(true);
    expect(notesChanged('New', null)).toBe(true);
    expect(notesChanged('', 'Old')).toBe(true);
  });

  it('is true for text that cannot be saved, so it is never mistaken for a saved state', () => {
    expect(notesChanged('x'.repeat(NOTES_MAX + 1), null)).toBe(true);
  });
});
