var exec = require('child_process').exec;

var formatParams = function(params) {
    var retStr = '';
    for(var key in params) {
        //Handle params where everything is in the key
        if(key.length > 0 && params[key].length === 0)
            retStr += formatParams(JSON.parse(key));

        if(retStr.length > 0)
            retStr += '&';

        var formattedParam = encodeURIComponent(params[key]);

        retStr += (key + '=' + formattedParam);
    }

    return retStr.replace(/'/g, '\'\'');
};

PHPDriver   = function() {};

PHPDriver.prototype.onGet = function(file, params, callback) {
    this.execute(file, callback, params, {});
};

PHPDriver.prototype.onPost = function(file, params, callback) {
    this.execute(file, callback, {}, params);
};

PHPDriver.prototype.execute = function(file, callback, getParams, postParams) {
    var self             = this;
    var getParamsString  = formatParams(getParams);
    var postParamsString = formatParams(postParams);
    var cmd              = '';

    if(getParamsString.length > 0) {
        cmd  = 'export SIMPLE_SERVER_QUERY_STRING=\'' + getParamsString + '\';';
        cmd += 'php -e -r \'parse_str($_SERVER["SIMPLE_SERVER_QUERY_STRING"], $_GET); include "' + file + '";\'';
    }
    else if(postParamsString.length > 0) {
        cmd  = 'export SIMPLE_SERVER_QUERY_STRING=\'' + postParamsString + '\';';
        cmd += 'php -r \'parse_str($_SERVER["SIMPLE_SERVER_QUERY_STRING"], $_POST); include "' + file + '";\'';
    }
    else cmd = 'php ' + file;

    exec(cmd, function(error, stdout, stderr) {
        callback(self.getMimeType(), stdout);
        
        if(stderr)
            console.log(stderr);
    });
};

PHPDriver.prototype.getMimeType = function() {
    return 'text/html';
};

module.exports = new PHPDriver();