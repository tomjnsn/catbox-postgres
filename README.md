# catbox-postgres
Postgres adapter for catbox

### Partitions and segments

Catbox has the notion of "partition" and "segment":

"partition - name used to isolate the cached results across multiple clients. The partition name is used as the MongoDB database name, the Riak bucket, or as a key prefix in Redis and Memcached. To share the cache across multiple clients, use the same partition name."

"segment - a caching segment name string. Enables using a single cache server for storing different sets of items with overlapping ids."

For postgres we are interpreting these notions as:

partition - name of the database
segment - name of the table

When the client instance is created it will connect the database given in the partition option. 
This database must exist already. There's no special assumption about it (can be created with 
the `createdb` utility - https://www.postgresql.org/docs/current/static/app-createdb.html)
When the catbox policy instance is created it is 

we check that the database (partition) and table (segment) exist
