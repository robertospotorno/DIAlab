# DIALab Web v0.4

Browser-based port of the MATLAB **DIALab2026** application for Differential Impedance Analysis (DIA) of electrochemical impedance spectroscopy data.

## Current features

- Import `.xlsx`, `.xls`, `.csv`, or `.txt` EIS data.
- First three columns: `frequency [Hz]`, `Zreal [Ohm]`, `Zimag [Ohm]`.
- Automatic imaginary-sign normalization: imported data are stored as `Zimag = -abs(Zimag input)`, so capacitive data are plotted as `-Zimag >= 0` in the first Nyquist quadrant.
- Interactive Nyquist and Bode plots.
- Primary DIA: `T`, `R`, `C`, `Rs`.
- Secondary DIA: `n`, secondary `T`, `1-n`, `A_CPE`, `Ceff`.
- Weighted parameter spectra.
- HF/LF process cursors synchronized across DIA, Nyquist and Bode.
- Local two-section Voigt point reconstruction with preview, replace and undo.
- XLSX export with separate `EIS`, `Primary DIA`, `Secondary DIA`, `Spectra`, and `Processes` sheets.
- All calculations are client-side; no backend is required.

## Interface tabs

1. **Primary DIA** — Nyquist + Bode + Primary temporal plot + Primary parameter spectra.
2. **Secondary DIA** — Nyquist + Bode + Secondary temporal plot + Secondary parameter spectra.
3. **Data table** — corrected EIS data.
4. **Process identification** — automatic process bands, synchronized Nyquist/Bode/Primary DIA visualization, editable process limits, and a live parameter table.

The four-panel DIA layouts are fitted to the browser viewport. The left controls use an independent scrollbar so scrolling the menu does not move or shrink the plot workspace.

## Process identification (v0.4)

The automatic detector works from the same DIA quantities used elsewhere in the application rather than fitting an equivalent circuit.

1. A full-range weighted spectrum of `log10(T)` is generated.
2. Significant local maxima are detected after light smoothing of the spectrum counts.
3. Because the DIA temporal coordinate is `nu = log10(1/omega)`, a peak at `log10(T)` maps directly to the characteristic `nu` position of that process.
4. Initial process boundaries are placed midway between adjacent detected characteristic positions.
5. Each process band is summarized independently.

For each band the Process identification table reports:

- `R`: peak of the local `log10(R)` spectrum, converted back to ohms;
- `C`: peak of the local `log10(C)` spectrum, converted back to farads;
- `Ceff`: peak of the cleaned local `log10(Ceff)` spectrum, converted back to farads;
- `T`: peak of the local `log10(T)` spectrum, converted back to seconds;
- `alpha peak`: peak of the local secondary-DIA `n` spectrum;
- `alpha median`: median of the local secondary-DIA `n` values.

Process bands are shown with pale colors on:

- the Primary DIA temporal plot;
- the Nyquist curve;
- the Bode plot.

Click a process row to select it. Its HF and LF sliders become active. Internal boundaries are shared by neighboring processes, so moving a shared boundary immediately recalculates both adjacent process parameter sets and redraws the colored bands.

`Peak threshold` controls the minimum relative height used by the automatic `T`-spectrum peak detector. Press **Re-identify** after changing it, or change the value directly to trigger a new identification.

### Scientific note

Automatic process identification is intended as an initial segmentation aid, not as an equivalent-circuit fit or an unambiguous physical assignment. Overlapping or poorly separated processes can require manual boundary adjustment. Publication-grade use should be validated against the reference MATLAB workflow and representative experimental datasets.

## Spectra export

The `Spectra` worksheet stores every series as an adjacent pair of columns:

- `Primary T parameter | Primary T count`
- `Primary Rs parameter | Primary Rs count`
- `Primary R parameter | Primary R count`
- `Primary C parameter | Primary C count`
- `Secondary T parameter | Secondary T count`
- `Secondary n parameter | Secondary n count`
- `Secondary 1-n parameter | Secondary 1-n count`
- `Secondary log Ceff parameter | Secondary log Ceff count`

The `Processes` worksheet exports one row per identified process with frequency limits, `R`, `C`, `Ceff`, `T`, alpha peak and alpha median.

## Run locally

Serve the folder through a local HTTP server rather than opening `index.html` directly:

```bash
python -m http.server 8000
```

On Windows, if needed:

```bash
py -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Publish with GitHub Pages

1. Create a repository, e.g. `DIALab-Web`.
2. Upload all files in this folder to the repository root.
3. Open **Settings → Pages**.
4. Choose **Deploy from a branch**.
5. Select `main` and `/ (root)`.

`.nojekyll` is included.

## Numerical implementation notes

- Densification uses `linspace` in `nu = log10(1/omega)` because `nu` is already logarithmic.
- Input imaginary impedance is normalized to `Zimag <= 0`; genuine inductive loops with positive `Zimag` are therefore folded into the first quadrant in this version.
- Point reconstruction stores the corrected imaginary component as `Zimag = -abs(Zimag_reconstructed)`.
- When available, smoothing uses `csaps-js`; otherwise the app falls back to PCHIP.

## Tests

Run:

```bash
npm test
```

The test suite checks parsing, DIA generation, spectra generation and paired export, sign normalization, point-correction sign, and automatic identification of the two processes in the bundled two-RC demo dataset.

## External browser libraries

- Plotly.js 3.7.0
- SheetJS CE 0.20.3
- csaps-js 0.1.1

## License

The repository scaffold is provided under the MIT License. Review licensing for the scientific DIA method/code and external libraries before public release.
