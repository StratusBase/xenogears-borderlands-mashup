import {honeyLight,HONEY_PALETTE} from './material';

/** Shares the frozen honey lighting/opacity. Only the contact-plane field and its normal vary. */
export const variedStainFragment=/* glsl */`
uniform vec3 centers[4],normals[4],tangents[4],metric;
uniform vec4 stainFrames[4],stainLobes[16];uniform float radii[4],ages[4],presence,skin;
varying vec3 vP,vN,vShadeN,vV;varying mat3 vCoatBasis;${honeyLight}
void main(){float field=0.,opticalDepth=0.,edgeInk=0.;vec3 coatNormal=normalize(vShadeN);
 for(int i=0;i<4;i++){
  vec3 m=max(abs(metric),vec3(.000001)),d=(vP-centers[i])*m,localNormal=normalize(normals[i]),n=normalize(normals[i]/m);
  vec3 right=normalize(tangents[i]*m),along=normalize(cross(n,right));
  vec2 q=vec2(dot(d,right),dot(d,along))/max(.001,radii[i]);
  vec2 rotated=vec2(dot(q,stainFrames[i].xy),dot(q,vec2(-stainFrames[i].y,stainFrames[i].x)));
  float shape=10000.;vec2 tilt=vec2(0.);
  for(int j=0;j<4;j++){
   vec4 lobe=stainLobes[i*4+j];vec2 delta=rotated-lobe.xy,scaled=delta*lobe.zw;float distance=length(scaled);
   if(distance<shape){shape=distance;tilt=delta*lobe.zw*lobe.zw;}
  }
  vec2 unrotatedTilt=vec2(stainFrames[i].x*tilt.x-stainFrames[i].y*tilt.y,stainFrames[i].y*tilt.x+stainFrames[i].x*tilt.y);
  float reveal=smoothstep(-.1,.1,mix(-.85,1.5,smoothstep(0.,.18,ages[i]))-q.x);
  float a=(1.-smoothstep(.74,1.,shape))*reveal*smoothstep(.06,.50,dot(normalize(vN),localNormal));
  if(a>field){field=a;opticalDepth=clamp(1.-pow(max(0.,shape)/.99,1.5),.06,1.);edgeInk=smoothstep(.78,.90,shape);
   vec3 rounded=n*sqrt(max(.08,1.-shape*shape))+right*unrotatedTilt.x*.55+along*unrotatedTilt.y*.55;
   coatNormal=normalize(vCoatBasis*(rounded*m));
  }
 }
 if(field<.02||presence<.005)discard;
 vec3 color=honeyColor(coatNormal,normalize(vV),opticalDepth);color=mix(color,vec3(${HONEY_PALETTE.outline.join(',')}),edgeInk*.88);
 gl_FragColor=vec4(color,smoothstep(.02,.12,field)*presence*(skin>.5?.35:honeyOpacity(opticalDepth)));
}`;
