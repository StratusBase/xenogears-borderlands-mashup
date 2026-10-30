/** Original A+B shader retained for same-build visual/performance comparisons. */
export const prototypeVertex=/* glsl */`uniform mat3 worldNormal;varying vec3 vWorld;void main(){vec4 world=modelMatrix*vec4(position,1.);world.xyz+=normalize(worldNormal*normal)*.008;vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`;
export const prototypeFragment=/* glsl */`
 uniform vec3 centers[3],uaxes[3],vaxes[3],normals[3];uniform float radii[3],ages[3],seeds[3],presence,kind;
 varying vec3 vWorld;
 float line(vec2 p,vec2 a,vec2 b){vec2 ab=b-a;float t=clamp(dot(p-a,ab)/dot(ab,ab),0.,1.);return length(p-a-ab*t);}
 void main(){float core=0.,blue=0.,knots=0.;
  for(int i=0;i<3;i++){
   vec3 delta=vWorld-centers[i];float radius=max(.002,radii[i]);vec2 p=vec2(dot(delta,uaxes[i]),dot(delta,vaxes[i]))/radius;
   float gate=(1.-smoothstep(.68,1.,length(p)))*(1.-smoothstep(.16,.32,abs(dot(delta,normals[i]))/radius));
   float age=ages[i],seed=seeds[i],reveal=smoothstep(-.1,.05,age*8.-(p.x*.5+.5));
   float blink=.18+.82*smoothstep(.10,.70,sin(age*18.+seed*4.));float distance=4.;
   for(int branch=0;branch<3;branch++){
    float b=float(branch);vec2 q=branch==0?p:branch==1?vec2(p.y,-p.x)*1.3+vec2(.2,.1):vec2(-p.x,p.y)*1.8+vec2(.6,-.25);
    vec2 previous=vec2(-.80,.24*sin(seed+b));
    for(int j=1;j<6;j++){float k=float(j);vec2 next=vec2(-.80+k*.32,.30*sin(k*2.27+seed+b));distance=min(distance,line(q,previous,next));previous=next;}
   }
   float moving=fract(age*1.8+seed*.13),hot=.25+.75*exp(-pow((p.x*.5+.5-moving)*8.,2.));
   float width=mix(.027,.016,kind);core=max(core,(1.-smoothstep(width*.30,width,distance))*gate*reveal*blink*hot);
   blue=max(blue,(1.-smoothstep(width,width*2.8,distance))*gate*reveal*(.3+.7*blink));
   vec2 node=vec2(-.28,.24*sin(2.27+seed));knots=max(knots,(1.-smoothstep(.018,.065,length(p-node)))*gate*blink*reveal);
  }
  float a=max(blue*.50,max(core,knots)) * presence;if(a<.012)discard;
  vec3 color=mix(vec3(.035,.23,.95),vec3(.77,.95,1.),clamp(core+knots,0.,1.));gl_FragColor=vec4(color,a);
 }
`;
