import { useState } from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import PaletteIcon from '@mui/icons-material/Palette';
import { downloadMapExport, type ExportFormat } from '../../lib/export/api';
import { ImportDialog } from '../import/ImportDialog';
import { CustomStyleDialog } from './CustomStyleDialog';

interface MapMenuProps {
  mapId: string;
  currentStyleUrl: string;
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

// Controlled by its trigger (MenuBar's download icon in MapEditorPage) —
// this component only owns the Menu content and the dialogs it opens, not
// the button that opens it, so the trigger can live in the shell's icon rail
// instead of here.
export function MapMenu({ mapId, currentStyleUrl, anchorEl, onClose }: MapMenuProps) {
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [customStyleDialogOpen, setCustomStyleDialogOpen] = useState(false);

  async function handleExport(format: ExportFormat) {
    onClose();
    await downloadMapExport(mapId, format);
  }

  function handleImportClick() {
    onClose();
    setImportDialogOpen(true);
  }

  function handleCustomStyleClick() {
    onClose();
    setCustomStyleDialogOpen(true);
  }

  return (
    <>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
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
        <MenuItem onClick={() => handleExport('kmz')}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Export as KMZ (with icons)</ListItemText>
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
