import {readFile,writeFile,stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const base='artifacts/corrosive-ab/',recordings=JSON.parse(await readFile(base+'recordings.json','utf8'));
const ffmpeg=process.env.FFMPEG_PATH??'/opt/homebrew/bin/ffmpeg',ffprobe=process.env.FFPROBE_PATH??'/opt/homebrew/bin/ffprobe';
function run(command,args){const result=spawnSync(command,args,{encoding:'utf8',maxBuffer:8_000_000});if(result.status!==0)throw new Error(result.stderr);return result.stdout;}
const files=[];
for(const recording of [...recordings.results,{file:'sizing-review.webm',delivery:'sticky'},{file:'footsteps/before.webm',delivery:'walk'},{file:'footsteps/after.webm',delivery:'walk'}]){
 const stem=recording.file.replace(/\.webm$/,'');
 run(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',base+recording.file,'-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-fps_mode','passthrough','-c:a','aac','-b:a','192k','-movflags','+faststart',base+stem+'.mp4']);
 run(ffmpeg,['-hide_banner','-loglevel','error','-y','-i',base+recording.file,'-vn','-ac','1','-ar','48000','-c:a','pcm_s16le',base+stem+'.wav']);
 run(ffmpeg,['-hide_banner','-loglevel','error','-y','-ss',recording.delivery==='sticky'?'1.95':'1.10','-i',base+stem+'.mp4','-frames:v','1',base+stem+'-poster.png']);
 const media=JSON.parse(run(ffprobe,['-v','error','-show_streams','-show_format','-of','json',base+stem+'.mp4']));assert.ok(media.streams.some(s=>s.codec_type==='video'));assert.ok(media.streams.some(s=>s.codec_type==='audio'));
 const wav=await readFile(base+stem+'.wav');let data;for(let offset=12;offset+8<wav.length;){const id=wav.toString('ascii',offset,offset+4),size=wav.readUInt32LE(offset+4);if(id==='data'){data=wav.subarray(offset+8,offset+8+size);break;}offset+=8+size+(size%2);}
 assert.ok(data?.length);let peak=0,sum=0,clippedSamples=0,nonzero=0;for(let i=0;i<data.length;i+=2){const raw=data.readInt16LE(i),sample=raw/32768;peak=Math.max(peak,Math.abs(sample));sum+=sample*sample;if(Math.abs(raw)>=32767)clippedSamples++;if(raw)nonzero++;}
 const result={file:stem+'.wav',video:stem+'.mp4',seconds:data.length/2/48000,peak,rms:Math.sqrt(sum/(data.length/2)),clippedSamples,nonzeroSamples:nonzero,videoBytes:(await stat(base+stem+'.mp4')).size,streams:media.streams.map(s=>({type:s.codec_type,codec:s.codec_name,width:s.width,height:s.height,sampleRate:s.sample_rate,channels:s.channels,averageFrameRate:s.avg_frame_rate,duration:s.duration})),duration:Number(media.format.duration)};
 assert.ok(peak>(recording.delivery==='walk'?.0003:.01)&&result.rms>(recording.delivery==='walk'?.000015:.0001),'Capture must contain actual non-silent gameplay audio');assert.equal(clippedSamples,0);files.push(result);console.log('MEDIA',JSON.stringify(result));
}
await writeFile(base+'audio-measurements.json',JSON.stringify({capturedAt:new Date().toISOString(),source:'Exact MediaRecorder live audio tracks, decoded from original WebM to 48kHz mono PCM for signal measurement. MP4 is timing-preserving H.264/AAC transcode; no normalization or sound substitution.',files},null,2)+'\n');
