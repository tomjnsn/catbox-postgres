module.exports.createTable = function createTable(tableName, dataType, unlogged){

    // todo - test these constraints
    var maxSafeInteger = Number.MAX_SAFE_INTEGER;
    var sql = `

CREATE ${ unlogged ? 'UNLOGGED': '' } TABLE IF NOT EXISTS "${ tableName }" (
    id     text           PRIMARY KEY,
    item   ${ dataType }  NOT NULL,
    stored bigint         NOT NULL, 
    ttl    bigint         NOT NULL, 

    CONSTRAINT id_must_be_non_empty CHECK 
        (id <> ''),

    CONSTRAINT stored_must_be_within_range CHECK 
        (stored > 0 AND stored <= ${ maxSafeInteger }),

    CONSTRAINT ttl_must_be_within_range CHECK 
        (ttl > 0 AND ttl <= ${ maxSafeInteger })

);

    `;
    /*
    var sqlx = `

CREATE TABLE IF NOT EXISTS "${ tableName }" (
    id     text   PRIMARY KEY,
    item   ${ dataType }  NOT NULL,
    stored bigint NOT NULL, 
    ttl    bigint NOT NULL, 

    CONSTRAINT id_must_be_non_empty CHECK 
        (id <> '')

);

    `;
*/

    // postgres: max. value supported by 'bigint': 9223372036854775807
    // js:       max. value supported by 'number': 9007199254740991 
    // (available via Number.MAX_SAFE_INTEGER === 2^253 - 1)

    return sql;
};

module.exports.upsert = function upsert(tableName, id, item, stored, ttl){

    var sql = `

INSERT INTO "${ tableName }" (
    id, 
    item, 
    stored, 
    ttl
)
VALUES (
    '${ id }', 
    '${ item }',
    '${ stored }',
    '${ ttl }'
)
ON CONFLICT (id) DO UPDATE SET
    item   = EXCLUDED.item,
    stored = EXCLUDED.stored, 
    ttl    = EXCLUDED.ttl
RETURNING id;

    `;

    return sql;
};

module.exports.select = function select(tableName, id){

    var sql = `

SELECT * FROM "${ tableName }" 
WHERE id = '${ id}';

    `;

    return sql;
};


// todo: we need a "cautious_delete" as well, which will do the row lock and check the ttl before doing the DELETE command


module.exports['delete'] = function _delete(tableName, id){

    var sql = `

DELETE FROM "${ tableName }" 
WHERE id = '${ id }';

    `;

    return sql;
};


// 
module.exports.deleteCautiously = function deleteCautiously(tableName, id, stored){

    var sql = `

DELETE FROM "${ tableName }" 
WHERE id = '${ id }' AND stored = '${ stored }';

    `;

    return sql;
};

