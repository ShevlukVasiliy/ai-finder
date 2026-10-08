import type { DocumentMeta } from '../../core/types';
import { useT } from '../i18n';

const KEYS: (keyof DocumentMeta)[] = ['format', 'author', 'creator', 'producer', 'application', 'created', 'modified', 'totalTimeMin', 'revisions', 'rsids', 'styles', 'fonts'];

export function DocumentMetaTable({ meta }: { meta?: DocumentMeta }) {
  const t = useT();
  const rows = meta
    ? KEYS.map((k) => [k, meta[k]] as const).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length))
    : [];
  return (
    <section className="block">
      <h3>{t.docMeta}</h3>
      {rows.length ? (
        <table className="table">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}><th scope="row">{t.fields[k] ?? k}</th><td>{Array.isArray(v) ? v.join(', ') : String(v)}</td></tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="muted">{t.noMeta}</p>
      )}
    </section>
  );
}
