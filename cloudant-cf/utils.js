var cfEnv = require("cfenv");

var utils = {};

// remove invalid characters from the database name
// https://wiki.apache.org/couchdb/HTTP_database_API#Naming_and_Addressing
utils.cleanDatabaseName = function(database, node) {
    var newDatabase = database;

    // caps are not allowed
    newDatabase = newDatabase.toLowerCase();
    // remove trailing underscore
    newDatabase = newDatabase.replace(/^_/, '');
    // remove spaces and slashed
    newDatabase = newDatabase.replace(/[\s\\/]+/g, '-');

    if (newDatabase !== database) {
        node.warn("Database renamed  as '" + newDatabase + "'.");
    }

    return newDatabase;
};


// fix field values that start with _
// https://wiki.apache.org/couchdb/HTTP_Document_API#Special_Fields
utils.cleanMessage = function(msg) {

    // valid keys can't start with _ except for the reserved keys
    var isFieldNameValid = function(key) {
        var allowedWords = [
            '_id', '_rev', '_attachments', '_deleted', '_revisions',
            '_revs_info', '_conflicts', '_deleted_conflicts', '_local_seq'
        ];
        return key[0] !== '_' || allowedWords.indexOf(key) >= 0;
    };

    for (var key in msg) {
        if (!isFieldNameValid(key)) {
            // remove _ from the start of the field name
            var newKey = key.substring(1, msg.length);
            msg[newKey] = msg[key];
            delete msg[key];
            node.warn("Property '" + key + "' renamed to '" + newKey + "'.");
        }
    }

    return msg;
};

// find and return document _id value from msg
utils.getDocumentId = function(msg, node) {
    return utils.getProperty('_id', msg, node) ||
            utils.getProperty('id', msg, node) ||
            msg.payload;
};

utils.getProperty = function(prop, msg, node) {
    if (node && prop !== 'id') {
        if (node.hasOwnProperty(prop)) {
            if (node[prop]) {
                return node[prop];
            }
        }
    }

    if (typeof msg === 'object') {
        if (prop in msg) {
            return msg[prop];
        }

        if ('payload' in msg) {
            if (typeof msg.payload === 'object' && prop in msg.payload) {
                return msg.payload[prop];
            }
        }
    }

    return null;
}


// must return an object with, at least, values for account, username and
// password for the Cloudant service at the top-level of the object
utils.getCloudantConfig = function(RED, config) {
    if (config.service === "_ext_") {
        return RED.nodes.getNode(config.cloudant);
    }

    if (config.service !== "") {
        var appEnv = cfEnv.getAppEnv();
        var service = appEnv.getService(config.service);

        var host = service.credentials.host;

        return {
            username: service.credentials.username,
            password: service.credentials.password,
            account: host.substring(0, host.indexOf('.'))
        };
    }
};

module.exports = utils;
