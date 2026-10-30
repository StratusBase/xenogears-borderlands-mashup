import {mergeConfig} from 'vite';
import prototype from './vite.adhesive.config';

// Preserve earlier frozen gameplay/performance receipts.
export default mergeConfig(prototype,{build:{outDir:'artifacts/adhesive-stain-performance/build'}});
