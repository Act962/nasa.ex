import { createWidget } from "./create";
import { listWidgets } from "./list";
import { deleteWidget } from "./delete";
import { updateWidget } from "./update";
import { getWidgetByTag } from "./widget-by-tag";

export const widgetsRouter = {
  create: createWidget,
  list: listWidgets,
  delete: deleteWidget,
  update: updateWidget,
  byTag: getWidgetByTag,
};
