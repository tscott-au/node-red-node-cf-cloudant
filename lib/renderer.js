var fs = require('fs');
var mustache = require('mustache');

var Renderer = {
    loadPartials: function(dir) {
        var partials = {};

        var files = fs.readdirSync(dir);
        for (var i in files) {
            var file = files[i];
            partials[file] = fs.readFileSync(dir + '/' + file, {
                encoding: 'utf8'
            });
        }

        return partials;
    },

    render: function(options) {
        var template = fs.readFileSync(options.templateFile, { encoding: 'utf8' });
        var partials = Renderer.loadPartials(options.partialsDir);
        var rendered = mustache.render(template, options.data, partials);

        fs.writeFileSync(options.destFile, rendered);

        console.log('Template %s rendered.', options.templateFile);
    },

    watch: function(options) {
        function fileChanged() {
            Renderer.render(options);
        }

        fs.watch(options.partialsDir, fileChanged);
        fs.watch(options.templateFile, fileChanged);

        console.log('Watching for file changes...');
    }
};

module.exports = Renderer;
