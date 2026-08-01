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
import PaletteIcon from '@mui/icons-material/Palette';
import { downloadMapExport, type ExportFormat } from '../../lib/export/api';
import { ImportDialog } from '../import/ImportDialog';
import { CustomStyleDialog } from './CustomStyleDialog';

interface MapMenuProps {
  mapId: string;
  currentStyleUrl: string;
}

export function MapMenu({ mapId, currentStyleUrl }: MapMenuProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [customStyleDialogOpen, setCustomStyleDialogOpen] = useState(false);

  async function handleExport(format: ExportFormat) {
    setAnchorEl(null);
    await downloadMapExport(mapId, format);
  }

  function handleImportClick() {
    setAnchorEl(null);
    setImportDialogOpen(true);
  }

  function handleCustomStyleClick() {
    setAnchorEl(null);
    setCustomStyleDialogOpen(true);
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
        <Divider />
        <MenuItem onClick={handleCustomStyleClick}>
          <ListItemIcon>
            <PaletteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Custom style URL…</ListItemText>
        </MenuItem>
      </Menu>
      <ImportDialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} mapId={mapId} />
      <CustomStyleDialog
        open={customStyleDialogOpen}
        onClose={() => setCustomStyleDialogOpen(false)}
        mapId={mapId}
        currentStyleUrl={currentStyleUrl}
      />
    </>
  );
}
