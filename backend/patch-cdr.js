const fs = require('fs');
const path = require('path');

const filesToPatch = [
  path.resolve(__dirname, 'node_modules/@piplabs/cdr-crypto/dist/wasm/loader.js'),
  path.resolve(__dirname, 'node_modules/@piplabs/cdr-crypto/dist/wasm/cb-mpc-tdh2.js'),
];

console.log('Starting patch-cdr script...');

filesToPatch.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    console.log(`Patching ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');
    // Replace all occurrences of import.meta.url with ('file://' + __filename)
    const originalLength = content.length;
    content = content.replace(/import\.meta\.url/g, "('file://' + __filename)");
    if (content.length !== originalLength) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Successfully patched ${filePath}`);
    } else {
      console.log(`No import.meta.url found in ${filePath} (already patched?)`);
    }
  } else {
    console.log(`File not found: ${filePath}`);
  }
});
