// Synthetic popup screenshot page. No user data or live account access.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
let html = readFileSync('popup.html', 'utf8');
html = html.replace('<link rel="stylesheet" href="popup.css">', `<style>${readFileSync('popup.css', 'utf8')} body { width:380px; } </style>`);
html = html.replace('<script src="core.js"></script><script src="popup.js"></script>', `<script>globalThis.chrome={storage:{local:{get:async()=>({}),set:async()=>{}}}};</script><script>${readFileSync('core.js', 'utf8')}</script><script>${readFileSync('popup.js', 'utf8')}</script>`);
writeFileSync('dist/popup-preview.html', html);
