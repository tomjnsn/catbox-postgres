var Fs = require("fs");
var Catbox = require("catbox");
var CatboxPostgres = require("../lib");
//var CatboxPostgres = require("catbox-memory");

var internals = {};

internals.startCache = function (callback) {

    var credentials = JSON.parse(Fs.readFileSync(__dirname + "/credentials.json", "utf8"));

    var clientOptions = {
        partition: 'catbox',  // name of the database (should be already available)
        user: credentials.user,
        password: credentials.password
    };

    var policyOptions = {
        expiresIn: 5000,
    };

    var segment = "my-segment";  // name of the table

    var key = {
        id: "my-id",
        segment: segment
    };

    var value = {
        firstName: "pauloqqq",
        lastName: "vieiray",
        age: 33
    };

    var ttl = 1000;

    var client = new Catbox.Client(CatboxPostgres, clientOptions);

    console.log("client.isReady(): ", client.isReady())

    client.start(function(err){

        var i = 0;
        if(err){
            throw err;
        }

        // TODO: ? we should be using the policy to set the value?
        setTimeout(function(){

            client.set(key, value, ttl, function(err){

                if(err){
                    throw err;
                }

                console.log("value was set")
            });

        }, 1000);

        setTimeout(function(){

            value.firstName = "ana";
            client.set(key, value, 4*ttl, function(err){

                if(err){
                    throw err;
                }

                console.log("value was set again")
            });

        }, 3000);

        setTimeout(function(){

            client.drop(key, function(err){

                if(err){
                    throw err;
                }

                console.log("value was dropped")
            });

        }, 3600);

        setInterval(function(){

            client.get(key, function(err, result){

                i++;
                if(err){
                    throw err;
                }

                console.log("i=" + i + "; result:\n", result);
                console.log("")
            });


        }, 240);


        internals.policy = new Catbox.Policy(policyOptions, client, segment);



/*
        internals.policy.set('my-key', value, ttl, function(err){

            if(err){
                throw err;
            }
        });

        setTimeout(function(){

            debugger;
            internals.policy.get('my-key', function(err, item){

                if(err){
                    throw err;
                }

                console.log(item);
            })

        }, 1);
*/

    });

};

internals.startCache();

