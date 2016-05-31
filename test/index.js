'use strict';

// Load modules

const Code = require('code');
const Lab = require('lab');
const Catbox = require('catbox');
const Pg = require('pg');
const Client = require('../lib');



// Test shortcuts

const lab = exports.lab = Lab.script();

const describe = lab.experiment;
const it = lab.test;
const after = lab.after;
const before = lab.before;
const expect = Code.expect;

describe("Pg", function(){

    before(function(done){
        console.log("before");
        done();
    });

    after(function(done){
        console.log("after");
        done();
    });

    it('creates a new connection', function(done){

        const client = new Catbox.Client(Mongo);
        console.log("new connection");
        var n = 1+1;
        expect(n).to.equal(2);
        done();
    });
})