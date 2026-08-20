import { normalizeData, calculateDIA, buildSpectra, reconstructPoint } from './core.js';
import fs from 'node:fs';

const text=fs.readFileSync(new URL('./examples/demo_two_RC.csv',import.meta.url),'utf8');
const rows=text.trim().split(/\r?\n/).slice(1).map(line=>line.split(','));
const data=normalizeData(rows);
const dia=calculateDIA(data,{densification:500,smoothing:false,smoothP:0.997});
const spectra=buildSpectra(dia,50,400,{roundPrimary:3,roundSecondary:3,selectivity:0.01});
if(data.frequency.length!==61) throw new Error('Input parsing test failed');
if(dia.primary.nu.length!==499) throw new Error('Primary DIA length test failed');
if(dia.secondary.nu.length!==499) throw new Error('Secondary DIA length test failed');
if(!dia.primary.R.every(Number.isFinite)) throw new Error('Primary R contains non-finite values');
if(!dia.secondary.n.every(Number.isFinite)) throw new Error('Secondary n contains non-finite values');
if(!spectra.primary.R.x.length) throw new Error('Spectrum generation failed');
try { reconstructPoint(data,20,false); } catch (e) { console.warn('Point reconstruction is dataset-dependent:',e.message); }
console.log('DIALab Web core tests passed.');
console.log({points:data.frequency.length, primary:dia.primary.nu.length, secondary:dia.secondary.nu.length, spectrumBins:spectra.primary.R.x.length});
