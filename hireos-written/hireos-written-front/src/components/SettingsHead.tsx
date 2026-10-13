export function SettingsHead({ title, scope }: { title: string; scope: string }) {
  return (
    <h2 className="section-title">
      {title}
      <span className="scope-tag">{scope}</span>
    </h2>
  );
}
