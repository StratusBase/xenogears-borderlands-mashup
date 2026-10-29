import { INVENTORY_CAPACITY, MAX_CREDITS, normalizeVendingPurchases, rollItem, seededRandom, type Item, type Progression, type Rarity, type Slot } from './index';

export type VendingType = 'weapons' | 'medical' | 'mech';
export interface VendingOffer { id: string; item: Item; price: number }
export interface VendingPurchaseResult { ok: boolean; item?: Item; spent: number; reason?: string }
export interface VendingServicePrices { pilotAmmo: number; mechAmmo: number; medical: number; mechRepair: number }

const vendorTypes: readonly VendingType[] = ['weapons', 'medical', 'mech'];
const mechSlots: readonly Slot[] = ['weapon', 'shield', 'reactor', 'legs', 'weapon', 'shield'];
const rarityPrice: Record<Rarity, number> = { common: 1, uncommon: 1.25, rare: 1.6, epic: 2.2, legendary: 3 };
const basePrice: Record<VendingType, number> = { weapons: 95, medical: 60, mech: 145 };

function validWave(wave: number): boolean { return Number.isSafeInteger(wave) && wave >= 1 && wave <= 1_000_000; }
function validType(type: VendingType): boolean { return vendorTypes.includes(type); }
function hash(value: string): number {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) result = Math.imul(result ^ value.charCodeAt(index), 0x01000193);
  return result >>> 0;
}

function currentPurchases(state: Progression): string[] {
  const book = normalizeVendingPurchases(state.vendingPurchases);
  return book?.wave === state.wave ? book.offerIds : [];
}

/** Known, reproducible stock. Opening a menu never rerolls gear or mutates progression. */
export function getVendingOffers(state: Progression, type: VendingType): VendingOffer[] {
  if (!validType(type) || !validWave(state.wave) || !Array.isArray(state.inventory)) return [];
  const level = Math.min(100, state.wave);
  const purchased = new Set(currentPurchases(state));
  const owned = new Set(state.inventory.map(item => item.id));
  const offers: VendingOffer[] = [];
  for (let index = 0; index < 6; index++) {
    const id = `vending:${state.wave}:${type}:${index}`;
    if (purchased.has(id) || owned.has(id)) continue;
    const slot: Slot = type === 'weapons' ? 'weapon' : type === 'medical' ? 'shield' : mechSlots[index];
    const item = rollItem(type === 'mech' ? 'mech' : 'pilot', level, seededRandom(hash(`dust-steel:stock-v1:${id}`)), slot);
    item.id = id;
    const price = Math.round(basePrice[type] * (1 + (level - 1) * 0.08) * rarityPrice[item.rarity]);
    // Preserve world-drop resale values while making vendor buy/sell loops a loss.
    item.value = Math.min(item.value, Math.floor(price * 0.5));
    offers.push({ id, item, price });
  }
  return offers;
}

function writableProperty(object: object, key: string): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor ? 'value' in descriptor && descriptor.writable === true : Object.isExtensible(object);
}

/** Price and gear are regenerated here; callers supply only an authoritative offer ID. */
export function purchaseVendingItem(state: Progression, type: VendingType, offerId: string): VendingPurchaseResult {
  const fail = (reason: string): VendingPurchaseResult => ({ ok: false, spent: 0, reason });
  if (!validType(type)) return fail('Unknown vendor type.');
  if (!validWave(state.wave)) return fail('Vendor stock level is invalid.');
  if (!Number.isSafeInteger(state.credits) || state.credits < 0 || state.credits > MAX_CREDITS) return fail('Wallet balance is invalid.');
  if (!Array.isArray(state.inventory) || state.inventory.length >= INVENTORY_CAPACITY) return fail('Equipment storage is full.');
  if (typeof offerId !== 'string') return fail('This item is unavailable.');
  const offer = getVendingOffers(state, type).find(candidate => candidate.id === offerId);
  if (!offer) return fail('This item is unavailable. New stock arrives after an encounter.');
  if (!Number.isSafeInteger(offer.price) || offer.price <= 0 || offer.price > MAX_CREDITS) return fail('Vendor price is invalid.');
  if (state.credits < offer.price) return fail('Not enough credits.');
  if (!['inventory', 'credits', 'vendingPurchases'].every(key => writableProperty(state, key))) return fail('Equipment storage is unavailable. Your credits were retained.');

  // Allocate all delivery state before committing the three plain-data properties.
  const inventory = [...state.inventory, offer.item];
  const purchases = { wave: state.wave, offerIds: [...currentPurchases(state), offer.id] };
  state.inventory = inventory;
  state.vendingPurchases = purchases;
  state.credits -= offer.price;
  return { ok: true, item: offer.item, spent: offer.price };
}

/** Only authorizes prices: the game applies ammo and repair effects to its active bodies. */
export function getVendingServicePrices(level: number): VendingServicePrices {
  if (!Number.isSafeInteger(level) || level < 1) throw new RangeError('Vendor level must be a positive safe integer.');
  const scaling = 1 + (Math.min(100, level) - 1) * 0.08;
  return { pilotAmmo: Math.round(12 * scaling), mechAmmo: Math.round(20 * scaling), medical: Math.round(25 * scaling), mechRepair: Math.round(45 * scaling) };
}
