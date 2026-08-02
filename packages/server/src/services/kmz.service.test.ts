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
    properties: { ...defaultProperties, title: 'A Trail' },
  });
});

afterAll(async () => {
  await db.delete(users).where(eq(users.id, ownerId));
  await pool.end();
});

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

    // Every <styleUrl> reference should point at a declared <Style id="..."> …
    const styleUrls = [...kml.matchAll(/<styleUrl>#([^<]+)<\/styleUrl>/g)].map((m) => m[1]);
    expect(styleUrls.length).toBeGreaterThanOrEqual(2);
    for (const id of styleUrls) {
      expect(kml).toContain(`<Style id="${id}">`);
    }

    // … whose <href> matches an actual icons/*.png entry present in the zip.
    const hrefs = [...kml.matchAll(/<href>([^<]+)<\/href>/g)].map((m) => m[1]);
    expect(hrefs.length).toBe(styleUrls.length);
    for (const href of hrefs) {
      expect(href).toMatch(/^icons\/.+\.png$/);
      const entry = zip.file(href);
      expect(entry).not.toBeNull();
      const bytes = await entry!.async('nodebuffer');
      expect(bytes.length).toBeGreaterThan(0);
      // PNG magic bytes.
      expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    }

    // The LineString feature has no icon, so it shouldn't reference a style.
    const trailPlacemark = kml.slice(kml.indexOf('<name>A Trail</name>') - 100, kml.indexOf('<name>A Trail</name>'));
    expect(trailPlacemark).not.toContain('<styleUrl>');
  });

  it('falls back to a styled default marker for an unrecognized (pre-Maki) icon key rather than leaving it unstyled', async () => {
    const buffer = await buildKmzExport(mapId, ownerId);
    const zip = await JSZip.loadAsync(buffer!);
    const kml = await zip.file('doc.kml')!.async('string');

    const legacyIndex = kml.indexOf('<name>Legacy Pin</name>');
    const placemarkStart = kml.lastIndexOf('<Placemark>', legacyIndex);
    const placemarkChunk = kml.slice(placemarkStart, legacyIndex);
    expect(placemarkChunk).toContain('<styleUrl>#');
  });
});
