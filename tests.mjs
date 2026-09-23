import { normalizeData, calculateDIA, buildSpectra, spectraToPairedColumns, reconstructPoint, identifyProcesses, summarizeProcess } from './core.js';
import fs from 'node:fs';

const text=fs.readFileSync(new URL('./examples/demo_two_RC.csv',import.meta.url),'utf8');
const rows=text.trim().split(/\r?\n/).slice(1).map(line=>line.split(','));
const data=normalizeData(rows);
const dia=calculateDIA(data,{densification:500,smoothing:false,smoothP:0.997});
const spectra=buildSpectra(dia,50,400,{roundPrimary:3,roundSecondary:3,selectivity:0.01});

if(data.frequency.length!==61) throw new Error('Input parsing test failed');
if(!data.im.every(v=>v<=0)) throw new Error('Imaginary-sign normalization failed on demo data');
if(dia.primary.nu.length!==499) throw new Error('Primary DIA length test failed');
if(dia.secondary.nu.length!==499) throw new Error('Secondary DIA length test failed');
if(!dia.primary.R.every(Number.isFinite)) throw new Error('Primary R contains non-finite values');
if(!dia.secondary.n.every(Number.isFinite)) throw new Error('Secondary n contains non-finite values');
if(!spectra.primary.R.x.length) throw new Error('Spectrum generation failed');
const identified=identifyProcesses(dia,{roundPrimary:3,roundSecondary:3,selectivity:0.01,processPeakThreshold:0.15});
if(identified.summaries.length!==2) throw new Error(`Expected 2 automatically identified demo processes, got ${identified.summaries.length}`);
if(!identified.summaries.every(q=>[q.R,q.C,q.T,q.alphaPeak,q.alphaMedian].every(Number.isFinite))) throw new Error('Process parameter summary contains non-finite core values');
if(!(identified.bounds.length===3 && identified.bounds[0]===0 && identified.bounds.at(-1)===dia.primary.nu.length-1)) throw new Error('Process boundaries are invalid');
const movedBoundary=Math.min(identified.bounds[1]+12,identified.bounds[2]-5);
const changedP1=summarizeProcess(dia,identified.bounds[0],movedBoundary,{roundPrimary:3,roundSecondary:3,selectivity:0.01});
const changedP2=summarizeProcess(dia,movedBoundary,identified.bounds[2],{roundPrimary:3,roundSecondary:3,selectivity:0.01});
if(!(changedP1.fLow!==identified.summaries[0].fLow && changedP2.fHigh!==identified.summaries[1].fHigh)) throw new Error('Manual shared process-boundary update failed');
const paired=spectraToPairedColumns(spectra);
if(paired.rows[0].length!==16) throw new Error('Paired spectra export must contain 8 adjacent parameter/count pairs');
if(paired.rows[0][0]!=='Primary T parameter' || paired.rows[0][1]!=='Primary T count') throw new Error('First spectra pair headers are incorrect');
if(paired.rows[0][14]!=='Secondary log Ceff parameter' || paired.rows[0][15]!=='Secondary log Ceff count') throw new Error('Last spectra pair headers are incorrect');

const mixed=normalizeData([
  [1000,10,5], [100,20,-6], [10,30,7], [1,40,-8], [0.1,50,9], [0.01,60,-10]
]);
if(!mixed.im.every(v=>v<=0)) throw new Error('Mixed-sign import was not forced to Zimag <= 0');
if(mixed.normalization.imaginarySignAdjusted!==3) throw new Error('Adjusted-sign count is incorrect');

const c=reconstructPoint(data,20,false);
if(!(c.im<=0 && c.minusIm>=0)) throw new Error('Point reconstruction imaginary sign is incorrect');
if(Math.sign(c.im)!==Math.sign(data.im[c.index])) throw new Error('Point reconstruction moved to the opposite Nyquist quadrant');

console.log('DIALab Web core tests passed.');
console.log({
  points:data.frequency.length,
  primary:dia.primary.nu.length,
  secondary:dia.secondary.nu.length,
  spectrumBins:spectra.primary.R.x.length,
  spectraExportColumns:paired.rows[0].length,
  mixedSignAdjusted:mixed.normalization.imaginarySignAdjusted,
  reconstructedZimag:c.im,
  reconstructedNyquistY:c.minusIm,
  identifiedProcesses:identified.summaries.length,
  processBounds:identified.bounds
});
