import health from '@service.health';
import core from './health-core.js';
import adapter from './health-adapter.js';

export const DATA_TYPES = health.DATA_TYPES;

export function getRecent(dataTypes) {
  return adapter.getRecent(health, core, dataTypes);
}

export function subscribe(dataType, onSample, onError) {
  adapter.subscribe(health, core, dataType, onSample, onError);
}

export function unsubscribe(dataType, onError) {
  return adapter.unsubscribe(health, core, dataType, onError);
}
