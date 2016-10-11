var url = require('url');

var CLOUDANT_ACCOUNT = /([a-z][a-z0-9]*)\.cloudant\.com/i;

module.exports = function(RED) {
    return function(config) {
        RED.nodes.createNode(this, config);

        this.name = config.name;
        this.host = config.host;
        this.url = config.host;

        // remove unnecessary parts from host value
        var parsedUrl = url.parse(this.host);
        if (parsedUrl.host) {
            this.host = parsedUrl.host;
        }

        // extract Cloudant account from hostname
        var matches = this.host.match(CLOUDANT_ACCOUNT);
        if (matches) {
            this.account = matches[1];
            delete this.url;
        }

        // store credentials as node property
        var credentials = this.credentials;
        if (credentials) {
            if (credentials.hasOwnProperty("username")) {
                this.username = credentials.username;
            }

            if (credentials.hasOwnProperty("pass")) {
                this.password = credentials.pass;
            }
        }
    };
};
