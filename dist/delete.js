const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: process.env.host,
  user: process.env.user,
  database: process.env.database,
  password: process.env.password,
});

connection.connect((err) => {
    if (err) throw err;
    console.log('Успешное подключение к БД!');
   let sql = `DELETE FROM products_specifications WHERE specification = 'NaN' AND language_id = 2`
    connection.query(sql, (err, results) => {
        console.log(results)
        }
      )
    }
)
