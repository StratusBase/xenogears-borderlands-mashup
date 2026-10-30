import {readFile,writeFile} from 'node:fs/promises';
const data=JSON.parse(await readFile('src/rendering/quality/fire/hybridGlyphs.json','utf8'));
const glyphs=[...data.a,...data.c,...data.contact],cell=512,minX=-.30,minY=-.4,width=2.05,height=1.65;
const paths=glyphs.map((glyph,index)=>`<g transform="translate(${index*cell},${cell}) scale(${cell/width},${-cell/height}) translate(${-minX},${-minY})">${glyph.layers.map(layer=>layer.paths.map(commands=>`<path fill="rgb(${Math.round((.15+layer.band*.28)*255)},0,0)" d="${commands.map(c=>c.join(' ')).join(' ')}"/>`).join('')).join('')}</g>`).join('');
await writeFile('src/rendering/quality/fire/hybridAtlas.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="${cell*5}" height="${cell}" viewBox="0 0 ${cell*5} ${cell}"><title>Fire A+C authored shape atlas - color channels encode palette bands</title>${paths}</svg>\n`);
console.log('Built Fire hybrid atlas from authored cubic-path source.');
