var exec = require('child_process').exec;

PHPCGI   = function() {}

PHPCGI.prototype.onGet = function(file, params, callback) {
    this.execute(file, callback, params, {});
};

PHPCGI.prototype.onPost = function(file, params, callback) {
    this.execute(file, callback, {}, params);
};

PHPCGI.prototype.execute = function(file, callback, getParams, postParams) {
    var cmd  = 'php ' + file;
    var self = this;
    exec(cmd, function(error, stdout, stderr) {
        callback(self.getMimeType(), stdout);
    });
};

PHPCGI.prototype.getMimeType = function() {
    return 'text/html';
};

module.exports = new PHPCGI();