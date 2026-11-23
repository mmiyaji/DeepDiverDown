// Display preferences affect rendering only; they never alter the model.
export function legendState(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  return {
    labels: value.labels !== false,
    management: value.management !== false,
    clouds: value.clouds !== false,
    sync: value.sync !== false,
    async: value.async !== false,
    hiddenProviders: Array.isArray(value.hiddenProviders) ? [...new Set(value.hiddenProviders.filter(p => typeof p === 'string'))] : [],
    hiddenKinds: Array.isArray(value.hiddenKinds) ? [...new Set(value.hiddenKinds.filter(k => typeof k === 'string'))] : [],
  };
}

export function showGroup(group, state) {
  if (state.hiddenKinds.includes(group.kind)) return false;
  if (group.kind !== 'cloud' && group.kind !== 'datacenter') return true;
  return state.clouds && !state.hiddenProviders.includes(group.provider || '');
}

export function showLink(timing, state) {
  return timing === true ? state.sync : timing === false ? state.async : true;
}
