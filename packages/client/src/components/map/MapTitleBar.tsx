import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';

interface MapTitleBarProps {
  title: string;
  onSubmit: (title: string) => void;
}

// Editable map title shown at the top of SideBar. Double-click to rename;
// Enter/blur commits, Escape reverts — mirrors the inline-edit UX the old
// floating title Paper had, just relocated (see MapEditorPage).
export function MapTitleBar({ title, onSubmit }: MapTitleBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');

  function submit() {
    setIsEditing(false);
    const trimmed = value.trim();
    if (!trimmed || trimmed === title) return;
    onSubmit(trimmed);
  }

  return (
    <Box sx={{ px: 2, pt: 2.5, pb: 1.5 }}>
      {isEditing ? (
        <TextField
          autoFocus
          fullWidth
          size="small"
          variant="standard"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={submit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') setIsEditing(false);
          }}
          sx={{ input: { color: 'common.white' } }}
        />
      ) : (
        <Typography
          variant="subtitle1"
          onDoubleClick={() => {
            setValue(title);
            setIsEditing(true);
          }}
          sx={{ cursor: 'text', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {title}
        </Typography>
      )}
    </Box>
  );
}
