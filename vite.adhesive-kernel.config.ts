import {mergeConfig} from 'vite';
import prototype from './vite.adhesive.config';
export default mergeConfig(prototype,{build:{outDir:'artifacts/adhesive-stain-performance/kernel-build',rollupOptions:{input:['adhesive-kernel-profile.html']}}});
