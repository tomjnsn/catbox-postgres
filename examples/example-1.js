var Fs = require("fs");
var Catbox = require("catbox");
var CatboxPostgres = require("../lib");

var credentials = JSON.parse(Fs.readFileSync(__dirname + "/credentials.json", "utf8"));

var startCache = function (partition, segment) {

    var clientOptions = {
        partition: partition,  // name of the database (should be already available)
        user: credentials.user,
        password: credentials.password,

        //verbose: false
        dataType: 'json',
        unlogged: true
    };

    var policyOptions = {
        expiresIn: 5000,
    };

    var client = new Catbox.Client(CatboxPostgres, clientOptions);
    client.start(function(err){

        if(err){
            throw err;
        }

        var policy = new Catbox.Policy(policyOptions, client, segment);
        var i = 0;

        setTimeout(function(){

            var id = 'my-id';
            var value = {
                firstName: "paulo''qqq",
                lastName: "vieira @ " + Date.now(),
                age: 33
            };
            var ttl = 1500;

            policy.set(id, value, ttl, function(err){

                if(err){
                    throw err;
                }

                console.log("       value was set");
            });

        }, 1000);

        setInterval(function(){

            policy.get('my-id', function(err, value, cached, report){

                if(err){
                    console.log("ERROR: " + err.message);
                    return;
                }

                console.log("i=" + i + "; cached:\n", cached);
                console.log("")
                i++
            });

        }, 245);

    });

};

startCache('catbox', 'my-segment-x2');

