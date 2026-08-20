# DIALab Web

Browser-based port of the MATLAB **DIALab2026** application for Differential Impedance Analysis (DIA) of electrochemical impedance spectroscopy data.

## Features

- Import `.xlsx`, `.xls`, `.csv`, or `.txt` EIS data.
- Expected first three columns: `frequency [Hz]`, `Zreal [Ohm]`, `Zimag [Ohm]`.
- Interactive Nyquist and Bode plots.
- Primary DIA: `T`, `R`, `C`, `Rs`.
- Secondary DIA: `n`, secondary `T`, `1-n`, `A_CPE`, effective capacitance.
- Weighted spectral distributions for primary and secondary parameters.
- Process-frequency range selection and slope-derived `n` indicator.
- Local two-section Voigt point reconstruction, preview, replace and undo.
- XLSX export with separate EIS, Primary DIA, Secondary DIA, and Spectra sheets.
- No backend: user data stay in the browser.

## Run locally

Because the application uses JavaScript modules, serve the folder through a local HTTP server rather than opening `index.html` directly.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish with GitHub Pages

1. Create a GitHub repository, for example `DIALab-Web`.
2. Upload all files in this folder to the repository root.
3. In **Settings → Pages**, choose **Deploy from a branch**.
4. Select branch `main` and folder `/ (root)`.
5. Save. GitHub will publish the site at a URL similar to `https://USERNAME.github.io/DIALab-Web/`.

The project includes `.nojekyll` so GitHub Pages serves the static files directly.

## Numerical implementation notes

The DIA equations were ported from the MATLAB application. Two deliberate robustness changes were made:

1. The densified grid uses `linspace` in `nu = log10(1/omega)`. The MATLAB source used `logspace(log10(a), log10(b), ...)` even though `nu` is already logarithmic; this is problematic when `nu` is negative and can distort spacing.
2. The point-correction routine stores the reconstructed imaginary impedance using the standard EIS sign convention (`Zimag < 0` for a capacitive arc). In the MATLAB callback, the variable named `Z_double_prime_omega3` represents `-Z''` but is assigned directly to the `Zimag` column.

### Smoothing

When available, the browser app uses `csaps-js` with the same smoothing parameter convention (`p` in `[0,1]`) as MATLAB `csaps`. If that CDN does not load, the program automatically falls back to PCHIP interpolation and reports this in the footer.

Before using the web version for publication-grade quantitative results, validate representative datasets against the reference MATLAB implementation, particularly at the edges of the frequency range and for noisy/non-ideal spectra.

## External browser libraries

The static page currently loads pinned versions of:

- Plotly.js 3.7.0 — plotting
- SheetJS CE 0.20.3 — spreadsheet import/export
- csaps-js 0.1.1 — cubic smoothing spline

For a fully offline deployment, download these libraries and replace the CDN `<script>` references in `index.html` with local files.

## License

The included repository scaffold is provided under the MIT License. Review the licensing terms for your scientific DIA method/code and external libraries before public release.
