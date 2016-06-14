module.exports.createTable = function createTable(tableName){

    // todo - test these constraints
    var sql = `

CREATE TABLE IF NOT EXISTS "${ tableName }" (
    id     text   PRIMARY KEY,
    item   jsonb  NOT NULL,
    stored bigint NOT NULL, 
    ttl    bigint NOT NULL, 

    CONSTRAINT id_must_be_non_empty CHECK 
        (id <> ''),

    CONSTRAINT stored_must_be_within_range CHECK 
        (stored > 0 AND stored <= ${ Number.MAX_SAFE_INTEGER }),

    CONSTRAINT ttl_must_be_within_range CHECK 
        (ttl > 0 AND ttl <= ${ Number.MAX_SAFE_INTEGER })

);

    `;

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
    '${ id }'::TEXT, 
    '${ item }'::JSONB,
    '${ stored }'::BIGINT,
    '${ ttl }'::BIGINT
)
ON CONFLICT (id) DO UPDATE SET
    item = EXCLUDED.item,
    stored = EXCLUDED.stored, 
    ttl = EXCLUDED.ttl
RETURNING id;

    `;

    return sql;
};

module.exports.select = function select(tableName, id){

    var sql = `

SELECT * FROM "${ tableName }" 
WHERE id = '${ id}'::TEXT;

    `;

    return sql;
};


// todo: we need a "cautious_delete" as well, which will do the row lock and check the ttl before doing the DELETE command


module.exports['delete'] = function _delete(tableName, id){

    var sql = `

DELETE FROM "${ tableName }" 
WHERE id = '${ id }'::TEXT;

    `;

    return sql;
};


// 
module.exports.deleteCautiously = function deleteCautiously(tableName, id, stored){

    var sql = `

DELETE FROM "${ tableName }" 
WHERE id = '${ id }'::TEXT AND stored = '${ stored }'::BIGINT;

    `;

    return sql;
};

