var exec = require('child_process').exec;

var formatParams = function(params) {
    var retStr = '';
    for(var key in params) {
        if(retStr.length > 0)
            retStr += '&';

        retStr += (key + '=' + params[key]);
    }

    return retStr;
};

PHPCGI   = function() {}

PHPCGI.prototype.onGet = function(file, params, callback) {
    this.execute(file, callback, params, {});
};

PHPCGI.prototype.onPost = function(file, params, callback) {
    this.execute(file, callback, {}, params);
};

PHPCGI.prototype.execute = function(file, callback, getParams, postParams) {
    var self             = this;
    var getParamsString  = formatParams(getParams);
    var postParamsString = formatParams(postParams);
    var cmd              = '';

    if(getParamsString.length > 0) {
        cmd  = 'export SIMPLE_SERVER_QUERY_STRING="' + getParamsString + '";';
        cmd += 'php -e -r \'parse_str($_SERVER["SIMPLE_SERVER_QUERY_STRING"], $_GET); include "' + file + '";\'';
    }
    else if(postParamsString.length > 0) {
        cmd  = 'export SIMPLE_SERVER_QUERY_STRING="' + postParamsString + '";';
        cmd += 'php -r \'parse_str($_SERVER["SIMPLE_SERVER_QUERY_STRING"], $_POST); include "' + file + '";\'';
    }
    else cmd = 'php ' + file;

    exec(cmd, function(error, stdout, stderr) {
        callback(self.getMimeType(), stdout);
    });
};

PHPCGI.prototype.getMimeType = function() {
    return 'text/html';
};

module.exports = new PHPCGI();