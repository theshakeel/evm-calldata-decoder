#!/usr/bin/env node
import { decodeCalldata, encodeCalldata, selector } from "../src/index.js";

const USAGE = `evm-calldata-decoder — decode & encode EVM transaction calldata

Usage:
  calldata decode "<signature>" <hex-calldata>
  calldata encode "<signature>" <value> [<value> ...]
  calldata selector "<signature>"

Examples:
  calldata decode "transfer(address,uint256)" 0xa9059cbb000000000000000000000000ab5801a7d398351b8be11c439e05c5b3259aec9b0000000000000000000000000000000000000000000000000de0b6b3a7640000
  calldata encode "transfer(address,uint256)" 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B 1000000000000000000
  calldata selector "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)"

Array values are comma-separated; tuple values are JSON array literals.
`;

const [cmd, sig, ...rest] = process.argv.slice(2);

try {
  switch (cmd) {
    case "decode": {
      if (!sig || rest.length !== 1) throw new Error("decode needs a signature and one calldata argument");
      const r = decodeCalldata(sig, rest[0]);
      console.log(`selector : ${r.selector} (${r.selectorMatch === "none" ? "no selector in input" : "selector " + r.selectorMatch})`);
      for (const p of r.params) console.log(`${p.type.padEnd(12)}: ${p.value}`);
      if (r.selectorMatch === "mismatch") process.exitCode = 2;
      break;
    }
    case "encode": {
      if (!sig) throw new Error("encode needs a signature");
      const r = encodeCalldata(sig, rest);
      console.log(`selector : ${r.selector}`);
      console.log(`params   : ${r.params}`);
      console.log(`calldata : ${r.calldata}`);
      break;
    }
    case "selector": {
      if (!sig || rest.length) throw new Error("selector takes exactly one signature argument");
      console.log(selector(sig));
      break;
    }
    default:
      process.stdout.write(USAGE);
      if (cmd !== undefined && cmd !== "--help" && cmd !== "-h") process.exitCode = 1;
  }
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exitCode = 1;
}
