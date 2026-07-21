const COLLECTION_KEYS = ["signals", "top_opportunities", "items", "opportunities"];
const NOISE_STATUSES = new Set(["noise", "irrelevant", "spam", "ignored", "噪声", "无关"]);
const BUSINESS_STRING_FIELDS = ["name", "customer", "goal", "offer", "notes"];
const BUSINESS_LIST_FIELDS = ["platforms", "constraints", "assets"];
const SIGNAL_STRING_FIELDS = [
  "title", "summary", "source", "evidence", "customer_quote", "customerQuote", "status"
];
const URL_FIELDS = ["url", "source_url", "link"];
const DATE_FIELDS = ["observed_at", "date", "published_at"];
const COUNT_FIELDS = ["observed_count", "count", "frequency"];
const SCORE_FIELDS = ["score", "priority_score", "opportunity_score"];
const DEFAULT_FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/**
 * Validate an input document without normalizing or mutating it.
 *
 * `ok` only reflects structural errors. Evidence warnings are advisory and are
 * intentionally kept separate so an unverified idea can become a validation
 * task instead of being rejected as malformed input.
 */
export function validateInputDocument(raw, options = {}) {
  const structuralErrors = [];
  const evidenceWarnings = [];
  const now = parseNow(options.now, structuralErrors);
  const futureToleranceMs = parseFutureTolerance(options.futureToleranceMs, structuralErrors);

  if (!isRecord(raw)) {
    addIssue(
      structuralErrors,
      "invalid_top_level",
      "$",
      Array.isArray(raw) ? "顶层输入必须是对象，不能是数组。" : "顶层输入必须是对象。"
    );
    return buildResult(structuralErrors, evidenceWarnings, []);
  }

  if (hasOwn(raw, "business")) validateBusiness(raw.business, structuralErrors);

  const presentCollections = COLLECTION_KEYS.filter((key) => hasOwn(raw, key));
  if (!presentCollections.length) {
    addIssue(
      structuralErrors,
      "missing_signal_collection",
      "$",
      "至少需要提供 signals、top_opportunities、items 或 opportunities 中的一个数组。"
    );
  }

  for (const collectionName of presentCollections) {
    validateCollection(
      raw[collectionName],
      collectionName,
      structuralErrors,
      evidenceWarnings,
      now,
      futureToleranceMs
    );
  }

  return buildResult(structuralErrors, evidenceWarnings, presentCollections);
}

/**
 * Return the original input when valid, otherwise throw an error carrying both
 * human-readable messages and the full structured validation result.
 */
export function assertValidInputDocument(raw, options = {}) {
  const result = validateInputDocument(raw, options);
  if (!result.ok) {
    const error = new TypeError(result.errors.join(" "));
    error.name = "InputValidationError";
    error.validationErrors = result.errors;
    error.validationResult = result;
    throw error;
  }
  return raw;
}

function validateBusiness(business, errors) {
  if (!isRecord(business)) {
    addIssue(errors, "invalid_business", "$.business", "business 必须是对象。");
    return;
  }

  for (const field of BUSINESS_STRING_FIELDS) {
    if (hasOwn(business, field) && typeof business[field] !== "string") {
      addIssue(errors, "invalid_string", `$.business.${field}`, `${field} 必须是字符串。`);
    }
  }

  for (const field of BUSINESS_LIST_FIELDS) {
    if (!hasOwn(business, field)) continue;
    validateStringOrStringArray(business[field], `$.business.${field}`, field, errors);
  }
}

function validateCollection(collection, name, errors, warnings, now, futureToleranceMs) {
  const path = `$.${name}`;
  if (!Array.isArray(collection)) {
    addIssue(errors, "invalid_collection", path, `${name} 必须是数组。`);
    return;
  }
  if (collection.length === 0) {
    addIssue(errors, "empty_collection", path, `${name} 至少需要一条记录。`);
    return;
  }

  collection.forEach((signal, index) => {
    const signalPath = `${path}[${index}]`;
    if (typeof signal === "string") {
      if (!signal.trim()) {
        addIssue(errors, "empty_signal", signalPath, "字符串记录不能为空。");
      } else {
        addEvidenceWarnings(signal, signalPath, warnings);
      }
      return;
    }

    if (!isRecord(signal)) {
      addIssue(errors, "invalid_signal", signalPath, "记录必须是非空字符串或对象。");
      return;
    }

    validateSignalObject(signal, signalPath, errors, now, futureToleranceMs);
    addEvidenceWarnings(signal, signalPath, warnings);
  });
}

function validateSignalObject(signal, path, errors, now, futureToleranceMs) {
  if (!hasOwn(signal, "title")) {
    addIssue(errors, "missing_title", `${path}.title`, "对象记录必须包含 title。");
  } else if (typeof signal.title !== "string") {
    addIssue(errors, "invalid_title", `${path}.title`, "title 必须是字符串。");
  } else if (!signal.title.trim()) {
    addIssue(errors, "empty_title", `${path}.title`, "title 不能为空。\n");
  }

  if (hasOwn(signal, "id")) {
    const id = signal.id;
    if (typeof id !== "string" && !(typeof id === "number" && Number.isFinite(id))) {
      addIssue(errors, "invalid_id", `${path}.id`, "id 必须是字符串或有限数值。");
    }
  }

  for (const field of SIGNAL_STRING_FIELDS) {
    if (field === "title" || !hasOwn(signal, field)) continue;
    if (typeof signal[field] !== "string") {
      addIssue(errors, "invalid_string", `${path}.${field}`, `${field} 必须是字符串。`);
    }
  }

  for (const field of URL_FIELDS) {
    if (!hasOwn(signal, field)) continue;
    validateUrl(signal[field], `${path}.${field}`, field, errors);
  }

  for (const field of DATE_FIELDS) {
    if (!hasOwn(signal, field)) continue;
    validateDate(signal[field], `${path}.${field}`, field, errors, now, futureToleranceMs);
  }

  for (const field of COUNT_FIELDS) {
    if (!hasOwn(signal, field)) continue;
    const value = signal[field];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
      addIssue(
        errors,
        "invalid_count",
        `${path}.${field}`,
        `${field} 必须是大于等于 0 的安全整数。`
      );
    }
  }

  for (const field of SCORE_FIELDS) {
    if (!hasOwn(signal, field)) continue;
    const value = signal[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
      addIssue(errors, "invalid_score", `${path}.${field}`, `${field} 必须是 0 到 100 之间的有限数值。`);
    }
  }

  if (hasOwn(signal, "tags")) {
    validateStringOrStringArray(signal.tags, `${path}.tags`, "tags", errors);
  }
}

function validateStringOrStringArray(value, path, field, errors) {
  if (typeof value === "string") return;
  if (!Array.isArray(value)) {
    addIssue(errors, "invalid_string_list", path, `${field} 必须是字符串或字符串数组。`);
    return;
  }
  value.forEach((item, index) => {
    if (typeof item !== "string") {
      addIssue(errors, "invalid_string", `${path}[${index}]`, `${field} 的每一项都必须是字符串。`);
    }
  });
}

function validateUrl(value, path, field, errors) {
  if (typeof value !== "string") {
    addIssue(errors, "invalid_url", path, `${field} 必须是 http 或 https URL 字符串。`);
    return;
  }
  try {
    const parsed = new URL(value.trim());
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || !parsed.hostname) throw new Error();
  } catch {
    addIssue(errors, "invalid_url", path, `${field} 必须是有效的 http 或 https URL。`);
  }
}

function validateDate(value, path, field, errors, now, futureToleranceMs) {
  if (typeof value !== "string" || !value.trim()) {
    addIssue(errors, "invalid_date", path, `${field} 必须是可解析的非空日期字符串。`);
    return;
  }

  const timestamp = parseDate(value.trim());
  if (timestamp == null) {
    addIssue(errors, "invalid_date", path, `${field} 不是有效日期。`);
    return;
  }
  if (timestamp > now + futureToleranceMs) {
    addIssue(errors, "future_date", path, `${field} 不得明显晚于当前时间。`);
  }
}

function addEvidenceWarnings(signal, path, warnings) {
  if (isNoise(signal)) return;

  const title = typeof signal === "string"
    ? signal.trim()
    : typeof signal.title === "string" && signal.title.trim()
      ? signal.title.trim()
      : `记录 ${path}`;

  if (!hasEvidence(signal)) {
    addIssue(
      warnings,
      "missing_evidence",
      path,
      `“${title}”缺少可复核证据，应转为验证任务，不能视为已验证机会。`
    );
  }
  if (!hasSourceOrUrl(signal)) {
    addIssue(warnings, "missing_source", path, `“${title}”缺少 source 或 url。`);
  }
}

function hasEvidence(signal) {
  if (typeof signal === "string") return false;
  return URL_FIELDS.some((field) => nonEmptyString(signal[field]))
    || nonEmptyString(signal.evidence)
    || nonEmptyString(signal.customer_quote)
    || nonEmptyString(signal.customerQuote)
    || COUNT_FIELDS.some((field) => typeof signal[field] === "number" && signal[field] > 0);
}

function hasSourceOrUrl(signal) {
  if (typeof signal === "string") return false;
  return nonEmptyString(signal.source) || URL_FIELDS.some((field) => nonEmptyString(signal[field]));
}

function isNoise(signal) {
  if (!isRecord(signal) || typeof signal.status !== "string") return false;
  return NOISE_STATUSES.has(signal.status.trim().toLowerCase());
}

function parseDate(value) {
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year
      || date.getUTCMonth() !== month - 1
      || date.getUTCDate() !== day
    ) return null;
    return date.getTime();
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function parseNow(value, errors) {
  if (value == null) return Date.now();
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(String(value));
  if (!Number.isFinite(timestamp)) {
    addIssue(errors, "invalid_validator_now", "$", "校验选项 now 必须是有效日期。\n");
    return Date.now();
  }
  return timestamp;
}

function parseFutureTolerance(value, errors) {
  if (value == null) return DEFAULT_FUTURE_TOLERANCE_MS;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    addIssue(errors, "invalid_future_tolerance", "$", "futureToleranceMs 必须是大于等于 0 的有限数值。\n");
    return DEFAULT_FUTURE_TOLERANCE_MS;
  }
  return value;
}

function buildResult(structuralErrors, evidenceWarnings, collections) {
  return {
    ok: structuralErrors.length === 0,
    errors: structuralErrors.map((issue) => issue.message),
    warnings: evidenceWarnings.map((issue) => issue.message),
    structuralErrors,
    evidenceWarnings,
    collections
  };
}

function addIssue(target, code, path, message) {
  target.push({ code, path, message: message.trim() });
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export { COLLECTION_KEYS as INPUT_COLLECTION_KEYS, DEFAULT_FUTURE_TOLERANCE_MS };
