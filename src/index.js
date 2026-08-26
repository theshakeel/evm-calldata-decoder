import { AbiCoder, id } from "ethers";

/**
 * Split a comma-separated type list at the top level only, so tuple types
 * with nested commas — e.g. "(address,uint256)[],bool" — parse correctly.
 * @param {string} s
 * @returns {string[]}
 */
export function splitTopLevel(s) {
  if (!s.trim()) return [];
  const parts = [];
  let depth = 0;
  let current = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/**
 * Parse a human-readable function signature like "transfer(address,uint256)".
 * @param {string} sig
 * @returns {{ name: string, types: string[] } | null}
 */
export function parseSignature(sig) {
  const match = sig.trim().match(/^(\w+)\(([\s\S]*)\)$/);
  if (!match) return null;
  return { name: match[1], types: splitTopLevel(match[2]) };
}

/**
 * Canonical form of a signature (whitespace stripped) — the exact string
 * that gets keccak256-hashed to produce the selector.
 * @param {string} name
 * @param {string[]} types
 */
export function canonicalSignature(name, types) {
  return `${name}(${types.join(",")})`.replace(/\s+/g, "");
}

/**
 * 4-byte function selector (0x-prefixed, 10 chars) for a signature string.
 * @param {string} sig e.g. "transfer(address,uint256)"
 * @returns {string} e.g. "0xa9059cbb"
 */
export function selector(sig) {
  const parsed = parseSignature(sig);
  if (!parsed) throw new Error(`Invalid function signature: ${sig}`);
  return id(canonicalSignature(parsed.name, parsed.types)).slice(0, 10);
}

/**
 * Render a decoded ABI value as a plain string (bigints unwrapped,
 * arrays bracketed recursively).
 * @param {any} value
 * @returns {string}
 */
export function formatDecoded(value) {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) return `[${value.map(formatDecoded).join(", ")}]`;
  return String(value);
}

/**
 * Decode raw EVM calldata against a function signature.
 *
 * Accepts calldata with or without the 4-byte selector prefix (detected by
 * length: a payload of 32-byte words plus a selector is ≡ 8 hex chars mod 64).
 *
 * @param {string} sig  Function signature, e.g. "transfer(address,uint256)"
 * @param {string} data Hex calldata, with or without 0x prefix
 * @returns {{
 *   selector: string,
 *   selectorMatch: "match" | "mismatch" | "none",
 *   params: { type: string, value: string }[]
 * }}
 */
export function decodeCalldata(sig, data) {
  const parsed = parseSignature(sig);
  if (!parsed) throw new Error(`Invalid function signature: ${sig}`);

  const computedSelector = id(canonicalSignature(parsed.name, parsed.types)).slice(0, 10);

  const clean = data.trim().replace(/^0x/, "");
  const hasSelector = clean.length % 64 === 8;
  const actualSelector = hasSelector ? "0x" + clean.slice(0, 8) : "";
  const payload = hasSelector ? clean.slice(8) : clean;

  const selectorMatch = !hasSelector
    ? "none"
    : actualSelector.toLowerCase() === computedSelector.toLowerCase()
      ? "match"
      : "mismatch";

  let params = [];
  if (parsed.types.length > 0) {
    const coder = AbiCoder.defaultAbiCoder();
    const result = coder.decode(parsed.types, "0x" + payload);
    params = parsed.types.map((type, i) => ({ type, value: formatDecoded(result[i]) }));
  }

  return { selector: computedSelector, selectorMatch, params };
}

/**
 * Parse a raw string value into the JS shape ethers' coder expects for a type.
 * Arrays are comma-separated; tuples are JSON array literals.
 * @param {string} type
 * @param {string} raw
 */
export function parseEncodeValue(type, raw) {
  const t = type.trim();
  if (t.endsWith("[]")) {
    const base = t.slice(0, -2);
    return raw.split(",").map((s) => s.trim()).filter(Boolean).map((item) => parseEncodeValue(base, item));
  }
  if (t.startsWith("(") || t.startsWith("tuple")) {
    // Pragmatic tuple input: a JSON array literal, e.g. ["0xabc...","100"]
    return JSON.parse(raw);
  }
  if (t === "bool") return raw === "true" || raw === "1";
  if (t.startsWith("uint") || t.startsWith("int")) return BigInt(raw.trim() || "0");
  return raw;
}

/**
 * ABI-encode a function call: signature + string parameter values in.
 *
 * @param {string} sig Function signature, e.g. "transfer(address,uint256)"
 * @param {string[]} values One raw string per parameter (arrays comma-separated,
 *   tuples as JSON array literals)
 * @returns {{ selector: string, params: string, calldata: string }}
 */
export function encodeCalldata(sig, values) {
  const parsed = parseSignature(sig);
  if (!parsed) throw new Error(`Invalid function signature: ${sig}`);
  if (values.length !== parsed.types.length) {
    throw new Error(`Signature has ${parsed.types.length} parameter(s) but ${values.length} value(s) given`);
  }
  const sel = id(canonicalSignature(parsed.name, parsed.types)).slice(0, 10);
  const coder = AbiCoder.defaultAbiCoder();
  const jsValues = parsed.types.map((t, i) => parseEncodeValue(t, values[i] ?? ""));
  const encodedParams = coder.encode(parsed.types, jsValues);
  return { selector: sel, params: encodedParams, calldata: sel + encodedParams.slice(2) };
}
