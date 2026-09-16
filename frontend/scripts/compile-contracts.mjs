import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONTRACTS_DIR = path.resolve(ROOT, '../Contracts');
const OUT_DIR = path.resolve(ROOT, 'src/contracts-artifacts');

const CONTRACT_FILES = ['ALGEBA.sol', 'Genesis.sol', 'Staking.sol', 'AGBOFTAdapter.sol', 'AGBOFT.sol'];

function findImport(importPath) {
  try {
    // Any non-relative import (bare or scoped, e.g. @openzeppelin/..., @layerzerolabs/...)
    // resolves from node_modules. solc resolves relative imports *within* those packages
    // (e.g. "./OFTCore.sol") against the importing file's own unit name, so this one rule
    // transparently handles arbitrarily nested package imports too.
    if (!importPath.startsWith('.')) {
      const resolved = path.resolve(ROOT, 'node_modules', importPath);
      return { contents: fs.readFileSync(resolved, 'utf8') };
    }
    const resolved = path.resolve(CONTRACTS_DIR, importPath);
    return { contents: fs.readFileSync(resolved, 'utf8') };
  } catch (err) {
    return { error: `File not found: ${importPath}` };
  }
}

const sources = {};
for (const file of CONTRACT_FILES) {
  sources[file] = { content: fs.readFileSync(path.join(CONTRACTS_DIR, file), 'utf8') };
}

const input = {
  language: 'Solidity',
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: {
      '*': {
        '*': ['abi', 'evm.bytecode.object'],
      },
    },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImport }));

let hasError = false;
if (output.errors) {
  for (const err of output.errors) {
    if (err.severity === 'error') {
      hasError = true;
      console.error(err.formattedMessage);
    } else {
      console.warn(err.formattedMessage);
    }
  }
}
if (hasError) {
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const file of CONTRACT_FILES) {
  const contractName = file.replace('.sol', '');
  const compiled = output.contracts[file]?.[contractName];
  if (!compiled) {
    console.error(`No compiled output for ${contractName}`);
    process.exit(1);
  }
  const artifact = {
    contractName,
    abi: compiled.abi,
    bytecode: '0x' + compiled.evm.bytecode.object,
  };
  fs.writeFileSync(
    path.join(OUT_DIR, `${contractName}.json`),
    JSON.stringify(artifact, null, 2)
  );
  console.log(`Wrote ${contractName}.json (bytecode ${artifact.bytecode.length / 2 - 1} bytes)`);
}
