import type { DragEvent } from 'react';

import { useState } from 'react';

/** Drag-and-drop of one file onto the whole window, with an overlay flag. */
export const useFileDrop = (onFile: (file: File) => void) => {
  const [dragging, setDragging] = useState(false);
  return {
    dragging,
    handlers: {
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setDragging(false);
        }
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (event.dataTransfer.types.includes('Files')) {
          event.preventDefault();
          setDragging(true);
        }
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) {
          onFile(file);
        }
      },
    },
  };
};
