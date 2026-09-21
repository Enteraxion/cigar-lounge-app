// One-off: parses the kiosk app's real Product.kt into a static JSON
// snapshot for the owner-portal's Staff Picks picker. The kiosk app itself
// stays the source of truth (it resolves picks by sku from Product.kt
// directly) — this file just lets the web owner-portal show the same real
// product list to pick from, without duplicating name/price into Firestore.
// Regenerate this if Product.kt's catalog changes.
import { readFileSync, writeFileSync } from 'fs';

const SRC = 'C:\\Users\\abhil\\LoungeLocator\\app\\src\\main\\java\\com\\loungelocator\\kiosk\\data\\Product.kt';
const OUT = 'owner-portal/src/data/kioskCatalog.json';

function unescapeKotlinString(s) {
  return s.replace(/\\(.)/g, '$1');
}

function parseProducts(source) {
  const products = [];
  for (const line of source.split('\n')) {
    const m = line.match(/Product\(sku = "([^"]*)", name = "((?:[^"\\]|\\.)*)", category = "([^"]*)", price = (null|[\d.]+)/);
    if (!m) continue;
    const [, sku, rawName, category, rawPrice] = m;
    if (rawPrice === 'null') continue;
    products.push({
      sku,
      name: unescapeKotlinString(rawName),
      category,
      price: parseFloat(rawPrice),
    });
  }
  return products;
}

const src = readFileSync(SRC, 'utf8');
const products = parseProducts(src).sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(OUT, JSON.stringify(products, null, 2) + '\n');
console.log('Wrote', products.length, 'products to', OUT);
console.log(JSON.stringify(products.slice(0, 3), null, 2));
