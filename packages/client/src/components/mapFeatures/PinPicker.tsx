import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Popover from '@mui/material/Popover';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { isMakiIconName, type MakiIconName } from '@mapinski/shared';
import { previewIconImage } from '../../lib/map/externalIconImages';
import { FeatureIconGlyph } from './FeatureIconGlyph';
import { MakiIconGrid } from './MakiIconGrid';

interface PinPickerProps {
  // Empty string means "no pin chosen" — either a "maki:"-prefixed icon name
  // or an image URL, same convention as LayerIconRule.iconUrl.
  value: string;
  onChange: (value: string) => void;
  failed?: boolean;
  urlPlaceholder?: string;
}

type Mode = 'maki' | 'url';

function modeFor(value: string): Mode {
  return !value || isMakiIconName(value) ? 'maki' : 'url';
}

// Universal pin selector: lets the user pick either a Maki icon (like the
// plain IconPicker used for local layers/features) or a custom image URL
// (the only option remote layers previously had), toggled via tabs in the
// same popover. The two modes share the "maki:"-prefix convention already
// used for local feature/layer icons, so the same string value works
// wherever LayerIconRule.iconUrl / LayerStyleConfig.defaultIconUrl is used.
export function PinPicker({ value, onChange, failed, urlPlaceholder = 'Icon image URL' }: PinPickerProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<Mode>(modeFor(value));
  const isMaki = isMakiIconName(value);

  // Local draft state so typing a URL doesn't fire onChange on every
  // keystroke — committed on blur/Enter, matching the previous
  // IconRuleRow/DefaultIconRow pattern.
  const [draftUrl, setDraftUrl] = useState(isMaki ? '' : value);
  useEffect(() => setDraftUrl(isMaki ? '' : value), [value, isMaki]);

  // Preview is rendered from the same cached raster externalIconImages.ts
  // produces for the map (as a data: url) rather than a plain <img src>, to
  // avoid two independent DOM loads of the same cross-origin url racing each
  // other (see externalIconImages.ts's previewIconImage for details).
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!value || isMaki) {
      setPreviewSrc(null);
      return;
    }
    previewIconImage(value).then((src) => {
      if (!cancelled) setPreviewSrc(src);
    });
    return () => {
      cancelled = true;
    };
  }, [value, isMaki]);

  function handleOpen(e: React.MouseEvent<HTMLElement>) {
    setMode(modeFor(value));
    setAnchorEl(e.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleSelectMaki(name: MakiIconName) {
    onChange(name);
    handleClose();
  }

  function commitUrl() {
    const trimmed = draftUrl.trim();
    if (trimmed !== value) onChange(trimmed);
  }

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        onClick={handleOpen}
        sx={{ textTransform: 'none', minWidth: 40, px: 1 }}
      >
        {isMaki ? (
          <FeatureIconGlyph name={value} />
        ) : previewSrc ? (
          <Box component="img" src={previewSrc} alt="" sx={{ width: 20, height: 20, objectFit: 'contain' }} />
        ) : (
          <Typography variant="body2" color={failed ? 'error' : 'text.secondary'} noWrap>
            {value ? (failed ? "Couldn't load" : 'Custom URL') : 'Choose pin'}
          </Typography>
        )}
      </Button>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ width: 300 }}>
          <Tabs value={mode} onChange={(_, next: Mode) => setMode(next)} variant="fullWidth">
            <Tab label="Maki icon" value="maki" />
            <Tab label="Custom URL" value="url" />
          </Tabs>
          {mode === 'maki' ? (
            <MakiIconGrid selectedName={isMaki ? value : undefined} onSelect={handleSelectMaki} />
          ) : (
            <Box sx={{ p: 1.5 }}>
              <TextField
                size="small"
                fullWidth
                autoFocus
                placeholder={urlPlaceholder}
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                onBlur={commitUrl}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    commitUrl();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                error={failed}
                helperText={failed ? "Couldn't load this image" : undefined}
              />
            </Box>
          )}
        </Box>
      </Popover>
    </>
  );
}
