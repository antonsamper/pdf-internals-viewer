import { StrictMode } from "react"
import { createRoot, hydrateRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { sitePage } from "./lib/site-content"

const root = document.getElementById("root")!
const application = (
  <StrictMode>
    <App initialPath={sitePage(window.location.pathname)?.path ?? "/"} />
  </StrictMode>
)
if (root.hasChildNodes()) hydrateRoot(root, application)
else createRoot(root).render(application)
