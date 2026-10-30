import {mergeConfig} from 'vite';
import prototype from './vite.adhesive.config';

// The material-only and original prototype evidence remain frozen.
export default mergeConfig(prototype,{build:{outDir:'artifacts/adhesive-stains/build'}});
