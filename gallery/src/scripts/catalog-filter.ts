export function mountCatalog() {
  const grid = document.querySelector<HTMLElement>("#catalog-grid");
  const search = document.querySelector<HTMLInputElement>("#catalog-search");
  const empty = document.querySelector<HTMLElement>("#catalog-empty");
  const buttons = [...document.querySelectorAll<HTMLButtonElement>("[data-filter]")];
  if (!grid || !search || !empty || buttons.length === 0) return;

  const cards = [...grid.querySelectorAll<HTMLElement>(".plugin-card")];
  const params = new URLSearchParams(location.search);
  let category = params.get("category") || "all";
  if (!buttons.some((button) => button.dataset.filter === category)) category = "all";

  const apply = () => {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    for (const card of cards) {
      const inCategory = category === "all" || card.dataset.category === category;
      const text = card.dataset.search ?? "";
      const match = inCategory && (q === "" || text.includes(q));
      card.hidden = !match;
      if (match) shown += 1;
    }
    empty.hidden = shown !== 0;
    for (const button of buttons) button.setAttribute("aria-pressed", button.dataset.filter === category ? "true" : "false");
  };

  for (const button of buttons) {
    button.addEventListener("click", () => {
      category = button.dataset.filter ?? "all";
      const url = new URL(location.href);
      if (category === "all") url.searchParams.delete("category");
      else url.searchParams.set("category", category);
      history.replaceState(null, "", url);
      apply();
    });
  }
  search.addEventListener("input", apply);
  apply();
}
