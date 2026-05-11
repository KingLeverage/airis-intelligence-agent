import { useCallback, useEffect, useRef } from "react";
import { toJpeg } from "html-to-image";
import type { WidgetRecord } from "@airis/shared";
import { api } from "../../lib/api";
import { setSpacePreviewFlush } from "../../lib/space-preview-flush";
import { useSpacesStore } from "../../stores/spaces-store";
import { useWidgetsStore } from "../../stores/widgets-store";
import { useWorkspacePreviewCaptureStore } from "../../stores/workspace-preview-capture-store";

const DEBOUNCE_MS = 580;
const LAYOUT_STOP_MS = 160;

function enabledWidgetSignature(widgets: WidgetRecord[]): string {
  return widgets
    .filter((w) => w.status !== "disabled")
    .map((w) => `${w.id}:${w.layout.x},${w.layout.y},${w.layout.w},${w.layout.h}:${w.updatedAt}`)
    .sort()
    .join("|");
}

/**
 * Captures the workspace canvas (see `WorkspaceCanvas` capture root) as a JPEG,
 * uploads it for Home “glass” thumbnails, and registers a flush for `exitToHome`.
 */
export function SpacePreviewSync() {
  const activeSpaceId = useSpacesStore((s) => s.activeSpaceId);
  const widgets = useWidgetsStore((s) => s.widgets);
  const layoutInteractionTick = useWorkspacePreviewCaptureStore((s) => s.layoutInteractionTick);
  const sig = enabledWidgetSignature(widgets);
  const debounceTimer = useRef<number | undefined>(undefined);
  const layoutStopTimer = useRef<number | undefined>(undefined);
  const uploading = useRef(false);

  const runCapture = useCallback(async () => {
    const spaceId = useSpacesStore.getState().activeSpaceId;
    const root = useWorkspacePreviewCaptureStore.getState().root;
    if (!spaceId || !root || uploading.current) return;
    uploading.current = true;
    try {
      const dataUrl = await toJpeg(root, {
        quality: 0.86,
        pixelRatio: Math.min(1.2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1),
        cacheBust: true,
        backgroundColor: "#0b1120",
        canvasWidth: 720,
        skipFonts: true,
      });
      const comma = dataUrl.indexOf(",");
      const imageBase64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      const { space } = await api.putSpacePreview(spaceId, imageBase64);
      useSpacesStore.setState((s) => ({
        spaces: s.spaces.map((x) => (x.id === space.id ? space : x)),
      }));
    } catch {
      /* DOM capture often fails for cross-origin or exotic widgets — ignore */
    } finally {
      uploading.current = false;
    }
  }, []);

  useEffect(() => {
    setSpacePreviewFlush(() => runCapture());
    return () => setSpacePreviewFlush(null);
  }, [runCapture]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") void runCapture();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [runCapture]);

  useEffect(() => {
    if (!activeSpaceId) return;
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => void runCapture(), DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, [activeSpaceId, sig, runCapture]);

  useEffect(() => {
    if (!activeSpaceId || layoutInteractionTick === 0) return;
    if (layoutStopTimer.current) window.clearTimeout(layoutStopTimer.current);
    layoutStopTimer.current = window.setTimeout(() => void runCapture(), LAYOUT_STOP_MS);
    return () => {
      if (layoutStopTimer.current) window.clearTimeout(layoutStopTimer.current);
    };
  }, [activeSpaceId, layoutInteractionTick, runCapture]);

  return null;
}
