const mysql = require("mysql2");

const connection = mysql.createConnection({
  host: "shop.onkron.ru",
  user: "shop_o",
  database: "shop_onkron_ru",
  password: "8dYNH846SPvY",
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
