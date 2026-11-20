// Shared by the workspace and static articles; run before styles to avoid a flash.
;(() => {
  const key = "pdf-internals-theme"
  const root = document.documentElement
  const system = window.matchMedia("(prefers-color-scheme: dark)")
  const valid = (value) => ["light", "dark", "system"].includes(value)
  let preference = "system"
  try {
    const saved = localStorage.getItem(key)
    if (valid(saved)) preference = saved
  } catch {
    /* Appearance still works when browser storage is unavailable. */
  }

  function apply() {
    const dark =
      preference === "dark" || (preference === "system" && system.matches)
    root.classList.toggle("dark", dark)
    root.style.colorScheme = dark ? "dark" : "light"
    root.dataset.themePreference = preference
  }
  apply()
  system.addEventListener("change", apply)
  document.addEventListener("DOMContentLoaded", apply)
  document.addEventListener("click", (event) => {
    if (
      !(event.target instanceof Element) ||
      !event.target.closest("[data-theme-control]")
    )
      return
    preference = root.classList.contains("dark") ? "light" : "dark"
    try {
      localStorage.setItem(key, preference)
    } catch {
      /* Keep the in-memory choice. */
    }
    apply()
  })
  window.addEventListener("storage", (event) => {
    if (event.key !== key && event.key !== null) return
    preference = valid(event.newValue) ? event.newValue : "system"
    apply()
  })
})()
