import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { PanelHeader, PanelBody } from '../common/Panel';

// Shown in the Properties slot when nothing is selected, so the SideBar
// section is always present rather than popping in/out as selection
// changes — mirrors the border/header treatment of the panels that replace
// it (FeaturePropertiesPanel, BulkFeaturePropertiesPanel, LayerPropertiesPanel).
export function PropertiesEmptyState() {
  return (
    <Box sx={{ borderTop: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
      <PanelHeader title="Properties" />
      <PanelBody>
        <Typography variant="body2" color="text.secondary">
          None Selected
        </Typography>
      </PanelBody>
    </Box>
  );
}
