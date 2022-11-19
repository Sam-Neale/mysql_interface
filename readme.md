**Classification: Public Domain**
<div align=center>
<h1>MySQL Interface</h1>
<a href="https://github.com/vacenter/tbd">https://github.com/vacenter/tbd</a>
</div>


<h2>What is this?</h2>
<hr>
The MySQL Interface package is a NodeJS interface layer. The package allows you to provide credentials and a database schema (See below) and perform select, update, insert and delete operations. As well as run regular SQL statments. 

The package supports a custom relational system.

<br><h2>Where can I get this?</h2>
<hr>
Using NPM: https://www.npmjs.com/package/tbd

<br><h2>Code Docs</h2>
<hr>
<br><h3>Initialization</h3>

`init(connectionParams, dbSchema)`
* `connectionParams` is an object containing the host, port, user, password and name of the database
* `dbSchema` is the object containing the schema to be created by the package, see the Schema header for more information

**Example**

```js
const db = require('tbd');
const fs = require("fs");
db.init({host: "127.0.0.1", port: 3306, user: "myUser", password: "myPassword", database: "myDatabase"}, JSON.parse(fs.readFileSync('schema.json', 'UTF-8')));
```

<br><h3>Database Schema</h3>
The package requires a schema to create the database, this should be supplied by your application in the dbSchema argument.
The schema file is organised into the following structure:

```json
{
    "tableName": {
        "fields": {
            "column":{
                "type": "columnType",
                "flags": "column flags",
                "default": "'default value'",
                "transform": null
            }
        },
        "pk": "column"
    }
}
```

**Descriptions:**
* `tableName` is the name of the table to be created, must be single words
* `column` is the name of the column
* `type` is the type of column (bigint, varchar, etc)
* `flags` are the flags attached to this column (unsigned, NOT NULL, AUTO_INCREMENT) should be space seperated.
* `default` is the default value for that column, strings should be enclosed in single quotes
* `pk` is an optional property that just states which column is the primary key.

<br><h3>Select data</h3>

`db.tableName.get(query)`
* `tableName` is the name of the table
* `query` is the object containing what is being searched (see example)

**Example:**

```js 
db.users.get({
    username: "myUsername"
})
```

<br><h3>Update data</h3>

`db.tableName.update(fields, where)`
* `tableName` is the name of the table
* `fields` is the object containing what fields are being updated (see example)
* `where` is the object containing the search method (see example)

**Example:**

```js
db.users.update({
    fields: {
        age: 18,
    },
    where: {
        field: "username",
        value: "myUsername",
        operator: "="
    }
})
```

<br><h3>Insert data</h3>

`db.tableName.create(data)`
* `tableName` is the name of the table
* `data` is the object containing the fields

**Example:**

```js
db.users.create({
    username: "myUsername",
    password: "myPassword",
    age: 20
})
```

<br><h3>Delete data</h3>

`db.tableName.delete(query)`
* `tableName` is the name of the table
* `query` is the object containing what is being searched (see example)

**Example:**

```js
db.users.delete({
    username: "myUsername"
})
```

<br><br><h2>Relations</h2><hr>
This package does support relationships, both single and multiple. This can be done by adding a few more things to the schema.

**Single Relationship Example**
```json
"car": {
    "type": "bigint",
    "flags": "unsigned",
    "default": null,
    "transform": null,
    "related": {
        "table": "users",
        "field": "id"
    },
    "relation": "single"
}
```
In the return for a get statment, there will be the data from the linked row. 

**Multiple Relationship Example**
```json
"keys": {
    "type": "string",
    "flags": "",
    "default": null,
    "transform": null,
    "related": {
        "table": "keys",
        "field": "id"
    },
    "relation": "multiple"
}
```
The data for this column should be stored in a stringified array: "[keyID1,keyID2,keyID3]"
In a get statment the returned data will be in an array for each item. If the package fails to find a refrenced row, it will return null in its place.