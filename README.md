# evm-calldata-decoder

Decode and encode EVM transaction calldata from human-readable function signatures.
A small, dependency-light library + CLI extracted from the free browser-based
[ABI Decoder tool on SolveBar](https://solvebar.com/tools/abi-decoder).

- **Decode** raw calldata against a signature — with automatic 4-byte selector
  detection and match/mismatch verification
- **Encode** a function call from string parameter values
- **Selector** computation for any signature (keccak256, first 4 bytes)
- Depth-aware signature parsing, so tuple types with nested commas —
  `swap((address,uint256)[],bool)` — parse correctly
- Arrays and tuples supported on both decode and encode paths

Uses [ethers](https://github.com/ethers-io/ethers.js) v6 for the ABI coder and keccak256.

## Why

Before signing a transaction, the only ground truth about what it does is its
calldata. Block explorers decode it for verified contracts, but for unverified
contracts, raw mempool data, or local debugging you need to decode it yourself.
This does that in one command. If you'd rather not install anything, the same
logic runs entirely client-side in the browser at
[solvebar.com/tools/abi-decoder](https://solvebar.com/tools/abi-decoder), and the
concepts are written up in
[the ABI encoding guide](https://solvebar.com/blog/abi-decoder-encoder-guide-selector-calldata).

## Install

```bash
git clone https://github.com/theshakeel/evm-calldata-decoder.git
cd evm-calldata-decoder
npm install
npm link   # optional: makes the `calldata` command available globally
```

## CLI

### Decode

```bash
calldata decode "transfer(address,uint256)" \
  0xa9059cbb000000000000000000000000ab5801a7d398351b8be11c439e05c5b3259aec9b0000000000000000000000000000000000000000000000000de0b6b3a7640000
```

```
selector : 0xa9059cbb (selector match)
address     : 0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B
uint256     : 1000000000000000000
```

Calldata is accepted with or without the 4-byte selector prefix. When a selector
is present, it is checked against the one computed from your signature — a
mismatch is reported (and sets exit code 2), which catches the classic mistake
of decoding data against the wrong function.

### Encode

```bash
calldata encode "transfer(address,uint256)" \
  0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B 1000000000000000000
```

```
selector : 0xa9059cbb
params   : 0x000000000000000000000000ab5801a7d398351b8be11c439e05c5b3259aec9b0000000000000000000000000000000000000000000000000de0b6b3a7640000
calldata : 0xa9059cbb000000000000000000000000ab5801a7d398351b8be11c439e05c5b3259aec9b0000000000000000000000000000000000000000000000000de0b6b3a7640000
```

Array parameters are passed comma-separated (`0xabc...,0xdef...`); tuple
parameters as JSON array literals (`'["0xabc...","100"]'`).

### Selector

```bash
calldata selector "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)"
# 0x38ed1739
```

## Library

```js
import { decodeCalldata, encodeCalldata, selector } from "evm-calldata-decoder";

const { selector: sel, selectorMatch, params } = decodeCalldata(
  "transfer(address,uint256)",
  "0xa9059cbb00000000000000000000000..."
);
// params → [{ type: "address", value: "0xAb58..." }, { type: "uint256", value: "1000000000000000000" }]

const { calldata } = encodeCalldata("approve(address,uint256)", [
  "0xDef1C0ded9bec7F1a1670819833240f027b25EfF",
  "1000000000000000000",
]);

selector("transfer(address,uint256)"); // "0xa9059cbb"
```

## License

[MIT](LICENSE)
