var exec  = require('child_process').exec;

PythonCGI = function() {}

PythonCGI.prototype.onGet = function(file, params, callback) {
    this.execute(file, callback, params, {});
};

PythonCGI.prototype.onPost = function(file, params, callback) {
    this.execute(file, callback, {}, params);
};

PythonCGI.prototype.execute = function(file, callback, getParams, postParams) {
    var cmd  = 'python ' + file;
    var self = this;
    exec(cmd, function(error, stdout, stderr) {
        callback(self.getMimeType(), stdout);
    });
};

PythonCGI.prototype.getMimeType = function() {
    return 'text/html';
};

module.exports = new PythonCGI();