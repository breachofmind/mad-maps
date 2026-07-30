import type { ReactNode } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
}

interface ToolbarButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
}

function ToolbarButton({ label, active, onClick, icon }: ToolbarButtonProps) {
  return (
    <Tooltip title={label}>
      {/* onMouseDown (not onClick) prevents the editor from losing focus/selection before the command runs. */}
      <IconButton
        size="small"
        color={active ? 'primary' : 'default'}
        onMouseDown={(e) => {
          e.preventDefault();
          onClick();
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } })],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Stack
        direction="row"
        spacing={0.25}
        alignItems="center"
        sx={{ borderBottom: 1, borderColor: 'divider', px: 0.5, py: 0.25 }}
      >
        <ToolbarButton
          label="Bold"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          icon={<FormatBoldIcon fontSize="small" />}
        />
        <ToolbarButton
          label="Italic"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          icon={<FormatItalicIcon fontSize="small" />}
        />
        <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          icon={<FormatListBulletedIcon fontSize="small" />}
        />
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          icon={<FormatListNumberedIcon fontSize="small" />}
        />
      </Stack>
      <Box
        sx={{
          p: 1,
          minHeight: 100,
          fontSize: 14,
          '& .ProseMirror': { outline: 'none' },
          '& p': { margin: '0 0 8px 0' },
          '& ul, & ol': { margin: '0 0 8px 0', paddingLeft: '1.5em' },
          '& p:last-child, & ul:last-child, & ol:last-child': { marginBottom: 0 },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
