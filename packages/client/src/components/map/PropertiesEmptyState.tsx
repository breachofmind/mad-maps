import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { PanelHeader, PanelBody } from '../common/Panel';

interface PropertiesEmptyStateProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

// Shown in the Properties slot when nothing is selected, so the SideBar
// section is always present rather than popping in/out as selection
// changes — mirrors the border/header treatment of the panels that replace
// it (FeaturePropertiesPanel, BulkFeaturePropertiesPanel, LayerPropertiesPanel).
export function PropertiesEmptyState({ collapsed, onToggleCollapse }: PropertiesEmptyStateProps) {
  return (
    <Box
      sx={{
        borderTop: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        flex: collapsed ? '0 0 auto' : 1,
        minHeight: 0,
      }}
    >
      <PanelHeader
        title="Properties"
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        collapseLabel="properties"
      />
      {!collapsed && (
        <PanelBody>
          <Typography variant="body2" color="text.secondary">
            None Selected
          </Typography>
        </PanelBody>
      )}
    </Box>
  );
}
