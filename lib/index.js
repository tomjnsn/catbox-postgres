'use strict';

var Pg = require('pg');
var Hoek = require('hoek');
var Sql = require('./sql-templates.js');

const internals = {};

internals.defaults = {
    host: 'localhost',
    port: 5432,    
};

// TODO: handle options: json/jsonb, unlogged, 
// TODO: make sure we have a separate pool, to assure out clients are not used
// by other parts of the application
exports = module.exports = internals.Connection = function PostgresCache(options) {

    Hoek.assert(this.constructor === internals.Connection, 'Postgres cache client must be instantiated using new');

    this.settings = Hoek.applyToDefaults(internals.defaults, options || {});
    this.tableIsReady = false;
    this.clientPoolIsReady = false;

    // show all output from client (time to complete the operation, etc)
    this.verbose = true;

    internals.connectionConfig = {
        host: this.settings.host,
        port: this.settings.port,
        database: this.settings.partition,
        user: this.settings.user,
        password: this.settings.password
    };

};

internals.Connection.prototype.start = function (callback) {

    var that = this;

    // creates a pool of clients when called for the first time
    // create a dedicated pool, such that we can reuse the pg module in other parts
    // of the app without interfering with each other
    Pg.connect(internals.connectionConfig, function(err, pgClient, done) {

        if (err) {
            return callback(err);
        }
        
        // verify if the pg version is compatible (>= 9.5)
        pgClient.query('SHOW server_version;', function(err, result) {
            
            if (err) {
                return callback(err);
            }

            var version = result.rows[0]['server_version'].split('.');
            if (that.verbose) {
                console.log("postgres version: " + version.join("."));
            }

            if(Number(version[0]) < 9){
                return callback(new Error('catbox-postgres works only with postgres 9.5 or higher'))    
            }

            if(Number(version[0]) === 9 && Number(version[1]) < 5){
                return callback(new Error('catbox-postgres works only with postgres 9.5 or higher'))    
            }

            that.clientPoolIsReady = !!Object.keys(Pg.pools.all).length;
            done();

            return callback(null);
        });
        
    });
    
    
};

internals.Connection.prototype.isReady = function () {

    return this.clientPoolIsReady && this.tableIsReady;
};

internals.Connection.prototype.stop = function () {

    // todo: what if we are using the pg modules in other parts of the application?
    // we should close only all the client from our pool
    console.log("stop() - to be done");
    //Pg.end();
};

// called once (in the policy constructor); this is where we create the table,
// if it doesn't exists
internals.Connection.prototype.validateSegmentName = function (name) {

    if (!name) {
        return new Error('Empty string');
    }

    if (name.indexOf('\u0000') !== -1) {
        return new Error('Includes null character');
    }

    if (name.length > 63) {
        return new Error('Postgres identifiers must be less than 64 characters');
    }

    if (!/[a-zA-Z_]/.test(name.charAt(0))) {
        return new Error('Postgres identifiers must begin with a letter or an underscore');
    }

    // TODO: check other limitations of postgres identifiers 
    // https://www.postgresql.org/docs/current/static/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS

    //internals.Connection.prototype.createTable.call(this, name);
    internals.createTable.call(this, name);
//    console.log(this)
//    process.exit()
    debugger;
    return null;
};



/*
Postgres doesn't have an "expire" statement like redis or other databases;
so we check if the value is stale inside the "get" method, just after it is
retrieved from the database; if it is stalled we call an auxiliary
postgres function to delete it; this function takes care creating a row lock
before the "delete" statement, to avoid rece conditions

select from ...
if Date.now() - stored > ttl
    select * from begin transaction; select for update; delete from ... end transaction;

TODO: how to avoid sql injection?
*/
internals.Connection.prototype.get = function (key, callback) {

    Pg.connect(internals.connectionConfig, function(err, pgClient, done) {

        if (err) {
            return callback(err);
        }

        // TODO: use json stringify from pg-promise for 
        var selectQuery = Sql.select(key.segment, key.id);
        pgClient.query(selectQuery, function(err, result) {

            if (err || result.rows.length===0) {
                done();
                return callback(err || null, null);
            }

            // result.rows.length is either 0 or 1
            var row = result.rows[0];
            ///console.log("row:\n", row);

            row.stored = parseInt(row.stored, 10);
            row.ttl = parseInt(row.ttl, 10);

            ///console.log("globalStored: ", globalStored);
            ///console.log("row.stored: ", row.stored);

            ///console.log("x: ", Date.now() - row.stored);
            if(Date.now() - row.stored > row.ttl){
                console.log("use this postgres client to delete the row; call done only after the delete")
                // TODO: we should also have a timer with setInterval to peiodically delete
                // stalled items
                done();
                return callback(null, null);
            }

            done();
            return callback(null, row);
        });
    });

};

///var globalStored = 0;
internals.Connection.prototype.set = function (key, value, ttl, callback) {

    Pg.connect(internals.connectionConfig, function(err, pgClient, done) {

        if (err) {
            return callback(err);
        }

        // TODO: use json stringify from pg-promise for the value (to handle issues with quotations, etc)

        var stored = Date.now();
        ///console.log("stored @ set: ", stored);
        ///globalStored = stored;
        var upsertQuery = Sql.upsert(key.segment, key.id, value, stored, ttl);

        pgClient.query(upsertQuery, function(err, result) {
debugger;
            if (err) {
                return callback(err);
            }

            if(result.rows.length!==1){
                return callback(new Error('value was not inserted'));
            }

            done();
            // TODO: in the other catbox clients (redis, mongo, etc) - 
            // this callback should always be called
            return callback();
        });
    });
    
};

internals.Connection.prototype.drop = function (key, callback) {

    Pg.connect(internals.connectionConfig, function(err, pgClient, done) {

        if (err) {
            return callback(err);
        }

        var deleteQuery = Sql._delete(key.segment, key.id);
        pgClient.query(deleteQuery, function(err) {

            if (err) {
                return callback(err);
            }

            done();
            return callback(null);
        });
    });
};

internals.pgErrorCodes = {
    '42P07': ' (relation already exists, skipping)'
};

internals.addListener = function(pgClient){

    if (this.verbose && pgClient.listenerCount('notice') === 0) {

        ///console.log("addListener @ " + Date.now())
        pgClient.on('notice', function(obj) {

            var description = internals.pgErrorCodes[obj.code];
            var output = 'NOTICE: error code ' + obj.code + (description || '');

            console.log(output);
        });

    }
};


internals.createTable = function(tableName){
//internals.Connection.prototype.createTable = function(tableName){

    var that = this;

    // the next call to Pg.connect is actually syncronous because the pool has 1 client available
    Pg.connect(internals.connectionConfig, function(err, pgClient, done) {
        
        if (err) {
            throw err;
        }


        // TODO: use UNLOGGED as an option
        var createTableQuery = Sql.createTable(tableName);

        internals.addListener.call(that, pgClient);

        pgClient.query(createTableQuery, function(err, result) {
            
            if (err) {
                throw err;
            }

            done();

            // calls to .get/.set/.drop can only be made after we have 
            // tableIsReady === true

            that.tableIsReady = true;
        });
    });

};