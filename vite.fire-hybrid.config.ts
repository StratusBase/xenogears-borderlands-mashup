import {mergeConfig} from 'vite';
import fire from './vite.fire.config';
export default mergeConfig(fire,{build:{outDir:'artifacts/fire-hybrid/build',rollupOptions:{input:['fire-hybrid-lab.html']}}});
