import {mergeConfig} from 'vite';
import fire from './vite.fire.config';
export default mergeConfig(fire,{build:{outDir:'artifacts/fire-equipment/build',rollupOptions:{input:['fire-equipment.html']}}});
