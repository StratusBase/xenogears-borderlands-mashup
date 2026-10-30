import {resinVertex,resinFragment,resinParticleVertex,resinParticleFragment} from './resin';

/** Previous Tack Resin is kept byte-for-byte for material-only, same-build comparisons. */
export type ResinMaterialStyle='previous'|'honey';
export const HONEY_PALETTE=Object.freeze({
 thin:Object.freeze([.55,.20,.001]),middle:Object.freeze([.77,.23,0]),thick:Object.freeze([.31,.09,.0033]),
 outline:Object.freeze([.16,.06,.006]),reflection:Object.freeze([1.98,1.19,.24]),
});
const color=(rgb:readonly number[])=>`vec3(${rgb.map(v=>v.toFixed(6)).join(',')})`;

/** Linear palette calibrated through the game's unchanged ACES(1.05)/sRGB output, including HDR reflection. */
export const honeyLight=/* glsl */`
vec3 honeyColor(vec3 n,vec3 v,float thickness){
 vec3 l=normalize(vec3(-.80,1.30,1.10)),h=normalize(l+v);
 float depth=clamp(thickness,0.,1.),light=smoothstep(-.25,.85,dot(n,l));
 vec3 body=mix(${color(HONEY_PALETTE.thin)},${color(HONEY_PALETTE.middle)},smoothstep(.08,.55,depth));
 body=mix(body,${color(HONEY_PALETTE.thick)},smoothstep(.60,1.,depth));body*=.88+.12*light;
 float edge=pow(1.-abs(dot(n,v)),3.5);
 body=mix(body,${color(HONEY_PALETTE.thin)},edge*.12);
 float broad=smoothstep(.955,.992,max(0.,dot(n,h))),sharp=smoothstep(.997,.9999,max(0.,dot(n,h)));
 return mix(body,${color(HONEY_PALETTE.reflection)},smoothstep(.50,.70,depth)*(broad*.62+sharp*.06));
}
float honeyOpacity(float thickness){return mix(.78,.95,smoothstep(.12,.95,thickness));}
`;
const vertex=(fold:boolean)=>/* glsl */`${fold?'attribute float resinThickness;':'uniform float resinVolume;'}
varying vec3 vN,vV;varying float vThickness;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=-mv.xyz;vThickness=${fold?'resinThickness':'resinVolume'};gl_Position=projectionMatrix*mv;}`;
const fragment=/* glsl */`uniform float age,life;varying vec3 vN,vV;varying float vThickness;${honeyLight}
void main(){float fade=min(1.,(life-age)*9.);if(fade<.01)discard;gl_FragColor=vec4(honeyColor(normalize(vN),normalize(vV),vThickness),fade*honeyOpacity(vThickness));}`;
const particleVertex=/* glsl */`attribute float resinAlpha;varying float vA,vThickness;varying vec3 vN,vV;
void main(){vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.);vA=resinAlpha;vec3 s=vec3(dot(instanceMatrix[0].xyz,instanceMatrix[0].xyz),dot(instanceMatrix[1].xyz,instanceMatrix[1].xyz),dot(instanceMatrix[2].xyz,instanceMatrix[2].xyz));vN=normalize(mat3(modelViewMatrix*instanceMatrix)*(normal/max(s,vec3(.000001))));vV=-mv.xyz;vThickness=clamp(sqrt(max(s.x,s.y))*5.+.25,.25,1.);gl_Position=projectionMatrix*mv;}`;
const particleFragment=/* glsl */`varying float vA,vThickness;varying vec3 vN,vV;${honeyLight}
void main(){if(vA<.01)discard;gl_FragColor=vec4(honeyColor(normalize(vN),normalize(vV),vThickness),vA*honeyOpacity(vThickness));}`;

export function resinShaders(style:ResinMaterialStyle,kind:'fold'|'solid'|'particles'){
 if(style==='previous')return{vertexShader:kind==='particles'?resinParticleVertex:resinVertex,fragmentShader:kind==='particles'?resinParticleFragment:resinFragment};
 return{vertexShader:kind==='particles'?particleVertex:vertex(kind==='fold'),fragmentShader:kind==='particles'?particleFragment:fragment};
}
