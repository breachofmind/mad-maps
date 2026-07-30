import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import { downloadMapExport, type ExportFormat } from '../export/api';
import { ImportDialog } from '../import/ImportDialog';

interface MapMenuProps {
  mapId: string;
}

export function MapMenu({ mapId }: MapMenuProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  async function handleExport(format: ExportFormat) {
    setAnchorEl(null);
    await downloadMapExport(mapId, format);
  }

  function handleImportClick() {
    setAnchorEl(null);
    setImportDialogOpen(true);
  }

  return (
    <>
      <Tooltip title="More options">
        <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} aria-label="More options">
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => handleExport('geojson')}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export as GeoJSON</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleExport('kml')}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export as KML</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleImportClick}>
          <ListItemIcon>
            <UploadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Import layer from file</ListItemText>
        </MenuItem>
      </Menu>
      <ImportDialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} mapId={mapId} />
    </>
  );
}
