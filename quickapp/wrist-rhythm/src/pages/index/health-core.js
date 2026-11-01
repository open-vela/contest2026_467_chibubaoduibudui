// service.health 返回值的纯数据规范化层。

function validData(data) {
  return data && Number.isFinite(data.value) && Number.isFinite(data.timeStamp) && data.timeStamp > 0;
}

function normalizeRecent(list) {
  if (!Array.isArray(list)) return [];
  const normalized = [];
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (!item || !validData(item.data)) continue;
    normalized.push({
      ok: true,
      dataType: item.dataType,
      value: item.data.value,
      timeStamp: item.data.timeStamp,
    });
  }
  return normalized;
}

function normalizeSample(dataType, sample) {
  if (!validData(sample)) return null;
  return {
    ok: true,
    dataType,
    value: sample.value,
    timeStamp: sample.timeStamp,
  };
}

function normalizeError(code) {
  return { ok: false, code, unsupported: code === 203 };
}

module.exports = { normalizeRecent, normalizeSample, normalizeError };
