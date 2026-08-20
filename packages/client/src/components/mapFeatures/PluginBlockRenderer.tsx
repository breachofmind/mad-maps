import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import type { PluginPanelBlock } from '@mad-maps/shared';

interface PluginBlockRendererProps {
  block: PluginPanelBlock;
}

// Renders one block from a plugin endpoint's response. The block schema
// (@mad-maps/shared's pluginPanelBlockSchema) is deliberately small and
// already validated server-side before this ever runs, so there's no HTML
// or arbitrary markup here to sanitize — just Mad Maps' own components.
export function PluginBlockRenderer({ block }: PluginBlockRendererProps) {
  switch (block.type) {
    case 'heading':
      return (
        <Typography variant="subtitle2" fontWeight={600}>
          {block.text}
        </Typography>
      );
    case 'text':
      return (
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
          {block.text}
        </Typography>
      );
    case 'keyValue':
      return (
        <Stack spacing={0.75}>
          {block.items.map((item, index) => (
            <Stack key={index} direction="row" justifyContent="space-between" spacing={2}>
              <Typography variant="caption" color="text.secondary">
                {item.label}
              </Typography>
              <Typography variant="body2" sx={{ textAlign: 'right' }}>
                {item.value}
              </Typography>
            </Stack>
          ))}
        </Stack>
      );
    case 'image':
      return (
        <Box
          component="img"
          src={block.url}
          alt={block.alt ?? ''}
          sx={{ maxWidth: '100%', borderRadius: 1, display: 'block' }}
        />
      );
    case 'link':
      return (
        <Link href={block.href} target="_blank" rel="noopener noreferrer" variant="body2">
          {block.text}
        </Link>
      );
  }
}
