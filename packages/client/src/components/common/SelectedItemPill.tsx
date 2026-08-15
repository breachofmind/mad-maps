import type { ReactNode } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

interface SelectedItemPillProps {
  icon: ReactNode;
  label: string;
}

// Read-only icon+name header shown atop a properties panel, identifying
// which pin/layer's properties are being edited — matches the pill Figma
// shows at the top of the Pin/Layer/Data-Layer Properties states.
export function SelectedItemPill({ icon, label }: SelectedItemPillProps) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ bgcolor: '#1a1c1b', borderRadius: 1, px: 1.5, py: 1 }}>
      {icon}
      <Typography variant="body2" noWrap>
        {label}
      </Typography>
    </Stack>
  );
}
