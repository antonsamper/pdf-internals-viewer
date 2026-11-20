import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

const PANES = ['explorer', 'inspector', 'bytes'] as const;

/** Three resizable panes on wide screens, one switchable pane on narrow ones. */
export const WorkspaceLayout = ({
  bytes,
  explorer,
  inspector,
  mobilePane,
  narrow,
  onMobilePane,
}: {
  bytes: ReactNode;
  explorer: ReactNode;
  inspector: ReactNode;
  mobilePane: string;
  narrow: boolean;
  onMobilePane: (pane: string) => void;
}) =>
  narrow ? (
    <>
      <nav className="mobile-pane-nav" aria-label="Workspace pane">
        {PANES.map((pane) => (
          <Button key={pane} variant={pane === mobilePane ? 'secondary' : 'ghost'} onClick={() => onMobilePane(pane)}>
            {pane === 'bytes' ? 'Original bytes' : pane[0].toUpperCase() + pane.slice(1)}
          </Button>
        ))}
      </nav>
      <div className="mobile-workspace">{mobilePane === 'explorer' ? explorer : mobilePane === 'bytes' ? bytes : inspector}</div>
    </>
  ) : (
    <div className="desktop-workspace">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="20%" minSize="180px" maxSize="35%">
          {explorer}
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize="43%" minSize="300px">
          {inspector}
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize="37%" minSize="290px">
          {bytes}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
