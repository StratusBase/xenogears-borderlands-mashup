"""Package native canvas/final-bus captures; no retiming, gain or replacement audio."""
from pathlib import Path
from array import array
import json, math, subprocess
root=Path('artifacts/shock-equipment')
report={}
for name in ['rifle','heavy','mech','beam']:
    source=root/f'{name}.webm'; target=root/f'{name}.mp4'
    encoded=subprocess.run(['ffmpeg','-nostdin','-y','-i',str(source),'-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-fps_mode','passthrough','-c:a','aac','-b:a','192k','-movflags','+faststart',str(target)],capture_output=True,check=True)
    (root/f'{name}-encode.log').write_bytes(encoded.stderr)
    probe=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(target)]))
    a=next(s for s in probe['streams'] if s['codec_type']=='audio'); v=next(s for s in probe['streams'] if s['codec_type']=='video')
    decoded=subprocess.run(['ffmpeg','-nostdin','-v','error','-i',str(target),'-vn','-f','f32le','-acodec','pcm_f32le','pipe:1'],capture_output=True,check=True)
    samples=array('f');samples.frombytes(decoded.stdout)
    video=subprocess.run(['ffmpeg','-nostdin','-v','error','-i',str(target),'-map','0:v:0','-fps_mode','passthrough','-enc_time_base','1:1000000','-f','null','-'],capture_output=True,check=True)
    errors=decoded.stderr.decode()+video.stderr.decode()
    report[name]={'duration':float(probe['format']['duration']),'dimensions':[v['width'],v['height']],'sampleRate':int(a['sample_rate']),'channels':a['channels'],'sampleCount':len(samples),'rms':math.sqrt(sum(x*x for x in samples)/len(samples)),'peak':max(abs(x) for x in samples),'clippedSamples':sum(abs(x)>=1 for x in samples),'mp4DecodeErrors':errors,'source':str(source),'playback':str(target),'processing':'VFR passthrough, H.264/AAC packaging; no audio filters, gain normalization, replacement or retiming'}
    assert report[name]['rms']>0 and report[name]['clippedSamples']==0 and not errors,report[name]
(root/'audio.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({name:{k:v for k,v in data.items() if k in ['duration','rms','peak','clippedSamples','mp4DecodeErrors']} for name,data in report.items()},indent=2))
