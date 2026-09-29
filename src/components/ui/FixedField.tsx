type FixedFieldProps = {
  label: string;
  name: string;
  value: string;
  /** What to show in place of a control. */
  text: string;
};

/** A value that is decided already: shown as text, and still sent with the form. */
export function FixedField({ label, name, value, text }: FixedFieldProps) {
  return (
    <div className="space-y-1.5">
      <p className="font-medium">{label}</p>
      <p className="break-words">{text}</p>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
