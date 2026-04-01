import React, { useRef, useState, useCallback } from 'react';
import TerminalTabs from './TerminalTabs';
import { Pane, PaneNode, SplitDirection, collectPanes, findPane } from '../App';

// ─── Types ────────────────────────────────────────────────────────────────────

type DropTarget =
  | { type: 'tab-insert'; paneId: string; insertIndex: number }
  | { type: 'split-h-before'; paneId: string }   // split horizontal ← côté gauche
  | { type: 'split-h-after'; paneId: string }    // split horizontal → côté droit
  | { type: 'split-v-before'; paneId: string }   // split vertical ↑ côté haut
  | { type: 'split-v-after'; paneId: string }    // split vertical ↓ côté bas
  | { type: 'split-root-h-before' }              // split racine ← bord gauche du container
  | { type: 'split-root-h-after' }               // split racine → bord droit du container
  | { type: 'split-root-v-before' }              // split racine ↑ bord haut du container
  | { type: 'split-root-v-after' }               // split racine ↓ bord bas du container
  | null;

interface DragData {
  sourcePaneId: string;
  tabId: string;
  tabLabel: string;
  startX: number;
  startY: number;
  started: boolean;
}

interface DragRender {
  ghostX: number;
  ghostY: number;
  tabLabel: string;
  sourcePaneId: string;
  sourceTabId: string;
  dropTarget: DropTarget;
}

interface SplitPaneContainerProps {
  root: PaneNode;
  activePaneId: string;
  onSelectPane: (id: string) => void;
  onSelectTab: (paneId: string, tabId: string) => void;
  onCloseTab: (paneId: string, tabId: string) => void;
  onClosePane: (paneId: string) => void;
  onReorderTab: (paneId: string, fromIndex: number, toIndex: number) => void;
  onMoveTab: (sourcePaneId: string, tabId: string, targetPaneId: string, insertIndex: number) => void;
  onSplitWithTab: (sourcePaneId: string, tabId: string, refPaneId: string, position: 'before' | 'after', direction: SplitDirection) => void;
  onSplitRootWithTab: (sourcePaneId: string, tabId: string, position: 'before' | 'after', direction: SplitDirection) => void;
  onRatioChange: (firstId: string, secondId: string, ratio: number) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInsertIndex(mouseX: number, tabBar: Element): number {
  const tabs = tabBar.querySelectorAll('[data-tab-id]');
  for (let i = 0; i < tabs.length; i++) {
    const rect = (tabs[i] as HTMLElement).getBoundingClientRect();
    if (mouseX < rect.left + rect.width / 2) return i;
  }
  return tabs.length;
}

function computeDropTarget(mouseX: number, mouseY: number, container: HTMLElement | null): DropTarget {
  if (!container) return null;

  // Trouve le pane survolé (le dernier dans le DOM = le plus imbriqué)
  let hoveredPaneEl: Element | null = null;
  for (const el of container.querySelectorAll('[data-pane-id]')) {
    const r = el.getBoundingClientRect();
    if (mouseX >= r.left && mouseX <= r.right && mouseY >= r.top && mouseY <= r.bottom) {
      hoveredPaneEl = el;
    }
  }
  if (!hoveredPaneEl) return null;

  const paneId = hoveredPaneEl.getAttribute('data-pane-id')!;
  const r = hoveredPaneEl.getBoundingClientRect();

  // Priorité 1 : barre d'onglets → insertion (avant tout calcul de zone de split)
  for (const el of container.querySelectorAll('[data-tab-bar-pane]')) {
    const tr = el.getBoundingClientRect();
    if (mouseX >= tr.left && mouseX <= tr.right && mouseY >= tr.top && mouseY <= tr.bottom) {
      const tbPaneId = el.getAttribute('data-tab-bar-pane')!;
      return { type: 'tab-insert', paneId: tbPaneId, insertIndex: getInsertIndex(mouseX, el) };
    }
  }

  // Priorité 2 : bords extérieurs du container → split au niveau racine
  const cr = container.getBoundingClientRect();
  const outerZone = 56;
  if (mouseX <= cr.left   + outerZone) return { type: 'split-root-h-before' };
  if (mouseX >= cr.right  - outerZone) return { type: 'split-root-h-after' };
  if (mouseY <= cr.top    + outerZone) return { type: 'split-root-v-before' };
  if (mouseY >= cr.bottom - outerZone) return { type: 'split-root-v-after' };

  const zoneH = r.width  * 0.40;
  const zoneV = r.height * 0.40;

  const fromLeft   = mouseX - r.left;
  const fromRight  = r.right - mouseX;
  const fromTop    = mouseY - r.top;
  const fromBottom = r.bottom - mouseY;

  const inLeft   = fromLeft   <= zoneH;
  const inRight  = fromRight  <= zoneH;
  const inTop    = fromTop    <= zoneV;
  const inBottom = fromBottom <= zoneV;

  if (inLeft || inRight || inTop || inBottom) {
    const candidates = [
      inLeft   && { dist: fromLeft,   target: { type: 'split-h-before', paneId } as DropTarget },
      inRight  && { dist: fromRight,  target: { type: 'split-h-after',  paneId } as DropTarget },
      inTop    && { dist: fromTop,    target: { type: 'split-v-before', paneId } as DropTarget },
      inBottom && { dist: fromBottom, target: { type: 'split-v-after',  paneId } as DropTarget },
    ].filter(Boolean) as { dist: number; target: DropTarget }[];
    candidates.sort((a, b) => a.dist - b.dist);
    return candidates[0].target;
  }

  return null;
}

// ─── Composant racine ─────────────────────────────────────────────────────────

export default function SplitPaneContainer(props: SplitPaneContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef(props.root);
  rootRef.current = props.root;

  const tabDragRef = useRef<DragData | null>(null);
  const [dragRender, setDragRender] = useState<DragRender | null>(null);

  const handleTabDragStart = useCallback((
    sourcePaneId: string, tabId: string, tabLabel: string, e: React.MouseEvent,
  ) => {
    if (tabDragRef.current) return;
    tabDragRef.current = { sourcePaneId, tabId, tabLabel, startX: e.clientX, startY: e.clientY, started: false };

    const onMove = (ev: MouseEvent) => {
      const drag = tabDragRef.current;
      if (!drag) return;
      if (!drag.started) {
        if (Math.abs(ev.clientX - drag.startX) < 5 && Math.abs(ev.clientY - drag.startY) < 5) return;
        drag.started = true;
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }
      const dropTarget = computeDropTarget(ev.clientX, ev.clientY, containerRef.current);
      setDragRender({ ghostX: ev.clientX, ghostY: ev.clientY, tabLabel: drag.tabLabel, sourcePaneId: drag.sourcePaneId, sourceTabId: drag.tabId, dropTarget });
    };

    const onUp = (ev: MouseEvent) => {
      const drag = tabDragRef.current;
      tabDragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setDragRender(null);
      if (!drag || !drag.started) return;

      const dropTarget = computeDropTarget(ev.clientX, ev.clientY, containerRef.current);
      if (!dropTarget) return;

      if (dropTarget.type === 'tab-insert') {
        if (dropTarget.paneId === drag.sourcePaneId) {
          const pane = findPane(rootRef.current, drag.sourcePaneId);
          if (!pane) return;
          const fromIndex = pane.tabs.findIndex(t => t.id === drag.tabId);
          if (fromIndex === -1) return;
          const rawTo = dropTarget.insertIndex;
          props.onReorderTab(drag.sourcePaneId, fromIndex, rawTo > fromIndex ? rawTo - 1 : rawTo);
        } else {
          props.onMoveTab(drag.sourcePaneId, drag.tabId, dropTarget.paneId, dropTarget.insertIndex);
        }
      } else if (dropTarget.type === 'split-h-before') {
        props.onSplitWithTab(drag.sourcePaneId, drag.tabId, dropTarget.paneId, 'before', 'horizontal');
      } else if (dropTarget.type === 'split-h-after') {
        props.onSplitWithTab(drag.sourcePaneId, drag.tabId, dropTarget.paneId, 'after', 'horizontal');
      } else if (dropTarget.type === 'split-v-before') {
        props.onSplitWithTab(drag.sourcePaneId, drag.tabId, dropTarget.paneId, 'before', 'vertical');
      } else if (dropTarget.type === 'split-v-after') {
        props.onSplitWithTab(drag.sourcePaneId, drag.tabId, dropTarget.paneId, 'after', 'vertical');
      } else if (dropTarget.type === 'split-root-h-before') {
        props.onSplitRootWithTab(drag.sourcePaneId, drag.tabId, 'before', 'horizontal');
      } else if (dropTarget.type === 'split-root-h-after') {
        props.onSplitRootWithTab(drag.sourcePaneId, drag.tabId, 'after', 'horizontal');
      } else if (dropTarget.type === 'split-root-v-before') {
        props.onSplitRootWithTab(drag.sourcePaneId, drag.tabId, 'before', 'vertical');
      } else if (dropTarget.type === 'split-root-v-after') {
        props.onSplitRootWithTab(drag.sourcePaneId, drag.tabId, 'after', 'vertical');
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [props.onReorderTab, props.onMoveTab, props.onSplitWithTab]);

  const totalPanes = collectPanes(props.root).length;

  return (
    <div ref={containerRef} className="flex h-full w-full relative overflow-hidden">
      {/* Indicateurs de drop au niveau racine */}
      {dragRender && (
        <>
          <div className={`absolute left-0 top-0 bottom-0 w-14 z-30 pointer-events-none border-l-2 transition-all ${dragRender.dropTarget?.type === 'split-root-h-before' ? 'bg-indigo-500/30 border-indigo-400' : 'border-transparent'}`} />
          <div className={`absolute right-0 top-0 bottom-0 w-14 z-30 pointer-events-none border-r-2 transition-all ${dragRender.dropTarget?.type === 'split-root-h-after'  ? 'bg-indigo-500/30 border-indigo-400' : 'border-transparent'}`} />
          <div className={`absolute left-0 right-0 top-0 h-14 z-30 pointer-events-none border-t-2 transition-all ${dragRender.dropTarget?.type === 'split-root-v-before' ? 'bg-indigo-500/30 border-indigo-400' : 'border-transparent'}`} />
          <div className={`absolute left-0 right-0 bottom-0 h-14 z-30 pointer-events-none border-b-2 transition-all ${dragRender.dropTarget?.type === 'split-root-v-after'  ? 'bg-indigo-500/30 border-indigo-400' : 'border-transparent'}`} />
        </>
      )}
      <PaneNodeView
        node={props.root}
        dragRender={dragRender}
        activePaneId={props.activePaneId}
        totalPanes={totalPanes}
        onSelectPane={props.onSelectPane}
        onSelectTab={props.onSelectTab}
        onCloseTab={props.onCloseTab}
        onClosePane={props.onClosePane}
        onTabDragStart={handleTabDragStart}
        onRatioChange={props.onRatioChange}
      />

      {dragRender && (
        <div
          className="fixed z-50 px-3 py-1.5 bg-dark-800 border border-indigo-500 rounded text-xs text-gray-200 pointer-events-none shadow-xl"
          style={{ left: dragRender.ghostX + 14, top: dragRender.ghostY - 14 }}
        >
          {dragRender.tabLabel}
        </div>
      )}
    </div>
  );
}

// ─── Vue récursive d'un nœud ──────────────────────────────────────────────────

interface PaneNodeViewProps {
  node: PaneNode;
  dragRender: DragRender | null;
  activePaneId: string;
  totalPanes: number;
  onSelectPane: (id: string) => void;
  onSelectTab: (paneId: string, tabId: string) => void;
  onCloseTab: (paneId: string, tabId: string) => void;
  onClosePane: (paneId: string) => void;
  onTabDragStart: (paneId: string, tabId: string, label: string, e: React.MouseEvent) => void;
  onRatioChange: (firstId: string, secondId: string, ratio: number) => void;
}

function PaneNodeView(props: PaneNodeViewProps) {
  const { node } = props;

  if (node.type === 'leaf') {
    return <LeafView pane={node.pane} {...props} />;
  }

  const isHorizontal = node.direction === 'horizontal';
  const firstId  = collectPanes(node.first)[0]?.id  ?? '';
  const secondId = collectPanes(node.second)[0]?.id ?? '';

  return (
    <SplitView
      node={node}
      isHorizontal={isHorizontal}
      firstId={firstId}
      secondId={secondId}
      onRatioChange={props.onRatioChange}
    >
      <PaneNodeView {...props} node={node.first}  />
      <PaneNodeView {...props} node={node.second} />
    </SplitView>
  );
}

// ─── Vue feuille ─────────────────────────────────────────────────────────────

interface LeafViewProps extends PaneNodeViewProps {
  pane: Pane;
}

function LeafView({ pane, dragRender, activePaneId, totalPanes, onSelectPane, onSelectTab, onCloseTab, onClosePane, onTabDragStart }: LeafViewProps) {
  const dt = dragRender?.dropTarget;
  const isDropHBefore = dt?.type === 'split-h-before' && dt.paneId === pane.id;
  const isDropHAfter  = dt?.type === 'split-h-after'  && dt.paneId === pane.id;
  const isDropVBefore = dt?.type === 'split-v-before' && dt.paneId === pane.id;
  const isDropVAfter  = dt?.type === 'split-v-after'  && dt.paneId === pane.id;
  const tabInsertIndex = dt?.type === 'tab-insert' && dt.paneId === pane.id ? dt.insertIndex : null;
  const draggingTabId  = dragRender?.sourcePaneId === pane.id ? dragRender.sourceTabId : null;

  return (
    <div
      data-pane-id={pane.id}
      className="flex flex-col min-w-0 min-h-0 overflow-hidden relative flex-1"
      onMouseDown={() => onSelectPane(pane.id)}
    >
      <TerminalTabs
        paneId={pane.id}
        tabs={pane.tabs}
        activeTabId={pane.activeTabId}
        onSelectTab={tabId => onSelectTab(pane.id, tabId)}
        onCloseTab={tabId => onCloseTab(pane.id, tabId)}
        isPaneActive={pane.id === activePaneId}
        onTabDragStart={(tabId, label, e) => onTabDragStart(pane.id, tabId, label, e)}
        onClosePane={() => onClosePane(pane.id)}
        canClosePane={totalPanes > 1}
        tabInsertIndex={tabInsertIndex}
        draggingTabId={draggingTabId}
        isDragging={dragRender !== null}
      />

      {dragRender && (
        <>
          <div className={`absolute left-0 top-10 bottom-0 w-[40%] z-20 pointer-events-none border-l-2 transition-all ${isDropHBefore ? 'bg-indigo-500/20 border-indigo-500' : 'border-transparent'}`} />
          <div className={`absolute right-0 top-10 bottom-0 w-[40%] z-20 pointer-events-none border-r-2 transition-all ${isDropHAfter  ? 'bg-indigo-500/20 border-indigo-500' : 'border-transparent'}`} />
          <div className={`absolute left-0 right-0 top-10 h-[40%] z-20 pointer-events-none border-t-2 transition-all ${isDropVBefore ? 'bg-indigo-500/20 border-indigo-500' : 'border-transparent'}`} />
          <div className={`absolute left-0 right-0 bottom-0 h-[40%] z-20 pointer-events-none border-b-2 transition-all ${isDropVAfter  ? 'bg-indigo-500/20 border-indigo-500' : 'border-transparent'}`} />
        </>
      )}
    </div>
  );
}

// ─── Vue split avec poignée redimensionnable ──────────────────────────────────

interface SplitViewProps {
  node: { type: 'split'; direction: SplitDirection; ratio: number; first: PaneNode; second: PaneNode };
  isHorizontal: boolean;
  firstId: string;
  secondId: string;
  onRatioChange: (firstId: string, secondId: string, ratio: number) => void;
  children: [React.ReactNode, React.ReactNode];
}

function SplitView({ node, isHorizontal, firstId, secondId, onRatioChange, children }: SplitViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleResizerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const onMove = (ev: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const size   = isHorizontal ? rect.width  : rect.height;
      const origin = isHorizontal ? rect.left   : rect.top;
      const pos    = isHorizontal ? ev.clientX  : ev.clientY;
      const newRatio = Math.min(Math.max((pos - origin) / size, 0.1), 0.9);
      onRatioChange(firstId, secondId, newRatio);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [isHorizontal, firstId, secondId, onRatioChange]);

  const firstSize  = `${node.ratio * 100}%`;
  const secondSize = `${(1 - node.ratio) * 100}%`;

  return (
    <div
      ref={containerRef}
      className={`flex ${isHorizontal ? 'flex-row' : 'flex-col'} flex-1 min-w-0 min-h-0 overflow-hidden`}
    >
      <div
        style={isHorizontal ? { width: firstSize, flexShrink: 0, flexGrow: 0 } : { height: firstSize, flexShrink: 0, flexGrow: 0 }}
        className={`${isHorizontal ? 'min-w-0' : 'min-h-0'} flex flex-col overflow-hidden`}
      >
        {children[0]}
      </div>

      <div
        className={`${isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'} shrink-0 bg-dark-700 hover:bg-indigo-500 active:bg-indigo-400 transition-colors z-10`}
        onMouseDown={handleResizerMouseDown}
      />

      <div
        style={isHorizontal ? { width: secondSize, flexShrink: 0, flexGrow: 0 } : { height: secondSize, flexShrink: 0, flexGrow: 0 }}
        className={`${isHorizontal ? 'min-w-0' : 'min-h-0'} flex flex-col overflow-hidden`}
      >
        {children[1]}
      </div>
    </div>
  );
}

