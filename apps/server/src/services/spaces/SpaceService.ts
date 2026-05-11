/**
 * Spaces domain facade — persistence implementation: `persistence/space-store.ts`.
 */
export {
  initGlobalFiles,
  listSpaceIds,
  ensureSpaceFiles,
  createSpace,
  getSpaceMeta,
  listSpacesMeta,
  deleteSpace,
  touchSpace,
  readSettings,
  readInstructions,
  readLayout,
  writeLayout,
  loadSpaceBundle,
  listWidgetRecordsDetailed,
  readChat,
  appendChatMessage,
  clearChat,
} from "../../persistence/space-store.js";
