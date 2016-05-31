module.exports.createTable = function createTable(tableName){

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

    // Number.MAX_SAFE_INTEGER === 2^253 - 1 === 9007199254740991

    return sql;
};

module.exports.upsert = function upsert(tableName, id, item, stored, ttl){

    var sql = `

INSERT INTO "${ tableName }" (id, item, stored, ttl)
VALUES (
    '${ id }'::TEXT, 
    '${ JSON.stringify(item) }'::JSONB,
    '${ stored }'::BIGINT,
    '${ ttl }'::BIGINT
)
ON CONFLICT (id) DO UPDATE SET 
    (item, stored, ttl) = (EXCLUDED.item, EXCLUDED.stored, EXCLUDED.ttl)
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

module.exports._delete = function _delete(tableName, id){

    var sql = `

DELETE FROM "${ tableName }" 
WHERE id = '${ id }'::TEXT;

    `;

    return sql;
};

