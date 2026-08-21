import { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

const MAX_PAIRS = 50;
const MAX_KEY_LENGTH = 60;
const MAX_VALUE_LENGTH = 500;

interface MetadataRowState {
  id: string;
  key: string;
  value: string;
}

interface FeatureMetadataEditorProps {
  metadata: Record<string, string>;
  onCommit: (metadata: Record<string, string>) => void;
}

// Only ever used as a React list key, never sent to the server — a short
// random string is enough, no need for crypto.randomUUID (unsupported in
// the jsdom test environment) or a uuid dependency.
let nextRowId = 0;
function makeRowId(): string {
  nextRowId += 1;
  return `metadata-row-${nextRowId}-${Math.random().toString(36).slice(2)}`;
}

function toRows(metadata: Record<string, string>): MetadataRowState[] {
  return Object.entries(metadata).map(([key, value]) => ({ id: makeRowId(), key, value }));
}

function MetadataRow({
  row,
  autoFocus,
  duplicate,
  onKeyChange,
  onValueChange,
  onBlur,
  onRemove,
}: {
  row: MetadataRowState;
  autoFocus: boolean;
  duplicate: boolean;
  onKeyChange: (value: string) => void;
  onValueChange: (value: string) => void;
  onBlur: () => void;
  onRemove: () => void;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <TextField
        size="small"
        placeholder="Key"
        value={row.key}
        autoFocus={autoFocus}
        onChange={(e) => onKeyChange(e.target.value)}
        onBlur={onBlur}
        error={duplicate}
        helperText={duplicate ? 'Duplicate key' : undefined}
        sx={{ flex: 1, minWidth: 0, '& .MuiOutlinedInput-root': { bgcolor: '#1a1c1b' } }}
        slotProps={{ htmlInput: { maxLength: MAX_KEY_LENGTH, 'aria-label': 'Metadata key' } }}
      />
      <TextField
        size="small"
        placeholder="Value"
        value={row.value}
        onChange={(e) => onValueChange(e.target.value)}
        onBlur={onBlur}
        sx={{ flex: 1, minWidth: 0, '& .MuiOutlinedInput-root': { bgcolor: '#1a1c1b' } }}
        slotProps={{ htmlInput: { maxLength: MAX_VALUE_LENGTH, 'aria-label': 'Metadata value' } }}
      />
      <IconButton size="small" onClick={onRemove} aria-label={`Remove metadata ${row.key || 'entry'}`}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

// Free-text key/value pairs a user attaches to a feature, stored under
// properties.metadata. The server always replaces the whole metadata object
// on update (shallow merge at the properties level, see features.service.ts),
// so every change here rebuilds and sends the full record rather than a
// per-key patch.
//
// Persistence is commit-on-blur rather than time-debounced like title/
// description: a debounce firing mid-keystroke on a key field would send a
// half-typed key, and since the server replaces the whole object, a rapid
// sequence of those could transiently produce garbage keys. Removing a row
// is an unambiguous discrete action, so it commits immediately instead of
// waiting for blur.
function recordsEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((key) => a[key] === b[key]);
}

export function FeatureMetadataEditor({ metadata, onCommit }: FeatureMetadataEditorProps) {
  const [rows, setRows] = useState<MetadataRowState[]>(() => toRows(metadata));
  const lastAddedIdRef = useRef<string | null>(null);
  // Tracks the last record actually sent, seeded from the incoming prop, so
  // an empty added-then-abandoned row (or a blur with no real change) never
  // fires a redundant/no-op commit.
  const lastCommittedRef = useRef<Record<string, string>>(metadata);

  function duplicateKeySet(current: MetadataRowState[]) {
    const trimmed = current.map((row) => row.key.trim());
    return new Set(trimmed.filter((key, i) => key !== '' && trimmed.indexOf(key) !== i));
  }

  function commit(nextRows: MetadataRowState[]) {
    if (duplicateKeySet(nextRows).size > 0) return;

    const record: Record<string, string> = {};
    for (const row of nextRows) {
      const key = row.key.trim();
      if (key === '') continue;
      record[key] = row.value.trim();
    }
    if (recordsEqual(record, lastCommittedRef.current)) return;
    lastCommittedRef.current = record;
    onCommit(record);
  }

  function updateRow(id: string, patch: Partial<Pick<MetadataRowState, 'key' | 'value'>>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function handleAdd() {
    const id = makeRowId();
    lastAddedIdRef.current = id;
    setRows((prev) => [...prev, { id, key: '', value: '' }]);
  }

  function handleRemove(id: string) {
    setRows((prev) => {
      const next = prev.filter((row) => row.id !== id);
      commit(next);
      return next;
    });
  }

  const duplicates = duplicateKeySet(rows);

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
        Metadata
      </Typography>
      <Stack spacing={1}>
        {rows.map((row) => (
          <MetadataRow
            key={row.id}
            row={row}
            autoFocus={row.id === lastAddedIdRef.current}
            duplicate={row.key.trim() !== '' && duplicates.has(row.key.trim())}
            onKeyChange={(key) => updateRow(row.id, { key })}
            onValueChange={(value) => updateRow(row.id, { value })}
            onBlur={() => commit(rows)}
            onRemove={() => handleRemove(row.id)}
          />
        ))}
      </Stack>
      {rows.length < MAX_PAIRS ? (
        <Button size="small" startIcon={<AddIcon fontSize="small" />} onClick={handleAdd} sx={{ mt: 1 }}>
          Add metadata
        </Button>
      ) : (
        <Typography variant="caption" color="text.secondary" display="block" mt={1}>
          Maximum {MAX_PAIRS} entries
        </Typography>
      )}
    </Box>
  );
}
