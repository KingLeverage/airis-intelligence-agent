/**
 * Widget file CRUD — persistence in `persistence/space-store.ts`, mutations here.
 */
export {
  listWidgetRecords,
  listWidgetRecordsDetailed,
  getWidget,
  saveWidget,
  deleteWidgetFile,
} from "../../persistence/space-store.js";

export {
  createWidgetForSpace,
  updateWidgetForSpace,
  deleteWidgetForSpace,
} from "./widget-mutations.js";
