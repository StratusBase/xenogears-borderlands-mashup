import {mergeConfig} from 'vite';
import fire from './vite.fire.config';
export default mergeConfig(fire,{build:{outDir:'artifacts/fire-full/build',rollupOptions:{input:['fire-full-lab.html']}}});
