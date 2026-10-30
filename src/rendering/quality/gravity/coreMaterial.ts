import * as THREE from 'three';

/** The same black center and restrained violet edge at field and cartridge scale. */
export function gravityCoreMaterial(rimGain=1){return new THREE.ShaderMaterial({
 vertexShader:`varying vec3 vN,vV;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vV=-p.xyz;vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*p;}`,
 fragmentShader:`uniform float presence,pulse,rimGain;varying vec3 vN,vV;void main(){float facing=max(0.,dot(normalize(vN),normalize(vV)));float rim=1.-smoothstep(.015,.15,facing);float inner=(1.-smoothstep(.17,.31,facing))*(1.-rim);vec3 c=vec3(.0015,.0007,.004)+vec3(.16,.052,.26)*inner+vec3(.85,.51,1.)*rim*rimGain*(.8+.2*pulse);gl_FragColor=vec4(c,presence);}`,
 uniforms:{presence:{value:1},pulse:{value:0},rimGain:{value:rimGain}},transparent:true,toneMapped:false
});}
