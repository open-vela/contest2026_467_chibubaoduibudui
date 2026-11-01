import health from '@service.health';
import storage from '@system.storage';
import profile from './fighter-profile.js';

const preferences = profile.createPreferences(health, storage);
export function getFighterPreference() { return preferences.load(); }
export function saveFighterPreference(gender) { return preferences.save(gender); }
