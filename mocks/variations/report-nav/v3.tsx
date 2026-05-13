export function ReportNavAccordion() {
  return (
    <nav>
      <header>Run #1293 Full 5-furlong-close-4m Jump</header>
      <details open>
        <summary>Full runs</summary>
        <button>Previous full #1286</button>
        <button>Next full #1296</button>
      </details>
      <details open>
        <summary>Same project</summary>
        <button>Previous same #1292 partial</button>
        <button>Next same #1294 partial</button>
      </details>
      <details>
        <summary>Timeline</summary>
        <button>Previous run #1292 partial</button>
        <button>Next run #1294 partial</button>
      </details>
    </nav>
  );
}
