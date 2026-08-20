import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import type { LayerDTO } from '@mad-maps/shared';
import { fetchPlugins, pluginsQueryKey } from '../../lib/plugins/api';
import { useDebouncedCallback } from '../../lib/useDebouncedCallback';

interface PluginSourcePickerProps {
  layer: LayerDTO;
  onPluginIdChange: (pluginId: string | null) => void;
  onPluginEndpointUrlChange: (pluginEndpointUrl: string | null) => void;
}

type Mode = 'installed' | 'url';

// Lets a local layer's plugin be configured either as one of the plugin
// files the server operator loaded from PLUGINS_DIR, or a custom URL — the
// two are mutually exclusive server-side (see layers.service.ts's
// updateLayerForOwner), so switching mode here only takes effect once the
// user actually picks a plugin / enters a URL, not on the toggle itself.
export function PluginSourcePicker({ layer, onPluginIdChange, onPluginEndpointUrlChange }: PluginSourcePickerProps) {
  const [mode, setMode] = useState<Mode>(layer.pluginId ? 'installed' : 'url');
  const [pluginEndpointUrl, setPluginEndpointUrl] = useState(layer.pluginEndpointUrl ?? '');

  const pluginsQuery = useQuery({ queryKey: pluginsQueryKey(), queryFn: fetchPlugins });
  const plugins = pluginsQuery.data ?? [];
  const selectedPlugin = plugins.find((p) => p.id === layer.pluginId);

  const persistPluginEndpointUrl = useDebouncedCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed === '') {
      onPluginEndpointUrlChange(null);
      return;
    }
    try {
      new URL(trimmed);
    } catch {
      return; // incomplete/invalid while typing — wait for a valid URL or a clear
    }
    onPluginEndpointUrlChange(trimmed);
  }, 500);

  function handlePluginEndpointUrlChange(value: string) {
    setPluginEndpointUrl(value);
    persistPluginEndpointUrl(value);
  }

  function handleModeChange(_e: unknown, next: Mode | null) {
    if (next) setMode(next);
  }

  function handlePluginSelect(e: SelectChangeEvent) {
    onPluginIdChange(e.target.value || null);
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
        Plugin
      </Typography>
      <ToggleButtonGroup size="small" exclusive value={mode} onChange={handleModeChange} fullWidth sx={{ mb: 1 }}>
        <ToggleButton value="installed" disabled={plugins.length === 0}>
          Installed plugin
        </ToggleButton>
        <ToggleButton value="url">Custom URL</ToggleButton>
      </ToggleButtonGroup>

      {mode === 'installed' ? (
        <>
          <Select
            size="small"
            fullWidth
            displayEmpty
            value={layer.pluginId ?? ''}
            onChange={handlePluginSelect}
            sx={{ bgcolor: '#1a1c1b' }}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {plugins.map((plugin) => (
              <MenuItem key={plugin.id} value={plugin.id}>
                {plugin.name}
              </MenuItem>
            ))}
          </Select>
          {selectedPlugin && (
            <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
              {selectedPlugin.description}
            </Typography>
          )}
        </>
      ) : (
        <TextField
          size="small"
          fullWidth
          type="url"
          placeholder="https://example.com/plugin"
          value={pluginEndpointUrl}
          onChange={(e) => handlePluginEndpointUrlChange(e.target.value)}
          helperText="Selecting a pin in this layer will POST its details here and show what comes back."
          sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#1a1c1b' } }}
        />
      )}
    </Box>
  );
}
