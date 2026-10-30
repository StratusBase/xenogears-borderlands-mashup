import {mergeConfig} from 'vite';
import prototype from './vite.adhesive.config';
export default mergeConfig(prototype,{build:{outDir:'artifacts/adhesive-integration/encounter-build',rollupOptions:{input:['index.html','adhesive-encounter.html','adhesive-lab.html']}}});
