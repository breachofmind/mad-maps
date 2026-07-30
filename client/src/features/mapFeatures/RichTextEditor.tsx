import type { MouseEvent, ReactNode } from 'react';
import { useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
}

interface ToolbarButtonProps {
  label: string;
  active: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
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
          onClick(e);
        }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}

function normalizeLinkUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function LinkButton({ editor }: { editor: Editor }) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [url, setUrl] = useState('');
  const isActive = editor.isActive('link');

  function open(e: MouseEvent<HTMLButtonElement>) {
    setUrl((editor.getAttributes('link').href as string | undefined) ?? '');
    setAnchorEl(e.currentTarget);
  }

  function close() {
    setAnchorEl(null);
  }

  function apply() {
    const normalized = normalizeLinkUrl(url);
    if (!normalized) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run();
    }
    close();
  }

  function remove() {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    close();
  }

  return (
    <>
      <ToolbarButton
        label={isActive ? 'Edit link' : 'Add link'}
        active={isActive}
        onClick={open}
        icon={<LinkIcon fontSize="small" />}
      />
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.5 }}>
          <TextField
            size="small"
            autoFocus
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply();
              } else if (e.key === 'Escape') {
                close();
              }
            }}
            sx={{ width: 240 }}
          />
          <Button size="small" variant="contained" onClick={apply}>
            Apply
          </Button>
          {isActive && (
            <Tooltip title="Remove link">
              <IconButton size="small" onClick={remove}>
                <LinkOffIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Popover>
    </>
  );
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
    ],
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
        <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
        <LinkButton editor={editor} />
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
          '& a': { color: 'inherit' },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
