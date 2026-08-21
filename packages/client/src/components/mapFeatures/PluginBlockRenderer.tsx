import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import type { PluginPanelBlock, PluginTableCell } from '@mad-maps/shared';

function PluginTableCellContent({ cell }: { cell: PluginTableCell }) {
  if (cell.type === 'image') {
    return <Box component="img" src={cell.url} alt={cell.alt ?? ''} sx={{ width: 32, height: 32, display: 'block' }} />;
  }
  return <>{cell.text}</>;
}

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
    case 'table':
      // Rows aren't required to have the same cell count as headers (see
      // the schema) — using a real <table> means each row lays out its own
      // cells independently, so a short row just degrades to blank trailing
      // cells rather than misaligning every other row's columns.
      return (
        <Box sx={{ overflowX: 'auto' }}>
          <Table
            size="small"
            sx={{
              '& .MuiTableCell-root': { borderBottom: 'none', px: 1, py: 0.5, fontSize: '0.8125rem' },
            }}
          >
            {block.headers.length > 0 && (
              <TableHead>
                <TableRow sx={{ '& .MuiTableCell-root': { borderBottom: '1px solid', borderColor: 'divider' } }}>
                  {block.headers.map((header, index) => (
                    <TableCell key={index} sx={{ color: 'text.secondary', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {header}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
            )}
            <TableBody>
              {block.rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <PluginTableCellContent cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      );
  }
}
