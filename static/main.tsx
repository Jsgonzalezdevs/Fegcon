import { createRoot } from "react-dom/client";
import "../app/globals.css";
import "../app/workspace.css";
import Home from "../app/page";

createRoot(document.getElementById("root")!).render(<Home />);
