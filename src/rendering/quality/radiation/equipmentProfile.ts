import type {EquipmentAppearance} from '../../../core/appearance';
import type {WeaponSpec} from '../../../core/arsenal';

/** Localized containment hardware; these timings affect art only. */
export function radiationEquipmentProfile(appearance:EquipmentAppearance,secondary=false,mech=false,spec?:WeaponSpec){
 const delivery=spec?.projectile??appearance.projectile??'bullet',type=spec?.weaponType??appearance.weaponType;
 const beam=delivery==='beam'||delivery==='arc',sticky=delivery==='sticky',heavy=['rocket','homing','cluster','orb'].includes(delivery)||type==='launcher';
 const rapid=!beam&&(type==='pistol'||type==='smg'||appearance.form==='rapid');
 const hold=beam?.12:sticky?.08:heavy?.12:type==='sniper'?.09:rapid?.04:.07;
 const decay=(beam?.5:sticky?1.2:heavy?.8:type==='sniper'?.45:rapid?.15:.3)*(mech?1.25:1)*(secondary?.6:1);
 return{delivery,beam,sticky,heavy,rapid,hold,decay,peak:secondary?.6:beam?.78:rapid?.64:1,slits:Math.max(1,(heavy||mech||type==='sniper'?3:2)-(secondary?1:0)),flecks:secondary||rapid||beam?0:heavy?mech?4:3:1};
}
