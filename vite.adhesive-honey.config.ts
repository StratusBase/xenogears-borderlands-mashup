import {mergeConfig} from 'vite';
import prototype from './vite.adhesive.config';

// Preserve the preceding frozen review build and its receipts.
export default mergeConfig(prototype,{build:{outDir:'artifacts/adhesive-honey/build'}});
