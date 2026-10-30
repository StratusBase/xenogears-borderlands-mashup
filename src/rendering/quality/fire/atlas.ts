import * as THREE from 'three';
const url=new URL('./hybridAtlas.svg',import.meta.url).href;
interface Atlas {texture:THREE.Texture;ready:Promise<void>;references:number}
let active:Atlas|undefined;
/** One atlas shared by live Fire art. Transient ballistic materials release their own lease on disposal. */
export function acquireFireAtlas(){
 if(!active){
  let ready:Promise<void>,texture:THREE.Texture;
  if(typeof Image!=='undefined'){
   let resolve!:()=>void,reject!:(e:unknown)=>void;ready=new Promise<void>((a,b)=>{resolve=a;reject=b;});
   texture=new THREE.TextureLoader().load(url,resolve,undefined,reject);
   // A failed asset remains a visible capture error through prepare(), without an unhandled rejection at startup.
   void ready.catch(()=>{});
  }else{texture=new THREE.DataTexture(new Uint8Array([0,0,0,0]),1,1);ready=Promise.resolve();}
  texture.colorSpace=THREE.NoColorSpace;texture.generateMipmaps=false;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
  active={texture,ready,references:0};
 }
 const atlas=active;atlas.references++;let released=false;
 return{texture:atlas.texture,ready:atlas.ready,release(){if(released)return;released=true;if(--atlas.references===0){atlas.texture.dispose();if(active===atlas)active=undefined;}}};
}
