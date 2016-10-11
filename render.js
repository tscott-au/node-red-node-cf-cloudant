'use strict';

var Renderer = require('./lib/renderer');

var options = {
    templateFile: './cloudant-cf/templates/77-cloudant-cf.mustache',
    destFile: './cloudant-cf/77-cloudant-cf.html',
    partialsDir: './cloudant-cf/partials',
    data: {}
};

if (process.argv.length === 3 && process.argv[2] === '--watch') {
    Renderer.watch(options);
}

Renderer.render(options);
