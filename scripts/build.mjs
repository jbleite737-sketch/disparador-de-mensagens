import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('extension/vendor',{recursive:true});
await copyFile('node_modules/exceljs/dist/exceljs.min.js','extension/vendor/exceljs.min.js');
await copyFile('node_modules/exceljs/LICENSE','extension/vendor/EXCELJS-LICENSE.txt');
console.log('Extensão pronta em extension/ (ExcelJS local, sem CDN).');
