var asana = require('asana');

var asanaClient = function() {
    var accessToken = process.argv[2];
    console.log("Loading Asana API with access token", accessToken)
    return asana.Client.create().useAccessToken(accessToken);
};

var main = function() {
    var client = asanaClient();

    // Test TODO do something useful
    client.users.me().then(function(me) {
        console.log(me);
    });
};

main();