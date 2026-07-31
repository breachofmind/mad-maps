import { Router, type Request } from 'express';
import multer from 'multer';
import type { User } from '../db/schema';
import { requireAuth } from '../middleware/requireAuth';
import {
  ImportValidationError,
  importFeaturesAsNewLayer,
  importFeaturesAsNewMap,
  parseImportFileGroups,
} from '../services/import.service';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

function currentUser(req: import('express').Request): User {
  return req.user as User;
}

function nameFromFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.[^./\\]+$/, '');
  return withoutExtension.trim() || 'Imported';
}

export const mapImportRouter = Router({ mergeParams: true });
mapImportRouter.use(requireAuth);

mapImportRouter.post('/', upload.single('file'), async (req: Request<{ mapId: string }>, res) => {
  if (!req.file) return res.status(400).json({ error: 'A file is required' });

  let groups;
  try {
    groups = parseImportFileGroups(req.file.originalname, req.file.buffer.toString('utf-8'));
  } catch (err) {
    if (err instanceof ImportValidationError) return res.status(400).json({ error: err.message });
    throw err;
  }

  const result = await importFeaturesAsNewLayer(
    req.params.mapId,
    currentUser(req).id,
    nameFromFilename(req.file.originalname),
    groups,
  );
  if (!result) return res.status(404).json({ error: 'Map not found' });
  res.status(201).json(result);
});

export const newMapImportRouter = Router();
newMapImportRouter.use(requireAuth);

newMapImportRouter.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'A file is required' });

  let groups;
  try {
    groups = parseImportFileGroups(req.file.originalname, req.file.buffer.toString('utf-8'));
  } catch (err) {
    if (err instanceof ImportValidationError) return res.status(400).json({ error: err.message });
    throw err;
  }

  const name = nameFromFilename(req.file.originalname);
  const result = await importFeaturesAsNewMap(currentUser(req).id, name, name, groups);
  res.status(201).json(result);
});
