var Cloudant = require('cloudant');
var debug = require('debug')('node-red:cloudant:attachments');
var utils = require('../utils');

module.exports = function(RED) {
    'use strict';

    return function(config) {
        RED.nodes.createNode(this, config);

        this.cloudantConfig = utils.getCloudantConfig(RED, config);
        this.database = config.database;
        this.docId = config.docid;
        this.attachmentName = config.attachmentname;
        this.encoding = config.encoding;

        var node = this;
        var credentials = {
            account: node.cloudantConfig.account,
            key: node.cloudantConfig.username,
            password: node.cloudantConfig.password,
            url: node.cloudantConfig.url
        };

        Cloudant(credentials, function(err, cloudant) {
            if (err) {
                node.error(err.description);
                return;
            }

            node.on('input', function(msg) {
                var db = cloudant.use(node.database);
                handleMessage(this, db, msg);
            });
        });
    }
};

function handleMessage(node, db, msg) {
    var attachmentName = utils.getProperty('attachmentName', msg, node);
    var id = node.docId || utils.getDocumentId(msg, node);

    db.get(id, function(err, doc) {
        if (err) {
            node.erro('Failed to retrieve document "' + id + '": ' + err.description);
            node.send(msg);
            return;
        }

        if (attachmentName) {
            getAttachment(db, doc, attachmentName, function(err, resp) {
                if (err) {
                    node.error('Failed to retrieve attachment "' + attachmentName + '" from "' + id + '": ' + err.description);
                    node.send(msg);
                    return;
                }

                msg.payload = encodeAttachment(resp.body, node.encoding);
                msg.attachment = resp.attachment;

                node.send(msg);
            });
        } else {
            getAllAttachments(db, doc, function(err, attachments) {
                if (err) {
                    node.error('Failed to retrieve attachments from "' + id + '": ' + err.description);
                    node.send(msg);
                    return;
                }

                Object.keys(attachments).map(function(attch) {
                    var data = attachments[attch].data
                    attachments[attch].data = encodeAttachment(data, node.encoding);
                });

                msg.payload = attachments;
                node.send(msg);
            });
        }
    });
}

function getAttachment(db, doc, attachmentName, callback) {
    var attachment = doc._attachments[attachmentName];

    db.attachment.get(doc._id, attachmentName, function(err, body) {
        if (err) {
            callbackWrapper(callback, err);
            return;
        }

        callbackWrapper(callback, null, {
            attachment: attachment,
            body: body
        });
    });
}

function getAllAttachments(db, doc, callback) {
    var attachments = doc._attachments;
    var counter = 0;

    // sync all calls for retrieving attachments
    function done() {
        counter++;
        if (counter === Object.keys(attachments).length) {
            callbackWrapper(callback, null, attachments);
        }
    }

    Object.keys(attachments).forEach(function(attchName) {
        db.attachment.get(doc._id, attchName, function(err, body) {
            if (err) {
                callbackWrapper(callback, err);
                return;
            }

            attachments[attchName].data = body;
            done();
        });
    });
}

function encodeAttachment(attachment, encoding) {
    return (encoding === 'none') ? attachment : attachment.toString(encoding);
}

function callbackWrapper(callback, err, resp) {
    if (callback) {
        process.nextTick(function() {
            callback(err, resp);
        });
    }
}
