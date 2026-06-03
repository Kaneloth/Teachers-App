import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { applyStoredPreferences } from './lib/themeInit';
applyStoredPreferences();

createRoot(document.getElementById("root")!).render(<App />);
