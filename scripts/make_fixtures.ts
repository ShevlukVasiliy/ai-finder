/**
 * Generates binary/document fixtures for parser tests into frontend/tests/fixtures/.
 * Everything is built from scratch (zip+XML for DOCX/ODT, pdf-lib for PDF, raw chunks for PNG/JPEG/WebP)
 * so the fixtures are deterministic and license-free.
 * Run: pnpm --dir frontend fixtures
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strToU8, zipSync, zlibSync } from 'fflate';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'tests', 'fixtures');
mkdirSync(out, { recursive: true });
const save = (name: string, data: Uint8Array | string) => {
  writeFileSync(join(out, name), data);
  console.log('wrote', name);
};

export const AI_RU = [
  'В современном мире технологии играют ключевую роль в жизни каждого человека. Важно отметить, что цифровизация открывает новые возможности для развития общества.',
  'Одним из ключевых аспектов является удобство. Современные сервисы позволяют решать задачи быстро, эффективно и без лишних усилий.',
  'Таким образом, технологии являются не только инструментом прогресса, но и вызовом. В заключение можно сказать, что их грамотное использование открывает широкий спектр возможностей.',
];
export const AI_EN = [
  "In today's fast-paced world, technology plays a pivotal role in shaping how we live, work, and communicate. It's important to note that this transformation brings both opportunities and challenges.",
  'One of the most significant benefits is connectivity. People communicate instantly across the globe, fostering collaboration and cultural exchange.',
  'In conclusion, technology is a powerful force. By leveraging its benefits, we can create a brighter, more connected future for everyone.',
];

// ---------- DOCX ----------
function docx(paragraphs: string[], opts: { application: string; creator: string; totalTime: number; revision: number; rsid: string; style?: string }) {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const body = paragraphs
    .map(
      (p) =>
        `<w:p w:rsidR="${opts.rsid}" w:rsidRDefault="${opts.rsid}"><w:pPr><w:pStyle w:val="${opts.style ?? 'Normal'}"/></w:pPr><w:r w:rsidRPr="${opts.rsid}"><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/></w:rPr><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`,
    )
    .join('');
  const files = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
    'word/document.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`),
    'word/styles.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="${W}"><w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="NormalWeb"><w:name w:val="Normal (Web)"/></w:style></w:styles>`,
    ),
    'docProps/core.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"><dc:creator>${opts.creator}</dc:creator><cp:revision>${opts.revision}</cp:revision><dcterms:created>2024-05-01T10:00:00Z</dcterms:created><dcterms:modified>2024-05-01T10:00:00Z</dcterms:modified></cp:coreProperties>`,
    ),
    'docProps/app.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>${opts.application}</Application><TotalTime>${opts.totalTime}</TotalTime></Properties>`,
    ),
  };
  return zipSync(files);
}

const longAi = [...AI_RU, ...AI_RU.map((p) => p.replace('технологии', 'инновации')), ...AI_RU.map((p) => p.replace('общества', 'бизнеса'))];
save('ai.docx', docx(longAi, { application: 'python-docx', creator: 'python-docx', totalTime: 1, revision: 1, rsid: '00A1B2C3', style: 'NormalWeb' }));
save(
  'human.docx',
  docx(
    [
      'Короче, поставил я в субботу роутер. Три часа возился!',
      'Позвонил в поддержку, там минут двадцать объясняли, где кнопка питания. Я говорю: кнопку нашёл, дело не в этом.',
      'В итоге поменял тип подключения на PPPoE, и всё заработало. Логин был на бумажке за холодильником.',
    ],
    { application: 'Microsoft Office Word', creator: 'Vasya', totalTime: 95, revision: 14, rsid: '00F1E2D3' },
  ),
);

// ---------- ODT ----------
const odtContent = `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"><office:font-face-decls><style:font-face style:name="Liberation Serif"/></office:font-face-decls><office:body><office:text>${AI_EN.map((p) => `<text:p text:style-name="Standard">${p.replace(/&/g, '&amp;').replace(/'/g, '&apos;')}</text:p>`).join('')}</office:text></office:body></office:document-content>`;
const odtMeta = `<?xml version="1.0" encoding="UTF-8"?><office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><office:meta><meta:generator>LibreOffice/7.6</meta:generator><meta:initial-creator>Jane</meta:initial-creator><meta:creation-date>2024-02-01T09:00:00</meta:creation-date><dc:date>2024-02-03T18:30:00</dc:date><meta:editing-cycles>7</meta:editing-cycles><meta:editing-duration>PT1H25M10S</meta:editing-duration></office:meta></office:document-meta>`;
save('sample.odt', zipSync({ mimetype: strToU8('application/vnd.oasis.opendocument.text'), 'content.xml': strToU8(odtContent), 'meta.xml': strToU8(odtMeta) }));

// ---------- RTF ----------
const rtfEscape = (s: string) => [...s].map((ch) => (ch.charCodeAt(0) > 127 ? `\\u${ch.charCodeAt(0)}?` : ch)).join('');
save(
  'sample.rtf',
  `{\\rtf1\\ansi\\ansicpg1251\\deff0{\\fonttbl{\\f0\\fnil Times New Roman;}}{\\info{\\author Pandoc}{\\operator pandoc}}{\\*\\generator Pandoc 3.1;}\\f0 ${AI_RU.map(rtfEscape).join('\\par\n')}\\par}`,
);

// ---------- TXT / MD ----------
save('sample.txt', `\uFEFF${AI_RU.join('\n\n')}\n`);
save('sample.md', `# Технологии\n\n${AI_RU.join('\n\n')}\n\n- **Плюс:** удобно\n- **Минус:** риски\n`);

// ---------- PDF ----------
const pdf = await PDFDocument.create();
pdf.setCreator('ReportLab PDF Library - www.reportlab.com');
pdf.setProducer('ReportLab PDF Library - www.reportlab.com');
pdf.setAuthor('anonymous');
const font = await pdf.embedFont(StandardFonts.Helvetica);
for (const para of [AI_EN, AI_EN]) {
  const page = pdf.addPage([595, 842]);
  let y = 800;
  for (const p of para) {
    const words = p.split(' ');
    let line = '';
    for (const w of words) {
      if ((line + w).length > 85) {
        page.drawText(line.trim(), { x: 40, y, size: 11, font });
        y -= 14;
        line = '';
      }
      line += `${w} `;
    }
    page.drawText(line.trim(), { x: 40, y, size: 11, font });
    y -= 30;
  }
}
save('sample.pdf', await pdf.save());

// ---------- PNG ----------
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff;
  for (const x of b) c = crcTable[(c ^ x) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(strToU8(type, true), 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
function png(w: number, h: number, extra: Uint8Array[]): Uint8Array {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const raw = new Uint8Array((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w * 3; x++) raw[y * (w * 3 + 1) + 1 + x] = (x * 7 + y * 3) & 0xff;
  return concat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), ...extra, chunk('IDAT', zlibSync(raw)), chunk('IEND', new Uint8Array()));
}
const tEXt = (k: string, v: string) => chunk('tEXt', concat(strToU8(k, true), new Uint8Array([0]), strToU8(v, true)));
save('sd.png', png(512, 512, [tEXt('parameters', 'a cat in space\nSteps: 20, Sampler: Euler a, CFG scale: 7, Seed: 42, Size: 512x512, Model: sd_xl_base_1.0'), tEXt('Software', 'ComfyUI')]));
save('c2pa.png', png(1024, 1024, [chunk('caBX', strToU8('....jumbc2pa.manifest....OpenAI....DALL-E....c2pa.actions..digitalSourceType..trainedAlgorithmicMedia', true))]));
save('plain.png', png(37, 23, []));

// ---------- JPEG (headers only; enough for metadata parsing) ----------
function seg(marker: number, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + data.length);
  out[0] = 0xff;
  out[1] = marker;
  out[2] = (data.length + 2) >> 8;
  out[3] = (data.length + 2) & 0xff;
  out.set(data, 4);
  return out;
}
function tiff(entries: [number, string][]): Uint8Array {
  // Little-endian TIFF with ASCII entries stored after the IFD.
  const n = entries.length;
  const ifdSize = 2 + n * 12 + 4;
  const strings = entries.map(([, v]) => strToU8(`${v}\0`, true));
  const total = 8 + ifdSize + strings.reduce((a, s) => a + s.length, 0);
  const b = new Uint8Array(total);
  const dv = new DataView(b.buffer);
  b.set([0x49, 0x49, 0x2a, 0x00]);
  dv.setUint32(4, 8, true);
  dv.setUint16(8, n, true);
  let strOff = 8 + ifdSize;
  entries.forEach(([tag], i) => {
    const e = 10 + i * 12;
    const s = strings[i]!;
    dv.setUint16(e, tag, true);
    dv.setUint16(e + 2, 2, true);
    dv.setUint32(e + 4, s.length, true);
    if (s.length <= 4) b.set(s, e + 8);
    else {
      dv.setUint32(e + 8, strOff, true);
      b.set(s, strOff);
      strOff += s.length;
    }
  });
  return b;
}
const IJG = [16, 11, 10, 16, 24, 40, 51, 61, 12, 12, 14, 19, 26, 58, 60, 55, 14, 13, 16, 24, 40, 57, 69, 56, 14, 17, 22, 29, 51, 87, 80, 62, 18, 22, 37, 56, 68, 109, 103, 77, 24, 35, 55, 64, 81, 104, 113, 92, 49, 64, 78, 87, 103, 121, 120, 101, 72, 92, 95, 98, 112, 100, 103, 99];
const q = (quality: number) => {
  const scale = quality < 50 ? 5000 / quality : 200 - quality * 2;
  return IJG.map((v) => Math.min(255, Math.max(1, Math.floor((v * scale + 50) / 100))));
};
const sof = (w: number, h: number) => new Uint8Array([8, h >> 8, h & 255, w >> 8, w & 255, 1, 1, 0x11, 0]);
function jpeg(w: number, h: number, exif: [number, string][] | null, table: number[], xmp?: string): Uint8Array {
  const parts = [new Uint8Array([0xff, 0xd8])];
  if (exif) parts.push(seg(0xe1, concat(strToU8('Exif\0\0', true), tiff(exif))));
  if (xmp) parts.push(seg(0xe1, concat(strToU8('http://ns.adobe.com/xap/1.0/\0', true), strToU8(xmp))));
  parts.push(seg(0xdb, new Uint8Array([0, ...table])));
  parts.push(seg(0xc0, sof(w, h)));
  parts.push(new Uint8Array([0xff, 0xd9]));
  return concat(...parts);
}
const camTable = q(92).map((v, i) => v + (i % 3 === 0 ? 1 : 0));
save('camera.jpg', jpeg(4032, 3024, [[0x010f, 'Apple'], [0x0110, 'iPhone 13'], [0x0131, '17.1']], camTable));
save(
  'generated.jpg',
  jpeg(1024, 1024, [[0x0131, 'Adobe Firefly']], q(95), '<x:xmpmeta><rdf:Description Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"/></x:xmpmeta>'),
);

// ---------- WebP (VP8X + EXIF + XMP, no bitstream) ----------
function riffChunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(8 + data.length + (data.length % 2));
  out.set(strToU8(type, true));
  new DataView(out.buffer).setUint32(4, data.length, true);
  out.set(data, 8);
  return out;
}
const vp8x = new Uint8Array(10);
vp8x[0] = 0x0c;
const W = 1536 - 1;
const H = 1024 - 1;
vp8x.set([W & 255, (W >> 8) & 255, W >> 16, H & 255, (H >> 8) & 255, H >> 16], 4);
const webpBody = concat(strToU8('WEBP', true), riffChunk('VP8X', vp8x), riffChunk('EXIF', tiff([[0x0131, 'Midjourney']])), riffChunk('XMP ', strToU8('<x:xmpmeta/>')));
const webpHead = concat(strToU8('RIFF', true), new Uint8Array(4));
new DataView(webpHead.buffer).setUint32(4, webpBody.length, true);
save('sample.webp', concat(webpHead, webpBody));

// ---------- Code ----------
save(
  'ai.py',
  `# Import necessary libraries
import os
import logging

logger = logging.getLogger(__name__)


def calculate_total_price(item_prices):
    """Calculate the total price of all items."""
    # Initialize the total price
    total_price = 0
    # Step 1: Iterate over each item price
    for item_price in item_prices:
        # Add the item price to the total
        total_price += item_price
    # Step 2: Return the total price
    return total_price


def read_configuration_file(configuration_path):
    """Read the configuration file and return its contents."""
    try:
        with open(configuration_path) as configuration_file:
            return configuration_file.read()
    except Exception as error:
        logger.error(f"❌ Failed to read configuration: {error}")
        return None


def main():
    """Main function to run the program."""
    try:
        api_key = "your_api_key_here"
        print("🚀 Starting the application...")
        print(calculate_total_price([1, 2, 3]))
    except Exception as error:
        print(f"❌ An error occurred: {error}")


# Example usage:
if __name__ == "__main__":
    main()
`,
);
save(
  'human.py',
  `import os, sys

def tot(xs):
    s = 0
    for x in xs: s += x
    return s

# TODO: handle utf-16 files someday (see #212)
def rd(p):
    with open(p) as f:
        return f.read()

if len(sys.argv) > 1:
    print(tot(map(int, sys.argv[1:])))
`,
);
