var config = {
        "name":{
                "host":"localhost",
                "baseDirectory":"/path/to/dir",
                "allowedFileTypes":["js","css","html"],
                "onPost":function(params, file) {
                        //post stuff here
                }
        }
}

module.exports = config;