import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { fetchPluginPanelData, pluginPanelDataQueryKey } from '../../lib/layers/api';
import { PluginBlockRenderer } from './PluginBlockRenderer';

interface PluginDataSectionProps {
  layerId: string;
  featureId: string;
}

// Rendered by FeaturePropertiesPanel only when the feature's layer has a
// pluginEndpointUrl configured — fetches (via the server-side proxy) and
// renders whatever JSON blocks that endpoint returns for this feature.
export function PluginDataSection({ layerId, featureId }: PluginDataSectionProps) {
  const [collapsed, setCollapsed] = useState(false);
  const queryClient = useQueryClient();
  const queryKey = pluginPanelDataQueryKey(layerId, featureId);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchPluginPanelData(layerId, featureId),
  });

  const refreshMutation = useMutation({
    mutationFn: () => fetchPluginPanelData(layerId, featureId, { force: true }),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKey, data);
    },
  });

  return (
    <Box>
      <Divider sx={{ mb: 2 }} />
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={collapsed ? 0 : 1}>
        <Typography variant="subtitle2">Plugin Data</Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Tooltip title="Refresh">
            <span>
              <IconButton
                size="small"
                disabled={refreshMutation.isPending}
                onClick={() => refreshMutation.mutate()}
                aria-label="Refresh plugin data"
              >
                {refreshMutation.isPending ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
          <IconButton
            size="small"
            onClick={() => setCollapsed((prev) => !prev)}
            aria-label={collapsed ? 'Expand plugin data' : 'Collapse plugin data'}
          >
            {collapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
          </IconButton>
        </Stack>
      </Stack>

      <Collapse in={!collapsed}>
        {query.isPending && (
          <Stack alignItems="center" py={2}>
            <CircularProgress size={20} />
          </Stack>
        )}

        {query.isError && (
          <Typography variant="body2" color="error">
            Couldn't load data from this layer's plugin.
          </Typography>
        )}

        {query.isSuccess && query.data.blocks.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            The plugin returned no data for this pin.
          </Typography>
        )}

        {query.isSuccess && query.data.blocks.length > 0 && (
          <Stack spacing={1.5}>
            {query.data.blocks.map((block, index) => (
              <PluginBlockRenderer key={index} block={block} />
            ))}
          </Stack>
        )}
      </Collapse>
    </Box>
  );
}
