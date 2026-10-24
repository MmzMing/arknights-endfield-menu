import { createContext, useContext } from "react";

/* How a button's click leaves the menu. The demo delegated [data-action] clicks to a document listener and
   re-dispatched them as "ef-action" DOM events; in React the same routing lives in App and is handed down
   through this context (buttons keep their data-action attributes: the CSS keyframes and the e2e harness
   address them by it, and "close" buttons route to requestClose like the demo's special case). */

export interface MenuActions {
  /** any [data-action] click except "close" */
  onAction: (action: string) => void;
  /** the power button, the × button and the letterbox around the stage */
  requestClose: () => void;
}

export const MenuActionsContext = createContext<MenuActions | null>(null);

export function useMenuActions(): MenuActions {
  const actions = useContext(MenuActionsContext);
  if (!actions) throw new Error("useMenuActions outside MenuActionsContext");
  return actions;
}
