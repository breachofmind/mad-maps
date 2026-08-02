import { eq } from 'drizzle-orm';
import JSZip from 'jszip';
import { db, pool } from '../db/client';
import { users } from '../db/schema';
import { createMap } from './maps.service';
import { createLayer } from './layers.service';
import { createFeature } from './features.service';
import { buildKmzExport } from './kmz.service';

let ownerId: string;
let mapId: string;
let layerId: string;

const defaultProperties = { title: '', descriptionHtml: '', icon: 'marker', color: '#1976d2' };

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({
      googleId: `kmz-service-test-${Date.now()}`,
      email: 'kmz-service-test@example.com',
    })
    .returning();
  ownerId = user.id;

  const map = await createMap({ ownerId, title: 'Icon Test Map' });
  mapId = map.id;

  const layer = await createLayer(mapId, ownerId, 'Pins');
  layerId = layer!.id;

  await createFeature(layerId, ownerId, {
    geometry: { type: 'Point', coordinates: [-122.4, 37.79] },
    properties: { ...defaultProperties, title: 'Maki Pin', icon: 'maki:restaurant', color: '#ff0000' },
  });
  await createFeature(layerId, ownerId, {
    geometry: { type: 'Point', coordinates: [-122.41, 37.8] },
    // A pre-Maki key — should fall back to a colored default marker rather
    // than being left unstyled.
    properties: { ...defaultProperties, title: 'Legacy Pin', icon: 'restaurant', color: '#00ff00' },
  });
  await createFeature(layerId, ownerId, {
    geometry: {
      type: 'LineString',
      coordinates: [
        [-122.42, 37.77],
        [-122.41, 37.78],
      ],
    },
    properties: { ...defaultProperties, title: 'A Trail', color: '#1976d2', strokeWidth: 5 },
  });
  await createFeature(layerId, ownerId, {
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-122.43, 37.76],
          [-122.42, 37.76],
          [-122.42, 37.77],
          [-122.43, 37.76],
        ],
      ],
    },
    properties: { ...defaultProperties, title: 'A Field', color: '#00ff00', strokeWidth: 2 },
  });
  await createFeature(layerId, ownerId, {
    geometry: {
      type: 'LineString',
      coordinates: [
        [-122.44, 37.75],
        [-122.43, 37.74],
      ],
    },
    // strokeWidth omitted — should default the same way the app does.
    properties: { ...defaultProperties, title: 'Unwidened Trail', color: '#000000' },
  });
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, ownerId));
  await pool.end();
});

function placemarkFor(kml: string, title: string): string {
  const nameIndex = kml.indexOf(`<name>${title}</name>`);
  const placemarkStart = kml.lastIndexOf('<Placemark>', nameIndex);
  const placemarkEnd = kml.indexOf('</Placemark>', nameIndex) + '</Placemark>'.length;
  return kml.slice(placemarkStart, placemarkEnd);
}

function styleFor(kml: string, placemark: string): string {
  const id = placemark.match(/<styleUrl>#([^<]+)<\/styleUrl>/)![1];
  const start = kml.indexOf(`<Style id="${id}">`);
  const end = kml.indexOf('</Style>', start) + '</Style>'.length;
  return kml.slice(start, end);
}

describe('buildKmzExport', () => {
  it('returns null when the map is not owned by the requester', async () => {
    expect(await buildKmzExport(mapId, '00000000-0000-0000-0000-000000000000')).toBeNull();
  });

  it('bundles doc.kml with a PNG per distinct icon/color pair, wired up via styleUrl', async () => {
    const buffer = await buildKmzExport(mapId, ownerId);
    expect(buffer).toBeInstanceOf(Buffer);

    const zip = await JSZip.loadAsync(buffer!);
    const kml = await zip.file('doc.kml')!.async('string');

    expect(kml).toContain('<name>Maki Pin</name>');
    expect(kml).toContain('<name>Legacy Pin</name>');
    expect(kml).toContain('<name>A Trail</name>');
    expect(kml).toContain('<name>A Field</name>');

    // Every <styleUrl> reference should point at a declared <Style id="...">.
    const styleUrls = [...kml.matchAll(/<styleUrl>#([^<]+)<\/styleUrl>/g)].map((m) => m[1]);
    expect(styleUrls.length).toBe(5);
    for (const id of styleUrls) {
      expect(kml).toContain(`<Style id="${id}">`);
    }

    // The two point features' styles carry an <href> matching a real
    // icons/*.png entry present in the zip.
    const hrefs = [...kml.matchAll(/<href>([^<]+)<\/href>/g)].map((m) => m[1]);
    expect(hrefs.length).toBe(2);
    for (const href of hrefs) {
      expect(href).toMatch(/^icons\/.+\.png$/);
      const entry = zip.file(href);
      expect(entry).not.toBeNull();
      const bytes = await entry!.async('nodebuffer');
      expect(bytes.length).toBeGreaterThan(0);
      // PNG magic bytes.
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    }
  });

  it('falls back to a styled default marker for an unrecognized (pre-Maki) icon key rather than leaving it unstyled', async () => {
    const buffer = await buildKmzExport(mapId, ownerId);
    const zip = await JSZip.loadAsync(buffer!);
    const kml = await zip.file('doc.kml')!.async('string');

    const placemark = placemarkFor(kml, 'Legacy Pin');
    expect(placemark).toContain('<styleUrl>#');
  });

  it("carries a LineString feature's color and stroke width into <LineStyle>", async () => {
    const buffer = await buildKmzExport(mapId, ownerId);
    const zip = await JSZip.loadAsync(buffer!);
    const kml = await zip.file('doc.kml')!.async('string');

    const placemark = placemarkFor(kml, 'A Trail');
    const style = styleFor(kml, placemark);

    // #1976d2 -> aabbggrr with full alpha.
    expect(style).toContain('<LineStyle><color>ffd27619</color><width>5</width></LineStyle>');
    expect(style).not.toContain('<PolyStyle>');
  });

  it("carries a Polygon feature's fill color, outline color, and stroke width", async () => {
    const buffer = await buildKmzExport(mapId, ownerId);
    const zip = await JSZip.loadAsync(buffer!);
    const kml = await zip.file('doc.kml')!.async('string');

    const placemark = placemarkFor(kml, 'A Field');
    const style = styleFor(kml, placemark);

    // #00ff00 -> aabbggrr; full alpha for the outline, ~25% alpha (0x40) for the fill.
    expect(style).toContain('<LineStyle><color>ff00ff00</color><width>2</width></LineStyle>');
    expect(style).toContain('<PolyStyle><color>4000ff00</color><fill>1</fill><outline>1</outline></PolyStyle>');
  });

  it('defaults an unset stroke width the same way the app does (3px)', async () => {
    const buffer = await buildKmzExport(mapId, ownerId);
    const zip = await JSZip.loadAsync(buffer!);
    const kml = await zip.file('doc.kml')!.async('string');

    const placemark = placemarkFor(kml, 'Unwidened Trail');
    const style = styleFor(kml, placemark);

    expect(style).toContain('<width>3</width>');
  });
});
