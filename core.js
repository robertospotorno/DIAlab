export const EPS = 1e-30;

export function linspace(a, b, n) {
  if (n <= 1) return [a];
  const step = (b - a) / (n - 1);
  return Array.from({ length: n }, (_, i) => a + i * step);
}

export function diff(a) {
  const out = new Array(Math.max(0, a.length - 1));
  for (let i = 0; i < out.length; i++) out[i] = a[i + 1] - a[i];
  return out;
}

export function log10abs(x) {
  return Math.log10(Math.max(Math.abs(x), EPS));
}

function isFiniteNumber(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

function roundTo(x, digits) {
  const p = 10 ** digits;
  return Math.round((x + Number.EPSILON) * p) / p;
}

function prepareXY(x, y) {
  const pairs = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    if (isFiniteNumber(x[i]) && isFiniteNumber(y[i])) pairs.push([x[i], y[i]]);
  }
  pairs.sort((a, b) => a[0] - b[0]);
  const xx = [], yy = [];
  for (const [xi, yi] of pairs) {
    if (xx.length && Math.abs(xi - xx[xx.length - 1]) < 1e-14) {
      yy[yy.length - 1] = (yy[yy.length - 1] + yi) / 2;
    } else {
      xx.push(xi); yy.push(yi);
    }
  }
  return [xx, yy];
}

// Shape-preserving piecewise cubic Hermite interpolation (Fritsch-Carlson style).
export function pchip(xInput, yInput, xi) {
  const [x, y] = prepareXY(xInput, yInput);
  const n = x.length;
  if (n < 2) return xi.map(() => NaN);
  if (n === 2) {
    const m = (y[1] - y[0]) / (x[1] - x[0]);
    return xi.map(v => y[0] + m * (v - x[0]));
  }

  const h = diff(x);
  const delta = h.map((hi, i) => (y[i + 1] - y[i]) / hi);
  const d = new Array(n).fill(0);

  for (let k = 1; k < n - 1; k++) {
    if (delta[k - 1] === 0 || delta[k] === 0 || Math.sign(delta[k - 1]) !== Math.sign(delta[k])) {
      d[k] = 0;
    } else {
      const w1 = 2 * h[k] + h[k - 1];
      const w2 = h[k] + 2 * h[k - 1];
      d[k] = (w1 + w2) / (w1 / delta[k - 1] + w2 / delta[k]);
    }
  }

  d[0] = ((2 * h[0] + h[1]) * delta[0] - h[0] * delta[1]) / (h[0] + h[1]);
  if (Math.sign(d[0]) !== Math.sign(delta[0])) d[0] = 0;
  else if (Math.sign(delta[0]) !== Math.sign(delta[1]) && Math.abs(d[0]) > Math.abs(3 * delta[0])) d[0] = 3 * delta[0];

  const j = n - 1;
  d[j] = ((2 * h[j - 1] + h[j - 2]) * delta[j - 1] - h[j - 1] * delta[j - 2]) / (h[j - 1] + h[j - 2]);
  if (Math.sign(d[j]) !== Math.sign(delta[j - 1])) d[j] = 0;
  else if (Math.sign(delta[j - 1]) !== Math.sign(delta[j - 2]) && Math.abs(d[j]) > Math.abs(3 * delta[j - 1])) d[j] = 3 * delta[j - 1];

  return xi.map(v => {
    let k;
    if (v <= x[0]) k = 0;
    else if (v >= x[n - 1]) k = n - 2;
    else {
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (x[mid] <= v) lo = mid; else hi = mid;
      }
      k = lo;
    }
    const hk = x[k + 1] - x[k];
    const t = (v - x[k]) / hk;
    const h00 = 2*t**3 - 3*t**2 + 1;
    const h10 = t**3 - 2*t**2 + t;
    const h01 = -2*t**3 + 3*t**2;
    const h11 = t**3 - t**2;
    return h00*y[k] + h10*hk*d[k] + h01*y[k+1] + h11*hk*d[k+1];
  });
}

export function interpolateSeries(x, y, xi, smoothing = true, smoothP = 0.997) {
  const [xx, yy] = prepareXY(x, y);
  if (xx.length < 3) return pchip(xx, yy, xi);
  if (smoothing && globalThis.csapsjs?.csaps) {
    try {
      const out = globalThis.csapsjs.csaps(xx, yy, xi, { smooth: smoothP });
      if (Array.isArray(out) && out.every(Number.isFinite)) return out;
    } catch (err) {
      console.warn('CSAPS failed; falling back to PCHIP.', err);
    }
  }
  return pchip(xx, yy, xi);
}

export function normalizeData(rows) {
  const parsed = [];
  for (const row of rows) {
    if (!row || row.length < 3) continue;
    const f = Number(row[0]), re = Number(row[1]), im = Number(row[2]);
    if (f > 0 && Number.isFinite(f) && Number.isFinite(re) && Number.isFinite(im)) parsed.push({ f, re, im });
  }
  parsed.sort((a, b) => b.f - a.f);
  const unique = [];
  for (const p of parsed) {
    if (unique.length && Math.abs(p.f - unique[unique.length - 1].f) <= Math.max(1, p.f) * 1e-12) continue;
    unique.push(p);
  }
  if (unique.length < 5) throw new Error('At least 5 valid EIS points are required.');
  return {
    frequency: unique.map(p => p.f),
    re: unique.map(p => p.re),
    im: unique.map(p => p.im),
  };
}

export function basicEIS(data) {
  const magnitude = data.re.map((r, i) => Math.hypot(r, data.im[i]));
  const phase = data.re.map((r, i) => Math.atan2(data.im[i], r) * 180 / Math.PI);
  return { magnitude, phase };
}

function derivative(y, x) {
  const dy = diff(y), dx = diff(x);
  return dy.map((v, i) => Math.abs(dx[i]) > EPS ? v / dx[i] : NaN);
}

function validPrimary(nu, T, R, Rs, C) {
  const out = { nu: [], T: [], R: [], Rs: [], C: [] };
  for (let i = 0; i < nu.length; i++) {
    if ([nu[i], T[i], R[i], Rs[i], C[i]].every(Number.isFinite) && Math.abs(T[i]) > EPS && Math.abs(R[i]) > EPS && Math.abs(C[i]) > EPS) {
      out.nu.push(nu[i]); out.T.push(T[i]); out.R.push(R[i]); out.Rs.push(Rs[i]); out.C.push(C[i]);
    }
  }
  if (out.nu.length < 4) throw new Error('The DIA equations returned too few finite points. Check data order, units, and impedance quality.');
  return out;
}

export function calculateDIA(data, options = {}) {
  const dt = Math.max(100, Math.min(10000, Math.round(options.densification ?? 500)));
  const smoothing = options.smoothing ?? true;
  const smoothP = Math.max(0, Math.min(1, Number(options.smoothP ?? 0.997)));
  const omega = data.frequency.map(f => 2 * Math.PI * f);
  const leff = data.im.map((zIm, i) => zIm / (-omega[i]));
  const T = derivative(leff, data.re);
  const omegaCalc = omega.slice(1);
  const nu = omegaCalc.map(w => Math.log10(1 / w));
  const dRe = derivative(data.re, omega);
  const R = dRe.map((dre, i) => {
    const w = omegaCalc[i], t = T[i];
    const denom = 2 * w * t * t;
    return Math.abs(denom) > EPS ? (-dre) * (1 + (w*w*t*t)) ** 2 / denom : NaN;
  });
  const Rs = data.re.slice(1).map((re, i) => re - R[i] / (1 + omegaCalc[i] ** 2 * T[i] ** 2));
  const C = T.map((t, i) => Math.abs(R[i]) > EPS ? t / R[i] : NaN);

  const p = validPrimary(nu, T, R, Rs, C);
  const nuSpline0 = linspace(Math.min(...p.nu), Math.max(...p.nu), dt);
  const TSpline0 = interpolateSeries(p.nu, p.T, nuSpline0, smoothing, smoothP);
  const RSpline0 = interpolateSeries(p.nu, p.R, nuSpline0, smoothing, smoothP);
  const RsSpline0 = interpolateSeries(p.nu, p.Rs, nuSpline0, smoothing, smoothP);
  const CSpline0 = interpolateSeries(p.nu, p.C, nuSpline0, smoothing, smoothP);

  // Secondary DIA follows the MATLAB code: derivatives of log10(T), log10(R), log10(C) vs nu.
  const logR = p.R.map(log10abs), logT = p.T.map(log10abs), logC = p.C.map(log10abs);
  const RsecRaw = derivative(logR, p.nu);
  const TsecRaw = derivative(logT, p.nu);
  const CsecRaw = derivative(logC, p.nu);
  const nuSecRaw = p.nu.slice(0, -1);
  const finiteSec = { nu: [], R: [], T: [], C: [] };
  for (let i = 0; i < nuSecRaw.length; i++) {
    if ([nuSecRaw[i], RsecRaw[i], TsecRaw[i], CsecRaw[i]].every(Number.isFinite)) {
      finiteSec.nu.push(nuSecRaw[i]); finiteSec.R.push(RsecRaw[i]); finiteSec.T.push(TsecRaw[i]); finiteSec.C.push(CsecRaw[i]);
    }
  }
  if (finiteSec.nu.length < 3) throw new Error('Too few finite points for secondary DIA.');
  const nuSecSpline0 = linspace(Math.min(...finiteSec.nu), Math.max(...finiteSec.nu), dt);
  const RsecSpline0 = interpolateSeries(finiteSec.nu, finiteSec.R, nuSecSpline0, smoothing, smoothP);
  const TsecSpline0 = interpolateSeries(finiteSec.nu, finiteSec.T, nuSecSpline0, smoothing, smoothP);
  const CsecSpline0 = interpolateSeries(finiteSec.nu, finiteSec.C, nuSecSpline0, smoothing, smoothP);

  // Evaluate primary R and Rs on the secondary grid for CPE/Ceff calculations.
  const ROnSec = interpolateSeries(p.nu, p.R, nuSecSpline0, smoothing, smoothP);
  const RsOnSec = interpolateSeries(p.nu, p.Rs, nuSecSpline0, smoothing, smoothP);
  const omegaOnSec = nuSecSpline0.map(v => 1 / (10 ** v));
  const Acpe0 = RsecSpline0.map((n, i) => {
    const r = ROnSec[i], w = omegaOnSec[i];
    if (!Number.isFinite(r) || Math.abs(r) < EPS || !Number.isFinite(n) || !(w > 0)) return NaN;
    return (1 / r) * (w ** (-n)) * Math.cos(n * Math.PI / 2);
  });
  const Ceff0 = Acpe0.map((a, i) => {
    const n = RsecSpline0[i], r1 = RsOnSec[i], r2 = ROnSec[i];
    if (![a,n,r1,r2].every(Number.isFinite) || Math.abs(n) < EPS || a === 0 || Math.abs(r1 + r2) < EPS) return NaN;
    const parallelR = (r1 * r2) / (r1 + r2);
    const v = (Math.abs(a) ** (1 / n)) * (Math.abs(parallelR) ** ((1 - n) / n));
    return Number.isFinite(v) ? v : NaN;
  });

  // Match the original edge handling: remove the first densified point.
  const cut = arr => arr.slice(1);
  const nuSpline = cut(nuSpline0);
  const frequencySpline = nuSpline.map(v => 1 / (2 * Math.PI * (10 ** v)));
  const TSpline = cut(TSpline0), RSpline = cut(RSpline0), RsSpline = cut(RsSpline0), CSpline = cut(CSpline0);
  const nuSecSpline = cut(nuSecSpline0), RsecSpline = cut(RsecSpline0), TsecSpline = cut(TsecSpline0), CsecSpline = cut(CsecSpline0);
  const Acpe = cut(Acpe0), Ceff = cut(Ceff0);

  return {
    raw: { omega, nu: p.nu, T: p.T, R: p.R, Rs: p.Rs, C: p.C },
    primary: {
      nu: nuSpline,
      frequency: frequencySpline,
      T: TSpline,
      R: RSpline,
      Rs: RsSpline,
      C: CSpline,
      logT: TSpline.map(log10abs),
      logR: RSpline.map(log10abs),
      logRs: RsSpline.map(log10abs),
      logC: CSpline.map(log10abs),
    },
    secondary: {
      nu: nuSecSpline,
      n: RsecSpline,
      secondaryT: TsecSpline,
      oneMinusN: CsecSpline,
      Acpe,
      Ceff,
      logCeff: Ceff.map(log10abs),
    }
  };
}

export function weightedSpectrum(valuesInput, nuInput, rounding = 3, selectivity = 0.01) {
  const values = [], nu = [];
  for (let i = 0; i < Math.min(valuesInput.length, nuInput.length); i++) {
    if (Number.isFinite(valuesInput[i]) && Number.isFinite(nuInput[i])) { values.push(valuesInput[i]); nu.push(nuInput[i]); }
  }
  if (values.length < 2) return { x: [], y: [] };
  const rounded = values.map(v => roundTo(v, rounding));
  const unique = [...new Set(rounded)].sort((a,b) => a-b);
  const dnu = diff(nu).map(Math.abs);
  const counts = unique.map(u => {
    let s = 0;
    for (let i = 0; i < rounded.length - 1; i++) if (Math.abs(rounded[i] - u) <= selectivity) s += dnu[i];
    return s;
  });
  return { x: unique, y: counts };
}

export function buildSpectra(dia, startIndex, endIndex, options = {}) {
  const rp = Math.max(0, Math.min(5, Math.round(options.roundPrimary ?? 3)));
  const rs = Math.max(0, Math.min(5, Math.round(options.roundSecondary ?? 3)));
  const sel = Math.max(0.000001, Number(options.selectivity ?? 0.01));
  const lo = Math.max(0, Math.min(startIndex, endIndex));
  const hi = Math.min(dia.primary.nu.length - 1, Math.max(startIndex, endIndex));
  const slice = a => a.slice(lo, hi + 1);

  const pNu = slice(dia.primary.nu);
  const sMax = Math.min(hi, dia.secondary.nu.length - 1);
  const sLo = Math.min(lo, sMax);
  const sSlice = a => a.slice(sLo, sMax + 1);
  const sNu = sSlice(dia.secondary.nu);

  return {
    primary: {
      T: weightedSpectrum(slice(dia.primary.logT), pNu, rp, sel),
      R: weightedSpectrum(slice(dia.primary.logR), pNu, rp, sel),
      C: weightedSpectrum(slice(dia.primary.logC), pNu, rp, sel),
      Rs: weightedSpectrum(slice(dia.primary.logRs), pNu, rp, sel),
    },
    secondary: {
      T: weightedSpectrum(sSlice(dia.secondary.secondaryT), sNu, rs, sel),
      n: weightedSpectrum(sSlice(dia.secondary.n), sNu, rs, sel),
      oneMinusN: weightedSpectrum(sSlice(dia.secondary.oneMinusN), sNu, rs, sel),
      Ceff: weightedSpectrum(sSlice(dia.secondary.logCeff), sNu, rs, sel),
    }
  };
}

export function processSlope(dia, startIndex, endIndex) {
  const lo = Math.max(0, Math.min(startIndex, endIndex));
  const hi = Math.min(dia.primary.nu.length - 1, Math.max(startIndex, endIndex));
  if (hi - lo < 1) return NaN;
  const x = dia.primary.nu.slice(lo, hi + 1);
  const y = dia.primary.logR.slice(lo, hi + 1);
  const mx = x.reduce((a,b) => a+b,0)/x.length, my = y.reduce((a,b) => a+b,0)/y.length;
  let num = 0, den = 0;
  for (let i=0;i<x.length;i++) { num += (x[i]-mx)*(y[i]-my); den += (x[i]-mx)**2; }
  return den > EPS ? num/den : NaN;
}

export function reconstructPoint(data, index, useHigher = false) {
  const n = data.frequency.length;
  if (!Number.isInteger(index) || index < 0 || index >= n) throw new Error('Invalid point index.');
  let idxH, idxL;
  if (useHigher) {
    if (index < 2) throw new Error('Choose point 3 or later when using higher-frequency reference points.');
    idxH = index - 2; idxL = index - 1;
  } else {
    if (index > n - 3) throw new Error(`Choose point ${n-2} or earlier when using lower-frequency reference points.`);
    idxH = index + 1; idxL = index + 2;
  }
  const omega = data.frequency.map(f => 2*Math.PI*f);
  const omega3 = omega[index], omega1 = omega[idxH], omega2 = omega[idxL];
  const z1 = data.re[idxH], z2 = data.re[idxL];
  const zd1 = -data.im[idxH], zd2 = -data.im[idxL];
  const den1 = z1*z1 + zd1*zd1, den2 = z2*z2 + zd2*zd2;
  if (den1 < EPS || den2 < EPS) throw new Error('Reference impedance is too close to zero.');
  const sigma1 = z1/den1, sigma2 = z2/den2;
  const Cu1 = -zd1/(omega1*den1), Cu2 = -zd2/(omega2*den2);
  const dsigma = sigma2 - sigma1;
  if (Math.abs(dsigma) < EPS) throw new Error('Reference points lead to a singular local Voigt reconstruction.');
  const T = (Cu1-Cu2)/dsigma;
  const b1 = 1/(omega1*omega1*T*T+1), b2 = 1/(omega2*omega2*T*T+1);
  if (Math.abs(b1-b2) < EPS) throw new Error('Reference points are numerically degenerate.');
  const C = (Cu1-Cu2)/(b1-b2);
  const Cinf = (Cu2*b1-Cu1*b2)/(b1-b2);
  const sigma0 = (sigma1*(1-b2)-sigma2*(1-b1))/(b1-b2);
  if ([Cinf,sigma0,T].some(v => !Number.isFinite(v) || Math.abs(v)<EPS)) throw new Error('Invalid local Voigt parameters.');
  const k = (T*sigma0+C+Cinf)/(2*T*Cinf);
  const disc = k*k - sigma0/(T*Cinf);
  if (!(disc >= 0)) throw new Error('Local Voigt reconstruction has a negative discriminant.');
  const root = Math.sqrt(disc);
  const tau1 = 1/(k-root);
  const tau2 = T*Cinf/(sigma0*tau1);
  const denomR = sigma0*(tau1-tau2);
  if (Math.abs(denomR)<EPS) throw new Error('Local Voigt reconstruction is singular.');
  const R1 = (tau1-T)/denomR;
  const R2 = (T-tau2)/denomR;
  const zp = R1/(omega3*omega3*tau1*tau1+1) + R2/(omega3*omega3*tau2*tau2+1);
  const minusZpp = omega3*R1*tau1/(omega3*omega3*tau1*tau1+1) + omega3*R2*tau2/(omega3*omega3*tau2*tau2+1);
  if (![zp,minusZpp].every(Number.isFinite)) throw new Error('Reconstructed point is not finite.');
  return { index, idxH, idxL, re: zp, im: -minusZpp, minusIm: minusZpp, parameters: {T,C,Cinf,sigma0,tau1,tau2,R1,R2} };
}
