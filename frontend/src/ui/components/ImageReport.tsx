import type { ParsedImage } from '../../core/types';
import { useT } from '../i18n';

export function ImageReport({ image, src }: { image: ParsedImage; src?: string }) {
  const t = useT();
  const m = image.meta;
  const rows: [string, string][] = [
    [t.fields.format ?? 'Format', m.format.toUpperCase()],
    [t.fields.size ?? 'Size', `${m.width}×${m.height}`],
    ...Object.entries(m.exif),
    ...Object.entries(m.pngText).map(([k, v]) => [`PNG ${k}`, v.length > 160 ? `${v.slice(0, 160)}…` : v] as [string, string]),
  ];
  if (m.c2pa.present) rows.push(['C2PA', `${m.c2pa.issuers.join(', ') || '?'}${m.c2pa.aiClaim ? ' · trainedAlgorithmicMedia' : ''}`]);
  const heat = image.heatmap;
  return (
    <section className="card image-report">
      <h3>{t.imageTitle}</h3>
      <div className="image-wrap">
        {src ? <img src={src} alt={t.imageTitle} /> : <div className="image-ph" aria-hidden="true" />}
        {heat && (
          <div className="heat" role="img" aria-label={t.heatmap} style={{ gridTemplateColumns: `repeat(${heat[0]?.length ?? 1}, 1fr)` }}>
            {heat.flatMap((row, y) => row.map((v, x) => <span key={`${x}-${y}`} style={{ opacity: v * 0.6 }} />))}
          </div>
        )}
      </div>
      {heat && <p className="muted small">{t.heatmap}</p>}
      <h4>{t.metadata}</h4>
      <table className="table">
        <tbody>{rows.map(([k, v]) => <tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody>
      </table>
      <p className="muted small">{t.synthid}</p>
    </section>
  );
}
