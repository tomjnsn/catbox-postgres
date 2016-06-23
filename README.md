# catbox-postgres
Postgres adapter for catbox

### Partitions and segments

Catbox has the notion of "partition" and "segment":

"partition - name used to isolate the cached results across multiple clients. The partition name is used as the MongoDB database name, the Riak bucket, or as a key prefix in Redis and Memcached. To share the cache across multiple clients, use the same partition name."

"segment - a caching segment name string. Enables using a single cache server for storing different sets of items with overlapping ids."

The partition name is used with a catbox client.
The segment name is used with a catbox policy.

For postgres these notions can be interpreted as:

partition - name of the database
segment - name of the table

So, given a catbox client (that is, given a database), we can have several catbox policies (that is, several tables) created using that client.



When the client instance is created it will connect the database given in the partition option. 
This database must exist already. There's no special assumption about it (can be created with 
the `createdb` utility - https://www.postgresql.org/docs/current/static/app-createdb.html)
When the catbox policy instance is created it is 

we check that the database (partition) and table (segment) exist


### options


host
port
user
password
partition: name of the database

verbose: boolean. Show messages from 'notice' events in the console. Default is `false`

dataType: either 'json' or 'jsonb'. Default: 'json'.

unlogged: boolean. 

Create the table (segment) as "unlogged". Data written to unlogged tables is not written to the write-ahead log, which makes them considerably faster than ordinary tables. 

This works only if the table is going to be created.

The performance gain is around 15%, according to this [benchmark](
http://michael.otacoo.com/postgresql-2/unlogged-table-performance-in-postgresql-9-1/)

Default is `true`. 


todo: setInterval with a query to delete the entries that have expired

todo: instead of "create table if not exists", check if table exists directly inthe system tables; if not, create it; if so, make sure the columns are what we expect, and if not, abort;