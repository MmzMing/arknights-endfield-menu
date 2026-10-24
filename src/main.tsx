import { createRoot } from "react-dom/client";
// self-hosted fonts, the same faces and weights the demo pulled from Google Fonts
// (Noto Sans SC as a variable font: the menu uses interpolated 450/550 weights)
import "@fontsource/rajdhani/500.css";
import "@fontsource/rajdhani/600.css";
import "@fontsource/rajdhani/700.css";
import "@fontsource-variable/noto-sans-sc";
import "@fontsource/inter/500.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";
import "./index.css";
import App from "./App.tsx";

/* No StrictMode: its dev double-invoke of effects would replay the entrance choreography twice and desync
   the measured CSS timelines this port exists to preserve. */
createRoot(document.getElementById("root")!).render(<App />);
