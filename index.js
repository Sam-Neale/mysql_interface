//@ts-check

/*****
 * 
 * Require mandatory modules/packages
 * 
 */

// Standard mysql module
const mysql = require('mysql2');
let db;

// Modules for interacting with filesystem
const fs = require('fs');
const path = require('path');

/*****
 * 
 * Import configuration file
 */

const config = require('./config.json');

/*****
 * 
 * Import database schema
 * 
 */

let tables = {};
//const tables = JSON.parse(fs.readFileSync(path.join(__dirname, 'db.json'), 'utf-8'));

/*****
 * 
 * Object to hold all functions to export -- list of functions will be dynamically generated
 * 
 */

let functions = {}

/**
 * Function to initialise a mysql connection
 */
function dbConnect() {

  console.log("Connecting to DB");

  //  vaconfig.database.flags = "SSL";

  const databaseConfig ={
    host: null,
    port: null,
    user: null,
    password: null,
    database: null,
  }

  // Connect to the database
  db = mysql.createConnection(databaseConfig);

}

/**
 * Function to check if we have all needed DB tables and create if needed
 */
function createTables() {

  return new Promise(async (resolve, reject) => {

    // See if tables already created
    if (config.database.created) {
      // console.log("Tables already created -- no action needed");
      resolve("tables-ready");
    }

    // console.log("Config does not indicate if tables exists. Checking for tables");

    try {

      // Grab list of current tables using MySQL "show tables" command
      const [tableList,tableFields] = await db.promise().query('show tables').catch(console.error);

      // Convert results to array of strings
      let currentTables = []
      for (const tableObj of tableList) {
        currentTables.push(tableObj[tableFields[0].name]);
      }

      // Iterate tables config to see if we need to create the table
      for (let table in tables) {

        // console.log("Checking if table needs to be created: " + table);
        
        // Check if the table we need to create already exists in the DB and create if not
        if (currentTables.indexOf(table) < 0) {

          // console.log("Creating table " + table);

          // Get the primary key for the table
          const pk = tables[table].pk;

          // Build the SQL query
          let sql = "CREATE TABLE ?? ( ?? ";
          sql += tables[table].fields[pk].type + " ";
          sql += tables[table].fields[pk].flags + " ";
          sql += (tables[table].fields[pk].default == null) ? "" : ("DEFAULT " + tables[table].fields[pk].default);
          sql += ", ts bigint NOT NULL DEFAULT 0, ";
          sql += "PRIMARY KEY ( ?? ) ) DEFAULT CHARSET=utf8";

          // Build the query object
          const q = {
            sql: sql,
            values: [
              table,
              pk,
              pk
            ]
          }

          // Send the query to the DB
          const [results,fields] = await db.promise().query(q).catch(console.error);

          // console.log("Table " + table + " created");
          // console.log("Adding fields to table " + table);

          // Iterate all fields
          for (let field in tables[table].fields) {

            // Check if field is primary key and don't create as already exists when table created
            if (field != pk) {

              // Build the SQL query
              let sql = "ALTER TABLE ?? ADD COLUMN ?? ";
              sql += tables[table].fields[field].type + " ";
              sql += tables[table].fields[field].flags + "";
              sql += (tables[table].fields[field].default == null) ? "" : ("DEFAULT " + tables[table].fields[field].default);
      
              // Build the query object
              const q = {
                sql: sql,
                values: [
                  table,
                  field
                ]
              }
      
              // Send the query to the DB
              const [results,fields] = await db.promise().query(q).catch(console.error);

              // console.log("Field " + field + " added to table " + table);

            }
          }

        } else {

          // console.log("Table " + table + " exists -- not creating");

        }

      }

      // Update config to show tables are created
      config.database.created = true;

      // Save config
      fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(config, null, 2));

      resolve("table-ready");

    } catch(e) {

      reject(e);

    }
    
  });

}

/**
 * Populate exports with utility functions for each table
 */
function createFunctions() {

  return new Promise((resolve, reject) => {

    // Iterate tables config to create functions for all tables
    for (let table in tables) {

      // console.log(`Creating functions for table ${table}`);

      // Create table-specific object to hold functions for the table
      functions[table] = {};

      /**
       * "create" function for the table - promise-based
       * @param {Object} params Object containing all fields to use in creating a row in the database table
       * @param {string} dbTable The name of the table to create the row in -- this is automatically populated and should not be passed to the function
       */
      functions[table].create = (params, dbTable = table) => {
        return new Promise(async (resolve, reject) => {

          // Array to hold values which will be dynamically escaped when the query is built
          let values = [];

          // Create variable for the SQL query
          let sql = `INSERT INTO ${dbTable} (`;

          // Iterate through the fields and add the names to the query
          for (const field in params) {

            sql += '`' + field + '`,';

          }

          // Add a time stamp field
          sql += '`ts`';

          sql += ') VALUES (';

          // Iterate through the field and add placeholder to the query and add values to the array
          for (const field in params) {

            sql += '?,';

            values.push(params[field]);

          }

          // Add time stamp placeholder to the query and value to the array
          values.push(new Date().getTime()); // time stamp
          sql += '?)';

          // Build the query object
          const q = {
            sql: sql,
            values: values
          }

          // console.log(q);

          try {

            // Send the query to the DB
            const [results,fields] = await db.promise().query(q).catch(console.error);

            resolve( { results: results, fields: fields } );

          } catch(e) {

            reject(e);

          }

        });
      };

      /**
       * "update" function for the table - promise-based
       * @param {Object} params Object containing fields and where criteria for updating a table
       * @param {Object} params.fields Object containing all fields/values to to be modified when updating table rows
       * @param {Object} params.where Object specifying a "where" criteria to select the rows to update in the table
       * @param {string} params.where.field Name of the field to use in the "where" criteria
       * @param {string} params.where.operator MySQL operator to use in the "where" criteria (such as "=")
       * @param {string} params.where.value Value to compare the field against using the operator in the "where" criteria (can only be a numeric value if the field is an numeric type)
       * @param {string} dbTable The name of the table to update rows in -- this is automatically populated and should not be passed to the function
       */
      functions[table].update = (params, dbTable = table) => {
        return new Promise(async (resolve, reject) => {

          // Array to hold values which will be dynamically escaped when the query is built
          let values = [];

          // Create variable for the SQL query
          let sql = `UPDATE ${dbTable} SET `;

          // Iterate through the fields and add them to the SET clause with placeholders
          for (const field in params.fields) {

            sql += `${field} = ?, `;

          }

          // Add time stamp field to the SET clause
          sql += 'ts = ? ';

          // Iterate through fields and add values to the array
          for (const field in params.fields) {

            values.push(params.fields[field]);
            
          }

          // Add time stamp value to the array
          values.push(new Date().getTime()); // time stamp

          // Specify the WHERE filter
          sql += `WHERE ${params.where.field} ${params.where.operator} ?`;

          // Add value for WHERE filter to the array
          values.push(params.where.value);

          // Build the query object
          const q = {
            sql: sql,
            values: values
          }

          try {

            // Send the query to the DB
            // console.log(q);
            const [results,fields] = await db.promise().query(q).catch(console.error);

            resolve( { results: results, fields: fields } );

          } catch(e) {

            reject(e);

          }

        });
      };

      /**
       * "delete" function for the table - promise-based
       * @param {Object} params Object containing all fields/values to use in "where" criteria to select rows to delete
       * @param {string} dbTable The name of the table to delete rows in -- this is automatically populated and should not be passed to the function
       */
      functions[table].delete = (params = null, dbTable = table) => {
        return new Promise(async (resolve, reject) => {

          // Array to hold values which will be dynamically escaped when the query is built
          let values = [];

          // Only build and send query if we have a "where" filter -- do not risk deleting everything by accident
          if (params && Object.keys(params).length > 0) {

            // Create variable for the SQL query
            let sql = `DELETE FROM ${dbTable} `;

            // Create WHERE clause
            sql += `WHERE `;

            // Iterate through the fields and add them to the SET clause with placeholders
            for (const field in params) {
    
              sql += `${field} = ? AND `;
    
            }
    
            // Add time stamp field to the SET clause
            sql += 'ts > 0';
    
            // Iterate through fields and add values to the array
            for (const field in params) {
    
              values.push(params[field]);
    
            }

            // Build the query object
            const q = {
              sql: sql,
              values: values
            }
    
            try {

              // Send the query to the DB
              const [results,fields] = await db.promise().query(q).catch(console.error);
  
              resolve( { results: results, fields: fields } );
  
            } catch(e) {
  
              reject(e);
  
            }
  
          } else {

            reject("missing 'where'");

          }

        });
      };

      /**
       * "get" function for the table - promise-based
       * @param {Object} params Object containing all fields/values to use in "where" criteria to select rows to return
       * @param {string} dbTable The name of the table to select rows in -- this is automatically populated and should not be passed to the function
       */
      functions[table].get = (params = null, populate = true, dbTable = table) => {
        return new Promise(async (resolve, reject) => {

          // Array to hold values which will be dynamically escaped when the query is built
          let values = [];

          // Create variable for the SQL query
          let sql = `SELECT * FROM ${dbTable} `;

          // Add a WHERE clause if we have a "where" filter
          if (params && Object.keys(params).length > 0) {

            // Create WHERE clause
            sql += `WHERE `;

            // Iterate through the fields and add them to the SET clause with placeholders
            for (const field in params) {
    
              sql += `${field} = ? AND `;
    
            }
    
            // Add time stamp field to the SET clause
            sql += 'ts > 0';
    
            // Iterate through fields and add values to the array
            for (const field in params) {
    
              values.push(params[field]);
    
            }

          }

          // Build the query object
          const q = {
            sql: sql,
            values: values
          }

          // console.log(q);

          try {

            // Send the query to the DB
            const [results,fields] = await db.promise().query(q).catch(console.error);

            // console.log(results);

            for (const result in results) {
            const resultStore = result;
            // Include relation tables if any related
              for (const field in tables[dbTable].fields) {
                const fieldStore = field;
                 let fieldObj = tables[dbTable].fields[fieldStore];
                 if (fieldObj.related && fieldObj.relation == "single" && populate) {
                   let related_table = fieldObj.related.table;
                   let related_field = fieldObj.related.field;
                   let target = results[resultStore][fieldStore];
                   let sql = `SELECT * FROM ${related_table} WHERE ${related_field} = ?`

                   const q = { sql: sql, values: [target] };

                   try {

                     const [r,f] = await db.promise().query(q).catch(console.error);
/*                     results[result][field] = {
                       dbdata: target
                     };*/

                     if (r.length > 0) {
                      results[resultStore][fieldStore] = r[0];
//                       results[result][field].relations = r[0];
                     } else {
                      results[resultStore][fieldStore] = null;
//                       results[result][field].relations = null;
                     }

                   } catch(e) {

                     reject(e);

                   }
                 }

                 if (fieldObj.related && fieldObj.relation == "multiple" && populate) {

                   let related_table = fieldObj.related.table;
                   let related_field = fieldObj.related.field;
                   let target = results[result][field];
                   let list = [];

                   let targets = JSON.parse(target);

                   for (const id of targets) {

                     let sql = `SELECT * FROM ${related_table} WHERE ${related_field} = ?`

                     const q = { sql: sql, values: [ id ] };

                     try {

                       const [r,f] = await db.promise().query(q).catch(console.error);

/*                       let newresult = {
                         dbdata: target
                       };*/

                       if (r.length > 0) {
                         list.push(r[0]);
//                         newresult.relations = r[0];
                       } else {
                         list.push(null);
//                         newresult.relations = null;
                       }

//                       list.push(newresult);

                     } catch(e) {

                       reject(e);

                     }
                   }

                   results[result][field] = list;

                }

              }
            }

            resolve( { results: results, fields: fields } );

          } catch(e) {

            reject(e);

          }

        });
      };

      /**
       * "has" function for the table - promise-based. -- currently not implemented and pending
       * @param {Object} params Object containing all fields/values to use in "where" criteria to select rows to return
       * @param {string} dbTable The name of the table to select rows in -- this is automatically populated and should not be passed to the function
       */
      functions[table].has = (params, dbTable = table) => {
        return new Promise(async (resolve, reject) => {
          resolve(`Has ${dbTable} done: ` + JSON.stringify(params));
        });
      };

    }

    resolve("functions-ready");

  });

}

/**
 * Function to run raw SQL query on the DB. WARNING: No sanitisation is performed in this function. Use with caution.
 * Destructive actions will be irreversible.
 */
functions.sql = (sql, sqlParams) => {
  return new Promise(async (resolve, reject) => {

      try {

        // Send the query to the DB
        const [results,fields] = await db.promise().query(sql, sqlParams).catch(console.error);

        resolve( { results: results, fields: fields } );

      } catch(e) {

        reject(e);

      }
      
  });

}
    
/**
 * Function to drop all DB tables and clear the database. WARNING: This function is irreversible. Use with caution.
 */
functions.drop = () => {
  return new Promise(async (resolve, reject) => {

    // Iterate through tables
    for (let table in tables) {

      // Create variable for the SQL query
      let sql = `DROP TABLE ${table} `;

      // Build the query object
      const q = {
        sql: sql,
        values: []
      }
      
      try {

        // Send the query to the DB
        const query = await db.promise().query(q).catch(console.error);

        // console.log(`Table ${table} dropped`);

      } catch(e) {

        reject(e);

      }
      
    }

    resolve("dropped");

  });
}

/**
 * Function to initialise DB and connect if ready - promise-based
 */
functions.init = (params = { host: null, port: null, user: null, password: null, database: null, created: false }, dbSchema ,reset = false) => {
  return new Promise(async (resolve, reject) => {

    // Check there is a DB config object
    if (!config.hasOwnProperty("database")) {

      // We don't have a DB config object
      console.log("No database object defined!")

      // Create empty DB config object
      config.database = params;

      //Save config file
      fs.writeFileSync("./config.json", JSON.stringify(config, null, 2))

    }

    if (reset && params != null) {

      // Reset DB settings with params
      config.database = params;
      config.database.created = false;

      //Save the config file
      fs.writeFileSync("./config.json", JSON.stringify(config, null, 2))

    }

    // Check if we have all DB config values
    if (!params.host ||
        !params.port ||
        !params.user ||
        !params.password ||
        !params.database ||
        !config.database.hasOwnProperty("created")) {

          // We are missing DB config object properties or some are null
          console.log("Missing some DB config properties or not fully populated with values")

    }

      // We have a complete and populated DB config object
      // console.log("Complete DB config object available")

      try {

        tables = dbSchema;

        // Initialise mysql connection
        dbConnect();

        // Check if the DB tables are created and create if needed
        await createTables().catch(console.error);

        // Create utility functions for export
        await createFunctions().catch(console.error);

        console.log("Ready");

        // Resolve the promise
        resolve('ready');

      } catch(e) {

        reject(e);

      }

  });
}

/*****
 * 
 * Export functions
 * 
 */

module.exports = functions;
