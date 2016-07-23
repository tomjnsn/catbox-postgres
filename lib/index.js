
'use strict';

var Pg = require('pg');
var Hoek = require('hoek');
var Sql = require('./sql-templates.js');


const internals = {};

internals.bigintOid = 20;
internals.defaults = {
    host: 'localhost',
    port: 5432,

    verbose: false,
    dataType: 'jsonb'
};

Pg.types.setTypeParser(internals.bigintOid, function(n) {

    return parseInt(n, 10);
});

exports = module.exports = internals.Connection = function PostgresCache(options) {

    Hoek.assert(this.constructor === internals.Connection, 'Postgres cache client must be instantiated using new');

    this.settings = Hoek.applyToDefaults(internals.defaults, options || {});
    this.settings.verbose  = !!this.settings.verbose;
    this.settings.unlogged = !!this.settings.unlogged;

    Hoek.assert(this.settings.dataType === 'json' || this.settings.dataType === 'jsonb', 'dataType must be either "json" or "jsonb"');

    this._tableIsReady = false;
    this._clientPoolIsReady = false;

    internals.connectionConfig = {
        host:     this.settings.host,
        port:     this.settings.port,
        database: this.settings.partition,
        user:     this.settings.user,
        password: this.settings.password
    };

};

internals.Connection.prototype.start = function (callback) {

    var that = this;

    // creates a pool of clients when called for the first time
    // TODO: (?) create a dedicated pool, such that we can reuse the pg module in other parts
    // of the app without interfering with each other
    Pg.connect(internals.connectionConfig, function(err, pgClient, done) {

        if (err) {
            return callback(err);
        }

        if (that.settings.verbose){
            internals.addListener.call(that, pgClient);
        }

        // verify if the pg version is compatible (>= 9.5)
        pgClient.query('SHOW server_version;', function(err, result) {

            if (err) {
                return callback(err);
            }

            var version = result.rows[0]['server_version'];
            pgClient.emit('notice', 'postgres version: ' + version)

            var a = version.split('.');
            if(Number(a[0]) < 9){
                return callback(new Error('catbox-postgres requires postgres 9.5 or higher'))
            }

            if(Number(a[0]) === 9 && Number(a[1]) < 5){
                return callback(new Error('catbox-postgres requires postgres 9.5 or higher'))
            }

            // make sure the pool has been created
            var key = JSON.stringify(internals.connectionConfig);
            that._clientPoolIsReady = !!Pg.pools.all[key];

            done();

            return callback(null);
        });

    });


};

internals.Connection.prototype.isReady = function () {

    return this._clientPoolIsReady && this._tableIsReady;
};

internals.Connection.prototype.stop = function () {

    // todo: what if we are sharing the pg module with other parts of the application?
    // we should close only all the client from our pool
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
        return new Error('Postgres identifiers must be less than 64 characters (segment is the name of the table)');
    }

    if (!/[a-zA-Z_]/.test(name.charAt(0))) {
        return new Error('Postgres identifiers must begin with a letter or an underscore (segment is the name of the table)');
    }

    // is there any other significant limitations of postgres identifiers that
    // should be handled here?
    // https://www.postgresql.org/docs/current/static/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS


    // we should take into account theses cases as well:
    // "The default value for segment when server.cache is called inside of a plugin will be '!pluginName'. When creating server methods, the segment value will be '#methodName'.

    internals.createTable.call(this, name);

    return null;
};



/*
Postgres doesn't have an "expire" statement like redis or other databases;
so we check if the value is stale in the "get" method, just after it is
retrieved from the database; if so we call an auxiliary postgres function
which will call the sql command delete on that row;

to avoid race conditions this function will
-create a row lock
-check if the value is actually stalled
-actually delete

select from ...
if Date.now() - stored > ttl
    select * from begin transaction; select for update; delete from ... end transaction;

In addition to this, we must have a query that is executed periodically
to delete values that have become stalled meanwhile

TODO: how to avoid sql injection?
*/
internals.Connection.prototype.get = function (key, callback) {

    var that = this;
    Pg.connect(internals.connectionConfig, function(err, pgClient, done) {

        if (err) {
            return callback(err);
        }

        if (that.settings.verbose){
            internals.addListener.call(that, pgClient);
        }

        // TODO: use json stringify from pg-promise for
        var selectQuery = Sql.select(key.segment, key.id);

        pgClient.query(selectQuery, function(err, result) {

            if (err || result.rows.length===0) {
                done();
                return callback(err || null, null);
            }

            // result.rows.length must be 1
            var row = result.rows[0];
            if(Date.now() - row.stored <= row.ttl){
                done();
                return callback(null, row);
            }

            // TODO: we should also have a timer with setInterval to peiodically delete
            // stalled items
            var deleteQuery = Sql.deleteCautiously(key.segment, key.id, row.stored);

            pgClient.query(deleteQuery, function(err) {

                done();
            });

            return callback(null, null);
        });
    });

};


internals.Connection.prototype.set = function (key, value, ttl, callback) {

    var that = this;
    Pg.connect(internals.connectionConfig, function(err, pgClient, done) {

        if (err) {
            return callback(err);
        }

        if (that.settings.verbose){
            internals.addListener.call(that, pgClient);
        }

        // TODO: use json stringify from pg-promise for the value (to handle issues with quotations, etc)

        var stored = Date.now();
        var jsonValue = JSON.stringify(value).replace(/'/g, "''");
        var upsertQuery = Sql.upsert(key.segment, key.id, jsonValue, stored, ttl);

        pgClient.query(upsertQuery, function(err, result) {

            if (err) {
                return callback(err);
            }

            if(result.rows.length!==1){
                return callback(new Error('value was not set'));
            }

            done();
            // TODO: in the other catbox clients (redis, mongo, etc) -
            // this callback should always be called
            return callback();
        });
    });

};


// note: catbox's method "drop" is competely different from postgres' command "drop"
internals.Connection.prototype.drop = function (key, callback) {

    var that = this;
    Pg.connect(internals.connectionConfig, function(err, pgClient, done) {

        if (err) {
            return callback(err);
        }

        if (that.settings.verbose){
            internals.addListener.call(that, pgClient);
        }

        var deleteQuery = Sql['delete'](key.segment, key.id);

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

    if (pgClient.listenerCount('notice') === 0) {

        pgClient.on('notice', function(obj) {

            var output = '';
            if(typeof obj === 'object' && obj.code){
                var description = internals.pgErrorCodes[obj.code];
                output = 'NOTICE: error code ' + obj.code + (description || '');
            }
            else if(typeof obj === 'string'){
                output = obj;
            }
            else{
                output = JSON.stringify(obj);
            }

        });

    }
};


internals.createTable = function(tableName){

    var that = this;

    // the next call to Pg.connect is almost surely syncronous because the pool
    // should have 1 client available when the method is called
    Pg.connect(internals.connectionConfig, function(err, pgClient, done) {

        if (err) {
            throw err;
        }

        if (that.settings.verbose){
            internals.addListener.call(that, pgClient);
        }

        var createTableQuery = Sql.createTable(tableName, that.settings.dataType, that.settings.unlogged);

        pgClient.query(createTableQuery, function(err, result) {

            if (err) {
                throw err;
            }

            done();

            // calls to .get/.set/.drop can only be made after we have
            // _tableIsReady === true

            that._tableIsReady = true;
        });
    });

};
