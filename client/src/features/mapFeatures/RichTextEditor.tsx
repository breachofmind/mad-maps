import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Box from '@mui/material/Box';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } })],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        p: 1,
        minHeight: 100,
        fontSize: 14,
        '& .ProseMirror': { outline: 'none' },
        '& p': { margin: 0 },
      }}
    >
      <EditorContent editor={editor} />
    </Box>
  );
}
