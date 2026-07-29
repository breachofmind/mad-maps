import { useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import DownloadIcon from '@mui/icons-material/Download';
import { downloadMapExport, type ExportFormat } from './api';

interface ExportMenuProps {
  mapId: string;
}

export function ExportMenu({ mapId }: ExportMenuProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  async function handleExport(format: ExportFormat) {
    setAnchorEl(null);
    await downloadMapExport(mapId, format);
  }

  return (
    <>
      <Button
        size="small"
        startIcon={<DownloadIcon fontSize="small" />}
        onClick={(e) => setAnchorEl(e.currentTarget)}
      >
        Export
      </Button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => handleExport('geojson')}>Export as GeoJSON</MenuItem>
        <MenuItem onClick={() => handleExport('kml')}>Export as KML</MenuItem>
      </Menu>
    </>
  );
}
