# DIALab Web

Browser-based port of the MATLAB **DIALab2026** application for Differential Impedance Analysis (DIA) of electrochemical impedance spectroscopy data.

## Current features

- Import `.xlsx`, `.xls`, `.csv`, or `.txt` EIS data.
- Expected first three columns: `frequency [Hz]`, `Zreal [Ohm]`, `Zimag [Ohm]`.
- Automatic sign normalization: imported imaginary impedance is stored as `Zimag = -abs(Zimag input)` so the Nyquist ordinate `-Zimag` is always non-negative.
- Automatic sign normalization: imported imaginary impedance is stored as `Zimag = -abs(Zimag input)` so the Nyquist ordinate `-Zimag` is always non-negative.
- Automatic imaginary-sign normalization at import: DIALab stores `Zimag = -abs(Zimag input)` so capacitive EIS data are always plotted as `-Zimag >= 0` in the first Nyquist quadrant.
- Interactive Nyquist and Bode plots.
- Primary DIA: `T`, `R`, `C`, `Rs`.
- Secondary DIA: `n`, secondary `T`, `1-n`, `A_CPE`, effective capacitance.
- Weighted spectral distributions for primary and secondary parameters.
- Process-frequency range selection and slope-derived `n` indicator.
- Synchronized HF/LF process boundaries on Nyquist and Bode in both DIA tabs.
- Synchronized HF/LF process boundaries are displayed on Nyquist and Bode in both DIA tabs.
- Synchronized process boundaries: the same HF/LF limits selected on the DIA plots are displayed on Nyquist and Bode.
- Local two-section Voigt point reconstruction, preview, replace and undo, with reconstructed `Zimag <= 0`.
- XLSX export with separate EIS, Primary DIA, Secondary DIA, and Spectra sheets.
- No backend: user data stay in the browser.

## Interface organization

The workspace is organized in four tabs:

1. **EIS** — Nyquist + Bode.
2. **Primary DIA** — Nyquist + Bode + Primary temporal plot + Primary parameter spectra.
3. **Secondary DIA** — Nyquist + Bode + Secondary temporal plot + Secondary parameter spectra.
4. **Data table** — corrected EIS data, including both `Zimag` and `-Zimag` columns.

In the Primary and Secondary DIA tabs, the selected process is shown consistently in all plots:

- DIA temporal plot: shaded interval with HF/LF dashed cursors.
- Nyquist: selected arc segment plus HF/LF boundary markers.
- Bode: shaded frequency interval plus HF/LF vertical lines.

## Interface organization

1. **EIS** — Nyquist + Bode.
2. **Primary DIA** — Nyquist + Bode + Primary temporal plot + Primary parameter spectra.
3. **Secondary DIA** — Nyquist + Bode + Secondary temporal plot + Secondary parameter spectra.
4. **Data table** — corrected EIS data.

The selected process is highlighted consistently: HF/LF cursors on DIA, boundary markers and selected segment on Nyquist, and a shaded HF/LF interval on Bode.

## Interface organization

1. **EIS** — Nyquist + Bode.
2. **Primary DIA** — Nyquist + Bode + Primary temporal plot + Primary parameter spectra.
3. **Secondary DIA** — Nyquist + Bode + Secondary temporal plot + Secondary parameter spectra.
4. **Data table** — corrected EIS data.

The selected process is highlighted consistently: HF/LF cursors on DIA, boundary markers and selected segment on Nyquist, and a shaded HF/LF interval on Bode.

## Run locally

Because the application uses JavaScript modules, serve the folder through a local HTTP server rather than opening `index.html` directly.

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

On Windows, if `python` is not recognized, try:

```bash
py -m http.server 8000
```

## Publish with GitHub Pages

1. Create a GitHub repository, for example `DIALab-Web`.
2. Upload all files in this folder to the repository root.
3. In **Settings → Pages**, choose **Deploy from a branch**.
4. Select branch `main` and folder `/ (root)`.
5. Save.

The project includes `.nojekyll` so GitHub Pages serves the static files directly.

## Numerical implementation notes

The DIA equations were ported from the MATLAB application. Important implementation choices are:

1. The densified grid uses `linspace` in `nu = log10(1/omega)`, because `nu` is already a logarithmic coordinate.
2. At import, the imaginary impedance is normalized to `Zimag <= 0`. This is intentional for the requested capacitive first-quadrant Nyquist convention. Consequently, genuine inductive loops represented by positive `Zimag` would also be folded into the first quadrant in this version.
3. The point-correction equation already returns an imaginary component with the sign of `Zimag`. An earlier web version inverted this value a second time. This has been fixed; the reconstructed point is now stored as `Zimag = -abs(Zimag_reconstructed)` and displayed as `-Zimag >= 0`.

### Smoothing

When available, the browser app uses `csaps-js` with smoothing parameter `p` in `[0,1]`. If the CDN does not load, the program automatically falls back to PCHIP interpolation and reports this in the footer.

Before publication-grade quantitative use, representative datasets should still be validated against the reference MATLAB implementation, particularly for smoothing and frequency-range edge effects.

## Tests

The included Node test checks:

- EIS parsing;
- primary and secondary DIA generation;
- spectra generation;
- mixed-sign imaginary input normalization;
- reconstructed-point sign consistency.

Run:

```bash
npm test
```

## External browser libraries

The static page currently loads pinned versions of:

- Plotly.js 3.7.0 — plotting;
- SheetJS CE 0.20.3 — spreadsheet import/export;
- csaps-js 0.1.1 — cubic smoothing spline.

For a fully offline deployment, download these libraries and replace the CDN `<script>` references in `index.html` with local files.

## License

The included repository scaffold is provided under the MIT License. Review the licensing terms for the scientific DIA method/code and external libraries before public release.

## v0.3 interface/export changes

- Removed the redundant standalone EIS tab. Primary and Secondary DIA each retain synchronized Nyquist and Bode views.
- The desktop workspace is viewport-fitted: the four plots remain in a 2×2 grid and resize with the browser window.
- The left control sidebar scrolls independently, without scrolling or shrinking the plot workspace.
- The `Spectra` worksheet exports every spectrum as an adjacent two-column pair (`parameter`, `count`) rather than stacking all spectra in a single three-column list.
